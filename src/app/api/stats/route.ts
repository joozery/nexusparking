import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ParkingSession } from '@/models/ParkingSession'
import { getSettings } from '@/models/SystemSettings'
import { getTodayStartTH } from '@/lib/dateTh'
import { calcFeeBreakdown } from '@/lib/calcFee'

// Car and motorcycle parking are separate lots — 'overnight' is physically a car.
const CAR_TYPES = ['car', 'overnight'] as const

export async function GET() {
  await connectDB()

  const todayStart = getTodayStartTH()
  const now = new Date()

  const [carActive, motoActive, todayEntrySessions, todayRevenueByMethod, settings] = await Promise.all([
    ParkingSession.countDocuments({ cardType: { $in: CAR_TYPES }, status: 'active' }),
    ParkingSession.countDocuments({ cardType: 'motorcycle', status: 'active' }),
    // Need the actual rows (not just a count) to classify each by billing mode below.
    ParkingSession.find({ entryTime: { $gte: todayStart } }).lean(),
    ParkingSession.aggregate([
      { $match: { status: { $in: ['completed', 'lost'] }, exitTime: { $gte: todayStart } } },
      { $group: { _id: '$paymentMethod', total: { $sum: '$totalFee' } } },
    ]),
    getSettings(),
  ])

  const activeSessions = carActive + motoActive
  const totalCapacity  = settings.capacity.car + settings.capacity.motorcycle

  const cashRevenue = (todayRevenueByMethod.find(r => r._id === 'cash')?.total as number) ?? 0
  const qrRevenue    = (todayRevenueByMethod.find(r => r._id === 'qr')?.total as number) ?? 0
  const otherRevenue = todayRevenueByMethod
    .filter(r => r._id !== 'cash' && r._id !== 'qr')
    .reduce((sum, r) => sum + ((r.total as number) ?? 0), 0)
  const revenue = cashRevenue + qrRevenue + otherRevenue

  // "รถเข้าวันนี้" split into 4 buckets: car/motorcycle × normal/overnight billing mode.
  // Billing mode is worked out from the session's actual fee breakdown (crossing the
  // overnight window), not the stored cardType — a motorcycle can be billed overnight too.
  let carNormal = 0, carOvernight = 0, motoNormal = 0, motoOvernight = 0
  for (const s of todayEntrySessions) {
    const isCar = (CAR_TYPES as readonly string[]).includes(s.cardType)
    const breakdown = calcFeeBreakdown(s.cardType, s.entryTime, s.exitTime ?? now, settings.rates.overnight)
    const isOvernight = breakdown.segments.some(seg => seg.kind === 'overnight')
    if (isCar && isOvernight)       carOvernight++
    else if (isCar)                 carNormal++
    else if (isOvernight)           motoOvernight++
    else                            motoNormal++
  }

  return NextResponse.json({
    // Combined totals — kept for widgets that show one overall lot occupancy figure.
    activeCars:     activeSessions,
    availableSlots: totalCapacity - activeSessions,
    totalCapacity,
    capacityCar:        settings.capacity.car,
    capacityMotorcycle: settings.capacity.motorcycle,
    todayEntries:  todayEntrySessions.length,
    todayRevenue:  revenue,
    // Per-lot breakdown — car and motorcycle parking are tracked as separate pools.
    car: {
      active:    carActive,
      capacity:  settings.capacity.car,
      available: Math.max(0, settings.capacity.car - carActive),
    },
    motorcycle: {
      active:    motoActive,
      capacity:  settings.capacity.motorcycle,
      available: Math.max(0, settings.capacity.motorcycle - motoActive),
    },
    // Today's revenue split by payment method (sums to todayRevenue).
    todayRevenueByMethod: {
      cash:  cashRevenue,
      qr:    qrRevenue,
      other: otherRevenue,
    },
    // Today's entries split by vehicle type × billing mode (sums to todayEntries).
    todayEntriesByType: {
      car:                 carNormal,
      motorcycle:          motoNormal,
      overnightCar:        carOvernight,
      overnightMotorcycle: motoOvernight,
    },
  })
}
