import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ParkingSession } from '@/models/ParkingSession'
import { getSettings } from '@/models/SystemSettings'

export async function GET() {
  await connectDB()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [activeSessions, todaySessions, todayRevenue, settings] = await Promise.all([
    ParkingSession.countDocuments({ status: 'active' }),
    ParkingSession.countDocuments({ entryTime: { $gte: todayStart } }),
    ParkingSession.aggregate([
      { $match: { status: { $in: ['completed', 'lost'] }, exitTime: { $gte: todayStart } } },
      { $group: { _id: null, total: { $sum: '$totalFee' } } },
    ]),
    getSettings(),
  ])

  const totalCapacity = settings.capacity.car + settings.capacity.motorcycle
  const revenue = (todayRevenue[0]?.total as number) ?? 0

  return NextResponse.json({
    activeCars:     activeSessions,
    availableSlots: totalCapacity - activeSessions,
    totalCapacity,
    capacityCar:        settings.capacity.car,
    capacityMotorcycle: settings.capacity.motorcycle,
    todayEntries:  todaySessions,
    todayRevenue:  revenue,
  })
}
