import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ParkingSession } from '@/models/ParkingSession'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') ?? 'week' // day | week | month
  const dateStr = searchParams.get('date') // YYYY-MM-DD, default today

  await connectDB()

  const refDate = dateStr ? new Date(dateStr) : new Date()
  refDate.setHours(23, 59, 59, 999)

  let startDate: Date
  if (period === 'day') {
    startDate = new Date(refDate)
    startDate.setHours(0, 0, 0, 0)
  } else if (period === 'month') {
    startDate = new Date(refDate.getFullYear(), refDate.getMonth(), 1, 0, 0, 0, 0)
  } else {
    // week — 7 วันย้อนหลัง
    startDate = new Date(refDate)
    startDate.setDate(refDate.getDate() - 6)
    startDate.setHours(0, 0, 0, 0)
  }

  const [daily, byType, summary] = await Promise.all([
    // รายได้แต่ละวัน
    ParkingSession.aggregate([
      { $match: { status: { $in: ['completed', 'lost'] }, exitTime: { $gte: startDate, $lte: refDate } } },
      { $group: {
        _id:          { $dateToString: { format: '%Y-%m-%d', date: '$exitTime', timezone: '+07:00' } },
        total:        { $sum: '$totalFee' },
        count:        { $sum: 1 },
        car:          { $sum: { $cond: [{ $eq: ['$cardType', 'car'] },        '$totalFee', 0] } },
        motorcycle:   { $sum: { $cond: [{ $eq: ['$cardType', 'motorcycle'] }, '$totalFee', 0] } },
        overnight:    { $sum: { $cond: [{ $eq: ['$cardType', 'overnight'] },  '$totalFee', 0] } },
        lostFines:    { $sum: '$lostFine' },
      }},
      { $sort: { _id: 1 } },
    ]),
    // รวมแต่ละประเภท
    ParkingSession.aggregate([
      { $match: { status: { $in: ['completed', 'lost'] }, exitTime: { $gte: startDate, $lte: refDate } } },
      { $group: {
        _id:   '$cardType',
        total: { $sum: '$totalFee' },
        count: { $sum: 1 },
        avg:   { $avg: '$totalFee' },
      }},
    ]),
    // สรุปรวม
    ParkingSession.aggregate([
      { $match: { status: { $in: ['completed', 'lost'] }, exitTime: { $gte: startDate, $lte: refDate } } },
      { $group: {
        _id:       null,
        total:     { $sum: '$totalFee' },
        count:     { $sum: 1 },
        avg:       { $avg: '$totalFee' },
        lostFines: { $sum: '$lostFine' },
        maxFee:    { $max: '$totalFee' },
      }},
    ]),
  ])

  return NextResponse.json({
    period,
    startDate: startDate.toISOString(),
    endDate:   refDate.toISOString(),
    daily,
    byType,
    summary: summary[0] ?? { total: 0, count: 0, avg: 0, lostFines: 0, maxFee: 0 },
  })
}
