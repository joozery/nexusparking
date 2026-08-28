import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ParkingSession, type IParkingSession } from '@/models/ParkingSession'
import { ParkingCard } from '@/models/ParkingCard'
import { ParkingQueue } from '@/models/ParkingQueue'
import { getSettings } from '@/models/SystemSettings'
import { calcFeeBreakdown } from '@/lib/calcFee'

// 'overnight' card-type sessions are physically cars, so they're folded into the "car" bucket
// everywhere in this route — the queue model doesn't have an 'overnight' type at all.
const CAR_TYPES = ['car', 'overnight'] as const

export async function GET() {
  await connectDB()

  const now = new Date()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const settings = await getSettings()
  const afterHoursCfg = {
    start: settings.businessHours.close,
    end:   settings.businessHours.open,
    fine:  settings.afterHoursFine,
  }

  const [carActive, motoActive, carLost, motoLost, carCards, motoCards, carQueueWaiting] = await Promise.all([
    ParkingSession.find({ cardType: { $in: CAR_TYPES }, status: 'active' }).lean(),
    ParkingSession.find({ cardType: 'motorcycle', status: 'active' }).lean(),
    ParkingSession.find({ cardType: { $in: CAR_TYPES }, lostFine: { $gt: 0 } }).lean(),
    ParkingSession.find({ cardType: 'motorcycle', lostFine: { $gt: 0 } }).lean(),
    ParkingCard.countDocuments({ type: { $in: CAR_TYPES }, isActive: true }),
    ParkingCard.countDocuments({ type: 'motorcycle', isActive: true }),
    ParkingQueue.countDocuments({ cardType: 'car', status: 'waiting' }),
  ])

  const [carInToday, carOutToday, motoInToday, motoOutToday] = await Promise.all([
    ParkingSession.countDocuments({ cardType: { $in: CAR_TYPES }, entryTime: { $gte: todayStart } }),
    ParkingSession.countDocuments({ cardType: { $in: CAR_TYPES }, status: 'completed', exitTime: { $gte: todayStart } }),
    ParkingSession.countDocuments({ cardType: 'motorcycle', entryTime: { $gte: todayStart } }),
    ParkingSession.countDocuments({ cardType: 'motorcycle', status: 'completed', exitTime: { $gte: todayStart } }),
  ])

  // "ค้างคืน" = active session ที่ตอนนี้กำลังโดนคิดอัตราค้างคืนอยู่ (ไม่ใช่ประเภทบัตร) — เช็คจาก breakdown จริง
  function splitByBillingMode(sessions: IParkingSession[]) {
    let overnight = 0
    for (const s of sessions) {
      const breakdown = calcFeeBreakdown(s.cardType, s.entryTime, now, settings.rates.overnight, afterHoursCfg)
      if (breakdown.segments.some(seg => seg.kind === 'overnight')) overnight++
    }
    return { normal: sessions.length - overnight, overnight }
  }

  const lostToday = (sessions: IParkingSession[]) =>
    sessions.filter(s => (s.exitTime ?? s.entryTime) >= todayStart).length

  const carSplit  = splitByBillingMode(carActive)
  const motoSplit = splitByBillingMode(motoActive)

  return NextResponse.json({
    car: {
      inToday:           carInToday,
      outToday:          carOutToday,
      activeTotal:       carActive.length,
      activeNormal:      carSplit.normal,
      activeOvernight:   carSplit.overnight,
      capacityTotal:     settings.capacity.car,
      capacityAvailable: Math.max(0, settings.capacity.car - carActive.length),
      queueWaiting:      carQueueWaiting,
      cardsRegistered:   carCards,
      cardsRemaining:    Math.max(0, carCards - carActive.length),
      lostToday:         lostToday(carLost),
    },
    motorcycle: {
      inToday:         motoInToday,
      outToday:        motoOutToday,
      activeTotal:     motoActive.length,
      activeNormal:    motoSplit.normal,
      activeOvernight: motoSplit.overnight,
      cardsRegistered: motoCards,
      cardsRemaining:  Math.max(0, motoCards - motoActive.length),
      lostToday:       lostToday(motoLost),
    },
  })
}
