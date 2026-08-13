interface HardwareDevice {
  ip:       string
  port:     number
  endpoint: string
  enabled:  boolean
}

interface HardwareConfig {
  camera:  HardwareDevice
  barrier: HardwareDevice
  reader:  HardwareDevice
  printer: HardwareDevice
  drawer:  HardwareDevice
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

// ── กล้องวงจรปิด ──────────────────────────────────────────────
export async function triggerCamera(
  hw: HardwareConfig,
  data: { cardUid: string; plate: string; event: 'checkin' | 'checkout' | 'lost' }
): Promise<TriggerResult> {
  const result = await httpTrigger(hw.camera, {
    uid: data.cardUid, plate: data.plate, event: data.event, ts: Date.now().toString(),
  })
  void saveLog('camera', data.event, hw.camera.ip, result)
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

// ── ลิ้นชักเก็บเงิน ──────────────────────────────────────────
export async function triggerDrawer(hw: HardwareConfig): Promise<TriggerResult> {
  const result = await httpTrigger(hw.drawer, { cmd: 'open' })
  void saveLog('drawer', 'trigger', hw.drawer.ip, result)
  return result
}

// ── เครื่องพิมพ์ใบเสร็จ ────────────────────────────────────────
export async function triggerPrinter(
  hw: HardwareConfig,
  receipt: {
    plate:     string
    cardType:  string
    entryTime: string
    exitTime:  string
    duration:  string
    fee:       number
    lostFine?: number
    total:     number
  }
): Promise<TriggerResult> {
  if (!hw.printer.enabled || !hw.printer.ip) return { success: false, latencyMs: 0 }
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

// ── Check-in sequence: กล้อง (barrier ย้ายไปฝั่ง client) ────────
export function runCheckinSequence(
  hw: HardwareConfig,
  data: { cardUid: string; plate: string }
) {
  void triggerCamera(hw, { ...data, event: 'checkin' })
}

// ── Check-out sequence: กล้อง + ลิ้นชัก + พิมพ์ (barrier ย้ายไปฝั่ง client) ──
export function runCheckoutSequence(
  hw: HardwareConfig,
  data: { cardUid: string; plate: string; receipt: Parameters<typeof triggerPrinter>[1] }
) {
  void Promise.all([
    triggerCamera(hw, { cardUid: data.cardUid, plate: data.plate, event: 'checkout' }),
    triggerDrawer(hw),
    triggerPrinter(hw, data.receipt),
  ])
}
