import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { parkingMutation } from '@/lib/parkingMutation'
import { ParkingSession } from '@/models/ParkingSession'
import { ParkingCard } from '@/models/ParkingCard'
import { ParkingQueue } from '@/models/ParkingQueue'
import { needsParkingQueue, type CapacityVisit, type CapacityQueue } from '@/lib/simulatorCapacity'
import { loadCardTimeline } from '@/lib/cardAvailability'
import { cardVisitError } from '@/lib/cardTimeline'
import { Discount } from '@/models/Discount'
import { Fine } from '@/models/Fine'
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
  await ParkingQueue.deleteMany({ sessionId: { $in: preview.ids.map(String) }, status: { $in: ['entered', 'cancelled'] }, lostCard: { $ne: true } })
  return NextResponse.json({ deleted: result.deletedCount })
}
const lockedDelete = parkingMutation(handleDelete)
export async function DELETE(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ' }, { status: 403 })
  return lockedDelete(req)
}

interface ImportRow {
  rowNum?: number
  cardUid: string
  lostCard?: boolean
  plate: string
  cardType: CardType
  entryTime: string
  exitTime: string
  paymentMethod: 'cash' | 'qr'
  fineId?: string
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
  const [settings, discounts, fines] = await Promise.all([
    getSettings(),
    Discount.find({ isActive: true }).lean(),
    Fine.find({ isActive: true }).lean(),
  ])
  const documents: Record<string, unknown>[] = []
  const queueDocuments: Record<string, unknown>[] = []
  const [occupied, queueHistory] = await Promise.all([
    ParkingSession.find({ status: { $ne: 'void' } }).select('cardType entryTime exitTime parkingStartedAt neverParked').lean(),
    ParkingQueue.find({}).lean(),
  ])
  const capacityVisits: CapacityVisit[] = [...occupied]
  const capacityQueues: CapacityQueue[] = [...queueHistory]
  const results: { cardUid: string; status: string; lostFine: number; fineAmount: number; fineName?: string; rowNum: number; plate: string; fee: number; discount: number; total: number; duplicate: boolean; error?: string; warning?: string }[] = []
  const seen = new Set<string>()
  const uids = [...new Set(rows.map(r => typeof r?.cardUid === 'string' ? r.cardUid.trim() : '').filter(Boolean))]
  const [cards, timeline] = await Promise.all([ParkingCard.find({ uid: { $in: uids } }).lean(), loadCardTimeline(uids)])
  const key = (r: { cardUid: string; plate: string; entryTime: Date; exitTime?: Date | null }) => JSON.stringify([r.cardUid, r.plate.trim().toUpperCase(), r.entryTime.toISOString(), r.exitTime?.toISOString() ?? ''])
  const existing = await ParkingSession.find({ cardUid: { $in: uids }, status: { $ne: 'void' } }).select('cardUid plate cardType entryTime exitTime').lean()
  for (const r of existing) seen.add(key(r))
  for (const q of queueHistory.filter(q => q.status === 'waiting' && q.cardUid)) {
    seen.add(key({ cardUid: q.cardUid!, plate: q.plate, entryTime: q.joinedAt }))
  }
  // Validate in time order, independently of Excel row order; return results in source order.
  const ordered = rows.map((r, i) => ({ r, i })).sort((a, b) => (Date.parse(a.r?.entryTime) || 0) - (Date.parse(b.r?.entryTime) || 0))
  for (const { r, i } of ordered) {
    const uid = typeof r?.cardUid === 'string' ? r.cardUid.trim() : ''
    const result = { cardUid: uid, status: r?.exitTime ? 'completed' : 'active', lostFine: 0, fineAmount: 0, fineName: undefined as string | undefined, rowNum: r?.rowNum ?? i + 1, plate: typeof r?.plate === 'string' ? r.plate.trim().toUpperCase() : '', fee: 0, discount: 0, total: 0, duplicate: false, error: undefined as string | undefined, warning: undefined as string | undefined, cardUnavailable: false }
    results.push(result)
    try {
      if (!result.plate || !['car', 'motorcycle', 'overnight'].includes(r.cardType)) throw new Error('ทะเบียนหรือประเภทรถไม่ถูกต้อง')
      const card = cards.find(c => c.uid === uid && c.isActive)
      if (!card) { result.cardUnavailable = true; throw new Error('กรุณาเลือกบัตรที่ลงทะเบียนและเปิดใช้งาน') }
      if (card.type !== r.cardType) { result.cardUnavailable = true; throw new Error('ประเภทรถไม่ตรงกับบัตรที่เลือก') }
      if (r.lostCard != null && typeof r.lostCard !== 'boolean') throw new Error('สถานะบัตรหายไม่ถูกต้อง')
      const selectedFine = r.fineId ? fines.find(f => String(f._id) === r.fineId) : null
      if (r.fineId && !selectedFine) throw new Error('ไม่พบค่าปรับที่เลือกหรือค่าปรับถูกปิดใช้งาน')
      if (selectedFine && !r.exitTime) throw new Error('เลือกค่าปรับได้เฉพาะรายการที่มีเวลาออก')
      if (!['cash', 'qr'].includes(r.paymentMethod)) throw new Error('กรุณาระบุช่องทางชำระเงิน')
      if (![r.entryTime, ...(r.exitTime ? [r.exitTime] : [])].every(v => typeof v === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(v))) throw new Error('วันเวลาต้องระบุเขตเวลา')
      const entry = new Date(r.entryTime), exit = r.exitTime ? new Date(r.exitTime) : undefined
      if (!Number.isFinite(entry.getTime()) || (exit && (!Number.isFinite(exit.getTime()) || exit <= entry))) throw new Error('เวลาออกต้องมากกว่าเวลาเข้า')
      if (exit && exit.getTime() - entry.getTime() > 366 * 86400000) throw new Error('ระยะเวลาจอดเกิน 366 วัน กรุณาตรวจสอบ')
      if (card.expiryDate && new Date(card.expiryDate) < entry) { result.cardUnavailable = true; throw new Error('บัตรหมดอายุก่อนเวลาเข้า') }
      const { total: fee, segments } = exit ? calcFeeBreakdown(r.cardType, entry, exit, settings.rates.overnight) : { total: 0, segments: [] }
      const nights = segments.filter(s => s.kind === 'overnight').length
      const disc = importDiscounts(fee, nights, r.shopDiscountName ?? '', r.hotelDiscountName ?? '', discounts)
      result.lostFine = exit && r.lostCard ? settings.lostCardFine : 0
      result.fineAmount = exit && selectedFine ? selectedFine.amount : 0
      result.fineName = exit && selectedFine ? selectedFine.name : undefined
      result.fee = fee; result.discount = disc.total; result.total = disc.final + result.lostFine + result.fineAmount
      result.warning = exit ? disc.warning : 'รถยังอยู่ในลาน ค่าจอด ส่วนลด และค่าปรับจะคำนวณตอนรับรถออก'
      const visit = { cardUid: uid, plate: result.plate, cardType: r.cardType, entryTime: entry, exitTime: exit, lostCard: Boolean(r.lostCard), status: result.status }
      const fingerprint = key(visit)
      result.duplicate = seen.has(fingerprint)
      if (result.duplicate) continue
      const conflict = cardVisitError(visit, timeline.history, timeline.returns)
      if (conflict) { result.cardUnavailable = true; throw new Error(conflict) }
      seen.add(fingerprint)
      timeline.history.push(visit)
      const queued = needsParkingQueue(visit, settings.capacity, capacityVisits, capacityQueues)
      if (queued) {
        const queue = { cardUid: uid, plate: result.plate, cardType: r.cardType, joinedAt: entry,
          lostCard: Boolean(r.lostCard), status: exit ? 'cancelled' : 'waiting', cancelledAt: exit }
        queueDocuments.push(queue)
        capacityQueues.push(queue)
        result.status = exit ? 'queue_completed' : 'waiting'
        result.warning = exit ? 'ลานเต็ม/มีคิวก่อนหน้า: รอคิวแล้วออก คิดค่าจอดตั้งแต่เวลาเข้าคิว' : 'ลานเต็ม/มีคิวก่อนหน้า: รอคิว ให้เลือกเข้าช่องจอดเมื่อว่าง'
        if (!exit) continue
      } else capacityVisits.push(visit)
      const applied = exit ? (nights > 0 ? disc.hotelDisc : disc.shopDisc) : null
      documents.push({ ...visit, neverParked: queued, durationMin: exit ? calcDurationMinutes(entry, exit) : 0, fee, lostFine: result.lostFine,
        totalFee: result.total, paymentMethod: r.paymentMethod,
        discountId: applied ? String(applied._id) : undefined,
        discountName: applied ? `${applied.name}${nights > 0 ? ` (${nights} คืน)` : ''}` : undefined,
        discountAmount: disc.total,
        fineId: selectedFine ? String(selectedFine._id) : undefined,
        fineName: selectedFine ? selectedFine.name : undefined,
        fineAmount: result.fineAmount,
      })
    } catch (error) { result.error = error instanceof Error ? error.message : 'ข้อมูลไม่ถูกต้อง' }
  }
  results.sort((a, b) => a.rowNum - b.rowNum)
  const errors = results.filter(r => r.error).length
  const duplicates = results.filter(r => r.duplicate).length
  const token = digest({ documents, queueDocuments, results })
  const waiting = queueDocuments.filter(q => q.status === 'waiting').length
  const preview = { token, results, errors, duplicates, ready: documents.length + waiting, waiting,
    active: documents.filter(d => d.status === 'active').length, queued: queueDocuments.length,
    total: documents.reduce((sum, doc) => sum + Number(doc.totalFee), 0) }
  if (mode === 'preview') return NextResponse.json(preview)
  if (errors) return NextResponse.json({ error: `พบข้อมูลผิดพลาด ${errors} แถว กรุณาแก้ก่อนบันทึก`, ...preview }, { status: 400 })
  if (mode === 'commit' && body.token !== token) return NextResponse.json({ error: 'ข้อมูลหรืออัตราเปลี่ยนแปลง กรุณาตรวจสอบก่อนบันทึกอีกครั้ง' }, { status: 409 })
  if (!documents.length && !queueDocuments.length) return NextResponse.json({ created: 0, duplicates })
  const sessionDocs: (Record<string, unknown> & { _id: Types.ObjectId })[] = documents.map(d => ({ ...d, _id: new Types.ObjectId() }))
  const queueDocs = queueDocuments.map(q => {
    const session = sessionDocs.find(d => d.cardUid === q.cardUid && (d.entryTime as Date).getTime() === (q.joinedAt as Date).getTime())
    return { ...q, _id: session?._id ?? new Types.ObjectId(), sessionId: session ? String(session._id) : undefined }
  })
  try {
    if (queueDocs.length) await ParkingQueue.insertMany(queueDocs)
    if (sessionDocs.length) await ParkingSession.insertMany(sessionDocs)
  } catch (error) {
    // Remove only documents allocated by this failed import, including partial inserts.
    await ParkingSession.deleteMany({ _id: { $in: sessionDocs.map(d => d._id) } })
    await ParkingQueue.deleteMany({ _id: { $in: queueDocs.map(d => d._id) } })
    throw error
  }
  return NextResponse.json({ created: documents.length + waiting, duplicates, waiting, queued: queueDocuments.length }, { status: 201 })
}
const lockedPost = parkingMutation(handlePost)
export async function POST(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ' }, { status: 403 })
  return lockedPost(req)
}
