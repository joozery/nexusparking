import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ParkingSession, type IParkingSession } from '@/models/ParkingSession'
import { ParkingCard } from '@/models/ParkingCard'
import { ParkingQueue } from '@/models/ParkingQueue'
import { getSettings } from '@/models/SystemSettings'
import { calcFeeBreakdown } from '@/lib/calcFee'
import { getTodayStartTH } from '@/lib/dateTh'

// 'overnight' card-type sessions are physically cars, so they're folded into the "car" bucket
// everywhere in this route — the queue model doesn't have an 'overnight' type at all.
const CAR_TYPES = ['car', 'overnight'] as const

export async function GET() {
  await connectDB()

  const now = new Date()
  const todayStart = getTodayStartTH()

  const settings = await getSettings()

  const [carActive, motoActive, carLost, motoLost, carOnlyCards, overnightCards, motoCards, carQueueWaiting, motoQueueWaiting, carMonthlyCards, motoMonthlyCards] = await Promise.all([
    ParkingSession.find({ cardType: { $in: CAR_TYPES }, status: 'active' }).lean(),
    ParkingSession.find({ cardType: 'motorcycle', status: 'active' }).lean(),
    ParkingSession.find({ cardType: { $in: CAR_TYPES }, lostFine: { $gt: 0 } }).lean(),
    ParkingSession.find({ cardType: 'motorcycle', lostFine: { $gt: 0 } }).lean(),
    ParkingCard.countDocuments({ type: 'car', isActive: true }),
    ParkingCard.countDocuments({ type: 'overnight', isActive: true }),
    ParkingCard.countDocuments({ type: 'motorcycle', isActive: true }),
    ParkingQueue.countDocuments({ cardType: 'car', status: 'waiting' }),
    ParkingQueue.countDocuments({ cardType: 'motorcycle', status: 'waiting' }),
    ParkingCard.countDocuments({ type: { $in: CAR_TYPES }, cardCategory: 'monthly', isActive: true }),
    ParkingCard.countDocuments({ type: 'motorcycle', cardCategory: 'monthly', isActive: true }),
  ])
  const carCards = carOnlyCards + overnightCards
  // Legacy cards without a category are temporary, matching the registration default.
  const [enabledCards, waitingCards] = await Promise.all([
    ParkingCard.find({ isActive: true }).select('uid type cardCategory').lean(),
    ParkingQueue.find({ status: 'waiting' }).select('cardUid').lean(),
  ])
  const occupiedUids = new Set([
    ...carActive.map(session => session.cardUid),
    ...motoActive.map(session => session.cardUid),
    ...waitingCards.map(queue => queue.cardUid),
  ])
  function temporaryCounts(types: readonly string[]) {
    const cards = enabledCards.filter(card => types.includes(card.type) && (!card.cardCategory || card.cardCategory === 'temporary'))
    const monthlyCards = enabledCards.filter(card => types.includes(card.type) && card.cardCategory === 'monthly')
    return {
      temporaryCardsRegistered: cards.length,
      temporaryCardsInUse: cards.filter(card => occupiedUids.has(card.uid)).length,
      temporaryCardsRemaining: cards.filter(card => !occupiedUids.has(card.uid)).length,
      monthlyCardsRemaining: monthlyCards.filter(card => !occupiedUids.has(card.uid)).length,
    }
  }

  // "เข้าวันนี้" นับรวมรถที่ยังรอ/ยกเลิกอยู่ในคิวด้วย เพราะไม้กั้นเปิด+ถ่ายรูปไปแล้วตอนเข้าคิว
  // ถือว่าเข้าพื้นที่จริงแล้ว แม้ยังไม่ได้เป็น session — รถที่ถูกโปรโมทจากคิวเข้า session แล้ว
  // (status:'entered') จะถูกนับผ่าน ParkingSession ด้านล่างแทน ไม่นับซ้ำตรงนี้
  const [carSessionsToday, carOutToday, motoSessionsToday, motoOutToday, carQueueToday, motoQueueToday] = await Promise.all([
    ParkingSession.countDocuments({ cardType: { $in: CAR_TYPES }, entryTime: { $gte: todayStart } }),
    ParkingSession.countDocuments({ cardType: { $in: CAR_TYPES }, status: 'completed', exitTime: { $gte: todayStart } }),
    ParkingSession.countDocuments({ cardType: 'motorcycle', entryTime: { $gte: todayStart } }),
    ParkingSession.countDocuments({ cardType: 'motorcycle', status: 'completed', exitTime: { $gte: todayStart } }),
    ParkingQueue.countDocuments({ cardType: 'car', status: { $in: ['waiting', 'cancelled'] }, joinedAt: { $gte: todayStart } }),
    ParkingQueue.countDocuments({ cardType: 'motorcycle', status: { $in: ['waiting', 'cancelled'] }, joinedAt: { $gte: todayStart } }),
  ])
  const carInToday  = carSessionsToday + carQueueToday
  const motoInToday = motoSessionsToday + motoQueueToday

  // "ค้างคืน" = active session ที่ตอนนี้กำลังโดนคิดอัตราค้างคืนอยู่ (ไม่ใช่ประเภทบัตร) — เช็คจาก breakdown จริง
  function splitByBillingMode(sessions: IParkingSession[]) {
    let overnight = 0
    for (const s of sessions) {
      const breakdown = calcFeeBreakdown(s.cardType, s.entryTime, now, settings.rates.overnight)
      if (breakdown.segments.some(seg => seg.kind === 'overnight')) overnight++
    }
    return { normal: sessions.length - overnight, overnight }
  }

  const lostToday = (sessions: IParkingSession[]) =>
    sessions.filter(s => (s.exitTime ?? s.entryTime) >= todayStart).length

  const lostSessionsToday = [...carLost, ...motoLost].filter(s => (s.exitTime ?? s.entryTime) >= todayStart)
  // Include disabled cards: disabling a lost card must not remove its history.
  const lostCards = await ParkingCard.find({ uid: { $in: lostSessionsToday.map(s => s.cardUid) } })
    .select('uid cardCategory').lean()
  const lostCategories = new Map(lostCards.map(card => [card.uid, card.cardCategory ?? 'temporary']))
  function lostByCategory(sessions: IParkingSession[]) {
    const today = sessions.filter(s => (s.exitTime ?? s.entryTime) >= todayStart)
    const unknown = today.some(s => !lostCategories.has(s.cardUid))
    return {
      lostTemporaryToday: unknown ? null : today.filter(s => lostCategories.get(s.cardUid) === 'temporary').length,
      lostMonthlyToday: unknown ? null : today.filter(s => lostCategories.get(s.cardUid) === 'monthly').length,
    }
  }

  const carSplit  = splitByBillingMode(carActive)
  const motoSplit = splitByBillingMode(motoActive)

  // จำนวนรถที่ใช้ "บัตร" แต่ละประเภทอยู่ในลานตอนนี้ (แยกตามประเภทบัตรที่ลงทะเบียนไว้จริง
  // ไม่ใช่โหมดคิดค่าบริการแบบ activeNormal/activeOvernight ด้านบน)
  const activeOvernightCards = carActive.filter(s => s.cardType === 'overnight').length
  const activeCarCards       = carActive.filter(s => s.cardType === 'car').length

  return NextResponse.json({
    car: {
      ...temporaryCounts(CAR_TYPES),
      ...lostByCategory(carLost),
      inToday:           carInToday,
      outToday:          carOutToday,
      activeTotal:       carActive.length,
      activeNormal:      carSplit.normal,
      activeOvernight:   carSplit.overnight,
      capacityTotal:     settings.capacity.car,
      capacityAvailable: Math.max(0, settings.capacity.car - carActive.length),
      queueWaiting:      carQueueWaiting,
      cardsRegistered:   carCards,
      monthlyCardsRegistered: carMonthlyCards,
      cardsRemaining:    Math.max(0, carCards - carActive.length),
      overnightCardsRegistered: overnightCards,
      overnightCardsRemaining:  Math.max(0, overnightCards - activeOvernightCards),
      normalCardsRegistered:    carOnlyCards,
      normalCardsRemaining:     Math.max(0, carOnlyCards - activeCarCards),
      lostToday:         lostToday(carLost),
    },
    motorcycle: {
      ...temporaryCounts(['motorcycle']),
      ...lostByCategory(motoLost),
      inToday:           motoInToday,
      outToday:          motoOutToday,
      activeTotal:       motoActive.length,
      activeNormal:      motoSplit.normal,
      activeOvernight:   motoSplit.overnight,
      capacityTotal:     settings.capacity.motorcycle,
      capacityAvailable: Math.max(0, settings.capacity.motorcycle - motoActive.length),
      queueWaiting:      motoQueueWaiting,
      cardsRegistered:   motoCards,
      monthlyCardsRegistered: motoMonthlyCards,
      cardsRemaining:    Math.max(0, motoCards - motoActive.length),
      lostToday:         lostToday(motoLost),
    },
  })
}
