import { createHash, randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { parkingMutation } from '@/lib/parkingMutation'
import { ParkingSession } from '@/models/ParkingSession'
import { Discount } from '@/models/Discount'
import { getSettings } from '@/models/SystemSettings'
import { calcFeeBreakdown, calcDurationMinutes, type CardType } from '@/lib/calcFee'
import { importDiscounts } from '@/lib/simulatorImport'
import { clearParkingHistoryFilter } from '@/lib/clearParkingHistory'

async function isAdmin() {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  const user = token ? verifyToken(token) : null
  return user?.role === 'admin' || user?.role === 'superadmin'
}
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

async function deletionPreview() {
  const candidates = await ParkingSession.find(clearParkingHistoryFilter).select('_id').sort({ _id: 1 }).lean()
  return { count: candidates.length, token: digest(candidates.map(d => String(d._id))), ids: candidates.map(d => d._id) }
}

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ' }, { status: 403 })
  await connectDB()
  const { count, token } = await deletionPreview()
  return NextResponse.json({ count, token })
}

async function handleDelete(req: NextRequest) {
  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'กรุณาตรวจสอบจำนวนรายการก่อนลบ' }, { status: 400 }) }
  const preview = await deletionPreview()
  if (body?.confirmation !== 'CLEAR_COMPLETED_HISTORY' || body?.token !== preview.token) {
    return NextResponse.json({ error: 'รายการเปลี่ยนแปลง กรุณาตรวจสอบจำนวนและยืนยันใหม่' }, { status: 409 })
  }
  const result = await ParkingSession.deleteMany({ ...clearParkingHistoryFilter, _id: { $in: preview.ids } })
  return NextResponse.json({ deleted: result.deletedCount })
}
const lockedDelete = parkingMutation(handleDelete)
export async function DELETE(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ' }, { status: 403 })
  return lockedDelete(req)
}

interface ImportRow {
  rowNum?: number
  plate: string
  cardType: CardType
  entryTime: string
  exitTime: string
  paymentMethod: 'cash' | 'qr'
  shopDiscountName?: string
  hotelDiscountName?: string
}

async function handlePost(req: NextRequest) {
  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 }) }
  const manual = Array.isArray(body)
  const rows: ImportRow[] = manual ? body : body?.rows
  const mode = manual ? 'manual' : body?.mode
  if (!['manual', 'preview', 'commit'].includes(mode) || !Array.isArray(rows) || !rows.length || rows.length > 10000) {
    return NextResponse.json({ error: 'ต้องมีข้อมูล 1–10,000 รายการ' }, { status: 400 })
  }
  const [settings, discounts] = await Promise.all([getSettings(), Discount.find({ isActive: true }).lean()])
  const documents: Record<string, unknown>[] = []
  const results: { rowNum: number; plate: string; fee: number; discount: number; total: number; duplicate: boolean; error?: string; warning?: string }[] = []
  const seen = new Set<string>()
  const plates = [...new Set(rows.filter(r => typeof r?.plate === 'string').map(r => r.plate.trim().toUpperCase()))]
  const existing = await ParkingSession.find({ plate: { $in: plates } }).select('plate cardType entryTime exitTime').lean()
  const key = (r: { plate: string; cardType: string; entryTime: Date; exitTime?: Date }) => JSON.stringify([r.plate.trim().toUpperCase(), r.cardType, r.entryTime.toISOString(), r.exitTime?.toISOString()])
  for (const r of existing) seen.add(key(r))
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const result = { rowNum: r?.rowNum ?? i + 1, plate: typeof r?.plate === 'string' ? r.plate.trim().toUpperCase() : '', fee: 0, discount: 0, total: 0, duplicate: false, error: undefined as string | undefined, warning: undefined as string | undefined }
    results.push(result)
    try {
      if (!result.plate || !['car', 'motorcycle', 'overnight'].includes(r.cardType)) throw new Error('ทะเบียนหรือประเภทรถไม่ถูกต้อง')
      if (!['cash', 'qr'].includes(r.paymentMethod)) throw new Error('กรุณาระบุช่องทางชำระเงิน')
      if (![r.entryTime, r.exitTime].every(v => typeof v === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(v))) throw new Error('วันเวลาต้องระบุเขตเวลา')
      const entry = new Date(r.entryTime), exit = new Date(r.exitTime)
      if (!Number.isFinite(entry.getTime()) || !Number.isFinite(exit.getTime()) || exit <= entry) throw new Error('เวลาออกต้องมากกว่าเวลาเข้า')
      if (exit.getTime() - entry.getTime() > 366 * 86400000) throw new Error('ระยะเวลาจอดเกิน 366 วัน กรุณาตรวจสอบ')
      const { total: fee, segments } = calcFeeBreakdown(r.cardType, entry, exit, settings.rates.overnight)
      const nights = segments.filter(s => s.kind === 'overnight').length
      const disc = importDiscounts(fee, nights, r.shopDiscountName ?? '', r.hotelDiscountName ?? '', discounts)
      result.fee = fee; result.discount = disc.total; result.total = disc.final; result.warning = disc.warning
      const visit = { plate: result.plate, cardType: r.cardType, entryTime: entry, exitTime: exit }
      const fingerprint = key(visit)
      result.duplicate = seen.has(fingerprint)
      seen.add(fingerprint)
      if (result.duplicate) continue
      const applied = nights > 0 ? disc.hotelDisc : disc.shopDisc
      documents.push({ ...visit, durationMin: calcDurationMinutes(entry, exit), fee, lostFine: 0,
        totalFee: disc.final, status: 'completed', paymentMethod: r.paymentMethod,
        discountId: applied ? String(applied._id) : undefined,
        discountName: applied ? `${applied.name}${nights > 0 ? ` (${nights} คืน)` : ''}` : undefined,
        discountAmount: disc.total,
      })
    } catch (error) { result.error = error instanceof Error ? error.message : 'ข้อมูลไม่ถูกต้อง' }
  }
  const errors = results.filter(r => r.error).length
  const duplicates = results.filter(r => r.duplicate).length
  const token = digest({ documents, results })
  const preview = { token, results, errors, duplicates, ready: documents.length,
    total: documents.reduce((sum, doc) => sum + Number(doc.totalFee), 0) }
  if (mode === 'preview') return NextResponse.json(preview)
  if (errors) return NextResponse.json({ error: `พบข้อมูลผิดพลาด ${errors} แถว กรุณาแก้ก่อนบันทึก`, ...preview }, { status: 400 })
  if (mode === 'commit' && body.token !== token) return NextResponse.json({ error: 'ข้อมูลหรืออัตราเปลี่ยนแปลง กรุณาตรวจสอบก่อนบันทึกอีกครั้ง' }, { status: 409 })
  if (!documents.length) return NextResponse.json({ created: 0, duplicates })
  const created = await ParkingSession.insertMany(documents.map(doc => ({ ...doc, cardUid: `IMPORT-${randomUUID()}` })))
  return NextResponse.json({ created: created.length, duplicates }, { status: 201 })
}
const lockedPost = parkingMutation(handlePost)
export async function POST(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ' }, { status: 403 })
  return lockedPost(req)
}
