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
  const afterHoursCfg = {
    start: settings.businessHours.close,
    end:   settings.businessHours.open,
    fine:  settings.afterHoursFine,
  }

  const [carActive, motoActive, carLost, motoLost, carCards, motoCards, carQueueWaiting, motoQueueWaiting] = await Promise.all([
    ParkingSession.find({ cardType: { $in: CAR_TYPES }, status: 'active' }).lean(),
    ParkingSession.find({ cardType: 'motorcycle', status: 'active' }).lean(),
    ParkingSession.find({ cardType: { $in: CAR_TYPES }, lostFine: { $gt: 0 } }).lean(),
    ParkingSession.find({ cardType: 'motorcycle', lostFine: { $gt: 0 } }).lean(),
    ParkingCard.countDocuments({ type: { $in: CAR_TYPES }, isActive: true }),
    ParkingCard.countDocuments({ type: 'motorcycle', isActive: true }),
    ParkingQueue.countDocuments({ cardType: 'car', status: 'waiting' }),
    ParkingQueue.countDocuments({ cardType: 'motorcycle', status: 'waiting' }),
  ])

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
      inToday:           motoInToday,
      outToday:          motoOutToday,
      activeTotal:       motoActive.length,
      activeNormal:      motoSplit.normal,
      activeOvernight:   motoSplit.overnight,
      capacityTotal:     settings.capacity.motorcycle,
      capacityAvailable: Math.max(0, settings.capacity.motorcycle - motoActive.length),
      queueWaiting:      motoQueueWaiting,
      cardsRegistered:   motoCards,
      cardsRemaining:    Math.max(0, motoCards - motoActive.length),
      lostToday:         lostToday(motoLost),
    },
  })
}
