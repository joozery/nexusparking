import path from 'path'
import fs from 'fs/promises'
import { fetchWithDigestAuth } from '@/lib/digestAuth'
import { sendRawToPrinter } from '@/lib/windowsRawPrint'
import { buildReceipt, drawerKickCommand, type ReceiptData } from '@/lib/escpos'

interface HardwareDevice {
  ip:       string
  port:     number
  endpoint: string
  enabled:  boolean
}

interface CaptureCameraDevice {
  ip:      string
  port:    number
  user:    string
  pass:    string
  enabled: boolean
}

interface HardwareConfig {
  camera:      HardwareDevice
  barrier:     HardwareDevice
  reader:      HardwareDevice
  printer:     HardwareDevice
  drawer:      HardwareDevice
  cameraEntry: CaptureCameraDevice
  cameraExit:  CaptureCameraDevice
}

export interface TriggerResult { success: boolean; latencyMs: number }

async function saveLog(device: string, event: string, ip: string, result: TriggerResult) {
  try {
    const [{ connectDB }, { HardwareLog }] = await Promise.all([
      import('@/lib/mongodb'),
      import('@/models/HardwareLog'),
    ])
    await connectDB()
    await HardwareLog.create({ device, event, ip, success: result.success, latencyMs: result.latencyMs })
  } catch {
    // logging must never throw to caller
  }
}

async function httpTrigger(device: HardwareDevice, params?: Record<string, string>): Promise<TriggerResult> {
  if (!device.enabled || !device.ip) return { success: false, latencyMs: 0 }
  const t0 = Date.now()
  try {
    const url = new URL(`http://${device.ip}:${device.port}${device.endpoint}`)
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    const res = await fetch(url.toString(), {
      method: 'POST',
      signal: AbortSignal.timeout(3000),
    })
    return { success: res.ok, latencyMs: Date.now() - t0 }
  } catch {
    console.warn(`[Hardware] Failed to reach ${device.ip}:${device.port}${device.endpoint}`)
    return { success: false, latencyMs: Date.now() - t0 }
  }
}

// ── กล้องวงจรปิด — capture snapshot (ISAPI + Digest Auth) แล้วเซฟลง disk ────
// จัดเก็บเป็น captures/YYYY-MM-DD/HH-mm-ss_{event}_{plate}_{sessionId}.jpg (เวลาท้องถิ่นของเครื่อง — ตรงกับเวลาที่ checkin/checkout จริง)
const CAPTURE_DIR = process.env.CAPTURE_DIR ?? path.join(process.cwd(), 'captures')

const pad2 = (n: number) => String(n).padStart(2, '0')
const dateFolder = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const timeStamp  = (d: Date) => `${pad2(d.getHours())}-${pad2(d.getMinutes())}-${pad2(d.getSeconds())}`

async function captureSnapshot(cam: CaptureCameraDevice, subDir: string, filename: string): Promise<string | null> {
  if (!cam.enabled || !cam.ip) return null
  try {
    const camUrl = `http://${cam.ip}:${cam.port}/ISAPI/Streaming/channels/101/picture`
    const res = await fetchWithDigestAuth(camUrl, cam.user, cam.pass)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const dir = path.join(CAPTURE_DIR, subDir)
    await fs.mkdir(dir, { recursive: true })
    const filePath = path.join(dir, filename)
    await fs.writeFile(filePath, buf)
    return filePath
  } catch (e) {
    console.warn('[Hardware] Camera capture failed:', (e as Error).message)
    return null
  }
}

async function linkPhotoToSession(sessionId: string, event: 'checkin' | 'checkout' | 'lost', filePath: string) {
  try {
    const [{ connectDB }, { ParkingSession }] = await Promise.all([
      import('@/lib/mongodb'),
      import('@/models/ParkingSession'),
    ])
    await connectDB()
    const field = event === 'checkin' ? 'entryPhotoPath' : 'exitPhotoPath'
    await ParkingSession.updateOne({ _id: sessionId }, { [field]: filePath })
  } catch (e) {
    console.warn('[Hardware] Failed to link photo to session:', (e as Error).message)
  }
}

export async function triggerCamera(
  hw: HardwareConfig,
  data: { sessionId: string; cardUid: string; plate: string; event: 'checkin' | 'checkout' | 'lost' }
): Promise<TriggerResult> {
  const cam = data.event === 'checkin' ? hw.cameraEntry : hw.cameraExit
  const t0  = Date.now()
  const now = new Date(t0)
  const safePlate = data.plate.replace(/[^a-zA-Z0-9ก-๙]/g, '') || 'unknown'
  const filename  = `${timeStamp(now)}_${data.event}_${safePlate}_${data.sessionId}.jpg`
  const filePath  = await captureSnapshot(cam, dateFolder(now), filename)
  const result: TriggerResult = { success: !!filePath, latencyMs: Date.now() - t0 }
  void saveLog('camera', data.event, cam.ip, result)
  if (filePath) void linkPhotoToSession(data.sessionId, data.event, filePath)
  return result
}

// ── ไม้กั้น ───────────────────────────────────────────────────
export async function triggerBarrier(
  hw: HardwareConfig,
  direction: 'checkin' | 'checkout' = 'checkin'
): Promise<TriggerResult> {
  const result = await httpTrigger(hw.barrier, { cmd: direction })
  void saveLog('barrier', direction, hw.barrier.ip, result)
  return result
}

// ── เครื่องพิมพ์/ลิ้นชัก ที่ต่อ USB โดยตรง (ไม่มี IP) ────────────
// EPSON TM-T82II ต่อ USB เข้าเครื่องนี้ (parking-app ก็รันอยู่บนเครื่องเดียวกันผ่าน PM2)
// ลิ้นชักไม่มีสายของตัวเอง — สั่งเปิดผ่านคำสั่ง drawer-kick ที่ยิงเข้าคิวเครื่องพิมพ์เดียวกัน
// `enabled` แต่ไม่มี `ip` = ตีความว่า `endpoint` คือชื่อคิวเครื่องพิมพ์ Windows (ไม่ใช่ URL path)
async function windowsPrinterTrigger(device: HardwareDevice, bytes: Buffer): Promise<TriggerResult> {
  if (!device.enabled || !device.endpoint) return { success: false, latencyMs: 0 }
  const t0 = Date.now()
  const success = await sendRawToPrinter(device.endpoint, bytes)
  return { success, latencyMs: Date.now() - t0 }
}

// ── พิมพ์ raw bytes ตรงๆ (ใช้กับสลิปที่ไม่ใช่ ReceiptData เช่น สลิปเข้ากะ/ปิดกะ) ──
export async function printRaw(hw: HardwareConfig, bytes: Buffer): Promise<TriggerResult> {
  const result = await windowsPrinterTrigger(hw.printer, bytes)
  void saveLog('printer', 'raw', hw.printer.endpoint, result)
  return result
}

// ── ลิ้นชักเก็บเงิน ──────────────────────────────────────────
export async function triggerDrawer(hw: HardwareConfig): Promise<TriggerResult> {
  const result = hw.drawer.ip
    ? await httpTrigger(hw.drawer, { cmd: 'open' })
    : await windowsPrinterTrigger(hw.drawer, drawerKickCommand())
  void saveLog('drawer', 'trigger', hw.drawer.ip || hw.drawer.endpoint, result)
  return result
}

// ── เครื่องพิมพ์ใบเสร็จ ────────────────────────────────────────
export async function triggerPrinter(hw: HardwareConfig, receipt: ReceiptData): Promise<TriggerResult> {
  if (hw.printer.ip) {
    const t0 = Date.now()
    try {
      const url = `http://${hw.printer.ip}:${hw.printer.port}${hw.printer.endpoint}`
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(receipt),
        signal:  AbortSignal.timeout(5000),
      })
      const result: TriggerResult = { success: res.ok, latencyMs: Date.now() - t0 }
      void saveLog('printer', 'receipt', hw.printer.ip, result)
      return result
    } catch {
      console.warn('[Hardware] Printer trigger failed')
      const result: TriggerResult = { success: false, latencyMs: Date.now() - t0 }
      void saveLog('printer', 'receipt', hw.printer.ip, result)
      return result
    }
  }
  const result = await windowsPrinterTrigger(hw.printer, buildReceipt(receipt))
  void saveLog('printer', 'receipt', hw.printer.endpoint, result)
  return result
}

// ── Check-in sequence: กล้อง (barrier ย้ายไปฝั่ง client) ────────
export function runCheckinSequence(
  hw: HardwareConfig,
  data: { sessionId: string; cardUid: string; plate: string }
) {
  void triggerCamera(hw, { ...data, event: 'checkin' })
}

// ── Check-out sequence: กล้อง + ลิ้นชัก (barrier ย้ายไปฝั่ง client) ──
// ไม่พิมพ์ใบเสร็จอัตโนมัติ — ลูกค้าส่วนใหญ่ไม่เอาสลิป เปิดแค่ลิ้นชัก
// ถ้าลูกค้าต้องการใบเสร็จ operator กดพิมพ์เองผ่าน POST /api/sessions/[id]/print (เรียก triggerPrinter ตรงๆ)
export function runCheckoutSequence(
  hw: HardwareConfig,
  data: { sessionId: string; cardUid: string; plate: string }
) {
  void Promise.all([
    triggerCamera(hw, { sessionId: data.sessionId, cardUid: data.cardUid, plate: data.plate, event: 'checkout' }),
    triggerDrawer(hw),
  ])
}
