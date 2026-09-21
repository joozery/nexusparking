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
    car:            { $sum: { $cond: [{ $eq: ['$cardType', 'car'] },        '$totalFee', 0] } },
    motorcycle:     { $sum: { $cond: [{ $eq: ['$cardType', 'motorcycle'] }, '$totalFee', 0] } },
    overnight:      { $sum: { $cond: [{ $eq: ['$cardType', 'overnight'] },  '$totalFee', 0] } },
    overnightCount: { $sum: { $cond: [{ $eq: ['$cardType', 'overnight'] },  1, 0] } },
    lostFines:      { $sum: '$lostFine' },
  }

  const now = new Date()
  const periodHours = Math.max(1e-9, (refDate.getTime() - startDate.getTime()) / 3600000)

  const [daily, monthly, byType, summary, occupancyByType, hourlyRaw] = await Promise.all([
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
    // รวมแต่ละประเภท (+ ระยะเวลาเฉลี่ยต่อคัน)
    ParkingSession.aggregate([
      { $match: matchFilter },
      { $group: { _id: '$cardType', total: { $sum: '$totalFee' }, count: { $sum: 1 }, avg: { $avg: '$totalFee' }, avgDurationMin: { $avg: '$durationMin' } } },
    ]),
    // สรุปรวม
    ParkingSession.aggregate([
      { $match: matchFilter },
      { $group: { _id: null, total: { $sum: '$totalFee' }, count: { $sum: 1 }, avg: { $avg: '$totalFee' }, lostFines: { $sum: '$lostFine' }, maxFee: { $max: '$totalFee' } } },
    ]),
    // ค่าเฉลี่ยจำนวนรถในลาน แยกรถยนต์/มอเตอร์ไซค์ — เฉลี่ยจาก "vehicle-hours" ที่ทับซ้อนกับช่วงเวลาที่เลือก
    // หารด้วยความยาวของช่วงเวลานั้น (รวม session ที่ยังจอดอยู่ด้วย ไม่ใช่แค่ completed/lost)
    ParkingSession.aggregate([
      {
        $match: {
          status: { $ne: 'void' },
          entryTime: { $lte: refDate },
          $or: [{ exitTime: { $gte: startDate } }, { exitTime: null }, { exitTime: { $exists: false } }],
        },
      },
      {
        $addFields: {
          _overlapStart: { $max: ['$entryTime', startDate] },
          _overlapEnd:   { $min: [{ $ifNull: ['$exitTime', now] }, refDate] },
        },
      },
      {
        $addFields: {
          _overlapHours: { $max: [0, { $divide: [{ $subtract: ['$_overlapEnd', '$_overlapStart'] }, 3600000] }] },
          _bucket: { $cond: [{ $eq: ['$cardType', 'motorcycle'] }, 'motorcycle', 'car'] },
        },
      },
      { $group: { _id: '$_bucket', vehicleHours: { $sum: '$_overlapHours' } } },
    ]),
    // รายได้แยกตามชั่วโมงของวัน (0-23) — รวมทุกวันในช่วงที่เลือกเข้าด้วยกัน
    ParkingSession.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: { $hour: { date: '$exitTime', timezone: '+07:00' } },
          total: { $sum: '$totalFee' },
          count: { $sum: 1 },
        },
      },
    ]),
  ])

  const avgOccupancy: { car: number; motorcycle: number } = { car: 0, motorcycle: 0 }
  for (const row of occupancyByType as { _id: string; vehicleHours: number }[]) {
    if (row._id === 'car' || row._id === 'motorcycle') {
      avgOccupancy[row._id as 'car' | 'motorcycle'] = Math.round((row.vehicleHours / periodHours) * 10) / 10
    }
  }

  // เติมทุกชั่วโมง 0-23 ให้ครบ (ชั่วโมงไหนไม่มีข้อมูล = 0) แล้วคำนวณค่าเฉลี่ย/วันไว้ให้พร้อมใช้
  // (เผื่อช่วงที่เลือกยาวกว่า 1 วัน ฝั่ง UI จะได้สลับ sum/avg ได้โดยไม่ต้องคำนวณเพิ่ม)
  const periodDays = Math.max(1, Math.round((refDate.getTime() - startDate.getTime()) / 86400000))
  const hourlyByHour = new Map((hourlyRaw as { _id: number; total: number; count: number }[]).map(r => [r._id, r]))
  const hourly = Array.from({ length: 24 }, (_, hour) => {
    const row = hourlyByHour.get(hour)
    const total = row?.total ?? 0
    const count = row?.count ?? 0
    return {
      hour,
      total, count,
      avgTotal: Math.round((total / periodDays) * 100) / 100,
      avgCount: Math.round((count / periodDays) * 100) / 100,
    }
  })

  return NextResponse.json({
    period,
    startDate: startDate.toISOString(),
    endDate:   refDate.toISOString(),
    daily,
    monthly,
    byType,
    summary: summary[0] ?? { total: 0, count: 0, avg: 0, lostFines: 0, maxFee: 0 },
    avgOccupancy, // ค่าเฉลี่ยจำนวนรถในลาน (คัน) แยกรถยนต์/มอเตอร์ไซค์ ตลอดช่วงเวลาที่เลือก
    hourly,       // รายได้/จำนวนคันแยกตามชั่วโมง (0-23) รวมทุกวันในช่วงที่เลือก + ค่าเฉลี่ยต่อวัน
    periodDays,
  })
}
