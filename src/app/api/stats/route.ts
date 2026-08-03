import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ParkingSession } from '@/models/ParkingSession'

export async function GET() {
  await connectDB()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [
    activeSessions,
    todaySessions,
    todayRevenue,
    totalCapacity,
  ] = await Promise.all([
    ParkingSession.countDocuments({ status: 'active' }),
    ParkingSession.countDocuments({ entryTime: { $gte: todayStart } }),
    ParkingSession.aggregate([
      { $match: { status: { $in: ['completed', 'lost'] }, exitTime: { $gte: todayStart } } },
      { $group: { _id: null, total: { $sum: '$totalFee' } } },
    ]),
    200, // total capacity (config later)
  ])

  const revenue = (todayRevenue[0]?.total as number) ?? 0

  return NextResponse.json({
    activeCars:    activeSessions,
    availableSlots: totalCapacity - activeSessions,
    totalCapacity,
    todayEntries:  todaySessions,
    todayRevenue:  revenue,
  })
}
