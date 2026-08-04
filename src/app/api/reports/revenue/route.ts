import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ParkingSession } from '@/models/ParkingSession'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const period   = searchParams.get('period')   ?? 'week'
  const dateStr  = searchParams.get('date')
  const dateFrom = searchParams.get('dateFrom') // YYYY-MM-DD custom range start
  const dateTo   = searchParams.get('dateTo')   // YYYY-MM-DD custom range end

  await connectDB()

  let startDate: Date
  let refDate: Date

  if (dateFrom && dateTo) {
    startDate = new Date(dateFrom)
    startDate.setHours(0, 0, 0, 0)
    refDate = new Date(dateTo)
    refDate.setHours(23, 59, 59, 999)
  } else {
    refDate = dateStr ? new Date(dateStr) : new Date()
    refDate.setHours(23, 59, 59, 999)

    if (period === 'day') {
      startDate = new Date(refDate)
      startDate.setHours(0, 0, 0, 0)
    } else if (period === 'month') {
      startDate = new Date(refDate.getFullYear(), refDate.getMonth(), 1, 0, 0, 0, 0)
    } else if (period === 'year') {
      startDate = new Date(refDate.getFullYear(), refDate.getMonth() - 11, 1, 0, 0, 0, 0)
    } else {
      startDate = new Date(refDate)
      startDate.setDate(refDate.getDate() - 6)
      startDate.setHours(0, 0, 0, 0)
    }
  }

  const matchFilter = { status: { $in: ['completed', 'lost'] }, exitTime: { $gte: startDate, $lte: refDate } }
  const typeFields  = {
    car:        { $sum: { $cond: [{ $eq: ['$cardType', 'car'] },        '$totalFee', 0] } },
    motorcycle: { $sum: { $cond: [{ $eq: ['$cardType', 'motorcycle'] }, '$totalFee', 0] } },
    overnight:  { $sum: { $cond: [{ $eq: ['$cardType', 'overnight'] },  '$totalFee', 0] } },
    lostFines:  { $sum: '$lostFine' },
  }

  const [daily, monthly, byType, summary] = await Promise.all([
    // รายได้แต่ละวัน
    ParkingSession.aggregate([
      { $match: matchFilter },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$exitTime', timezone: '+07:00' } }, total: { $sum: '$totalFee' }, count: { $sum: 1 }, ...typeFields } },
      { $sort: { _id: 1 } },
    ]),
    // รายได้รายเดือน (12 เดือนล่าสุด เสมอ)
    ParkingSession.aggregate([
      { $match: { status: { $in: ['completed', 'lost'] }, exitTime: { $gte: new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1, 0, 0, 0, 0), $lte: new Date() } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$exitTime', timezone: '+07:00' } }, total: { $sum: '$totalFee' }, count: { $sum: 1 }, ...typeFields } },
      { $sort: { _id: 1 } },
    ]),
    // รวมแต่ละประเภท
    ParkingSession.aggregate([
      { $match: matchFilter },
      { $group: { _id: '$cardType', total: { $sum: '$totalFee' }, count: { $sum: 1 }, avg: { $avg: '$totalFee' } } },
    ]),
    // สรุปรวม
    ParkingSession.aggregate([
      { $match: matchFilter },
      { $group: { _id: null, total: { $sum: '$totalFee' }, count: { $sum: 1 }, avg: { $avg: '$totalFee' }, lostFines: { $sum: '$lostFine' }, maxFee: { $max: '$totalFee' } } },
    ]),
  ])

  return NextResponse.json({
    period,
    startDate: startDate.toISOString(),
    endDate:   refDate.toISOString(),
    daily,
    monthly,
    byType,
    summary: summary[0] ?? { total: 0, count: 0, avg: 0, lostFines: 0, maxFee: 0 },
  })
}
