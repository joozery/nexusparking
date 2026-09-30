import { ParkingSession } from '@/models/ParkingSession'
import { ParkingQueue } from '@/models/ParkingQueue'
import { ParkingCard } from '@/models/ParkingCard'
import { Shift } from '@/models/Shift'
import { cardVisitError, type CardVisit } from './cardTimeline'

export async function loadCardTimeline(uids: string[], excludeQueueId?: string) {
  const [sessions, queues, shifts] = await Promise.all([
    ParkingSession.find({ cardUid: { $in: uids }, status: { $ne: 'void' } }).lean(),
    ParkingQueue.find({ cardUid: { $in: uids }, status: 'waiting' }).lean(),
    Shift.find({ 'cardRefunds.cardUid': { $in: uids } }).select('cardRefunds').lean(),
  ])
  const history: CardVisit[] = [...sessions, ...queues.filter(q => String(q._id) !== excludeQueueId).map(q => ({
    _id: `queue:${q._id}`, cardUid: q.cardUid ?? '', entryTime: q.joinedAt, status: 'active', lostCard: q.lostCard,
  }))]
  const returns = new Map<string, Date>()
  for (const shift of shifts) for (const refund of shift.cardRefunds ?? []) returns.set(refund.sessionId, new Date(refund.refundedAt))
  return { history, returns }
}

export async function validateRegisteredVisit(visit: CardVisit, cardType?: string, excludeQueueId?: string) {
  const card = await ParkingCard.findOne({ uid: visit.cardUid, isActive: true }).lean()
  if (!card) return 'ไม่พบบัตรที่เปิดใช้งานในระบบ'
  if (cardType && card.type !== cardType) return 'ประเภทรถไม่ตรงกับบัตรที่ลงทะเบียน'
  if (card.expiryDate && new Date(card.expiryDate) < visit.entryTime) return 'บัตรหมดอายุก่อนเวลาเข้าของรายการนี้'
  const { history, returns } = await loadCardTimeline([visit.cardUid], excludeQueueId)
  return cardVisitError(visit, history, returns)
}
