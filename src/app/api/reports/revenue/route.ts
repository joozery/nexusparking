import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ParkingSession } from '@/models/ParkingSession'
import { Shift } from '@/models/Shift'
import { getSettings } from '@/models/SystemSettings'
import { calcFeeBreakdown } from '@/lib/calcFee'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const period   = searchParams.get('period')   ?? 'week'
  const dateStr  = searchParams.get('date')
  const dateFrom = searchParams.get('dateFrom') // YYYY-MM-DD custom range start
  const dateTo   = searchParams.get('dateTo')   // YYYY-MM-DD custom range end

  await connectDB()

  let startDate: Date
  let refDate: Date
  const thaiDate = (value: string, endOfDay = false) =>
    new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+07:00`)

  if (dateFrom && dateTo) {
    startDate = thaiDate(dateFrom)
    refDate = thaiDate(dateTo, true)
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
  const reportSessionFilter = {
    status: { $in: ['completed', 'lost'] as const },
    exitTime: { $gte: startDate, $lte: refDate },
  }
  const typeFields  = {
    car:            { $sum: { $cond: [{ $eq: ['$cardType', 'car'] },        '$totalFee', 0] } },
    motorcycle:     { $sum: { $cond: [{ $eq: ['$cardType', 'motorcycle'] }, '$totalFee', 0] } },
    overnight:      { $sum: { $cond: [{ $eq: ['$cardType', 'overnight'] },  '$totalFee', 0] } },
    overnightCount: { $sum: { $cond: [{ $eq: ['$cardType', 'overnight'] },  1, 0] } },
    lostFines:      { $sum: '$lostFine' },
  }

  const now = new Date()
  const periodHours = Math.max(1e-9, (refDate.getTime() - startDate.getTime()) / 3600000)
  const monthlyStart = new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1, 0, 0, 0, 0)
  const monthlySessionFilter = {
    status: { $in: ['completed', 'lost'] as const },
    exitTime: { $gte: monthlyStart, $lte: new Date() },
  }

  const [reportSettings, reportSessions, monthlySessions] = await Promise.all([
    getSettings(),
    ParkingSession.find(reportSessionFilter).select('cardUid cardType entryTime exitTime fee durationMin lostFine lostCard status fineName fineAmount').lean(),
    ParkingSession.find(monthlySessionFilter).select('cardType entryTime exitTime fee').lean(),
  ])
  const classifySession = (session: { cardType: 'car' | 'motorcycle' | 'overnight'; entryTime: Date; exitTime?: Date }) => {
    const overnight = session.cardType === 'overnight' || (
      session.exitTime != null && calcFeeBreakdown(session.cardType, session.entryTime, session.exitTime, reportSettings.rates.overnight)
        .segments.some(segment => segment.kind === 'overnight')
    )
    return overnight
      ? session.cardType === 'motorcycle' ? 'overnightMotorcycle' : 'overnightCar'
      : session.cardType === 'motorcycle' ? 'motorcycle' : 'car'
  }
  const typeTotals = new Map<string, { total: number; count: number; duration: number }>([
    ['car', { total: 0, count: 0, duration: 0 }],
    ['motorcycle', { total: 0, count: 0, duration: 0 }],
    ['overnightCar', { total: 0, count: 0, duration: 0 }],
    ['overnightMotorcycle', { total: 0, count: 0, duration: 0 }],
  ])
  for (const session of reportSessions) {
    const key = classifySession(session)
    const row = typeTotals.get(key)!
    row.total += session.fee ?? 0
    row.count += 1
    row.duration += session.durationMin ?? 0
  }
  const reportByType = [...typeTotals.entries()].map(([key, row]) => ({
    _id: key,
    total: row.total,
    count: row.count,
    avg: row.count ? row.total / row.count : 0,
    avgDurationMin: row.count ? row.duration / row.count : 0,
  }))
  const fineTotals = new Map<string, number>()
  for (const session of reportSessions) {
    if ((session.lostFine ?? 0) > 0) {
      fineTotals.set('ค่าปรับบัตรหาย', (fineTotals.get('ค่าปรับบัตรหาย') ?? 0) + session.lostFine)
    }
    if ((session.fineAmount ?? 0) > 0) {
      const name = session.fineName?.trim() || 'ค่าปรับทั่วไป'
      fineTotals.set(name, (fineTotals.get(name) ?? 0) + session.fineAmount)
    }
  }
  const fineBreakdown = [...fineTotals.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)

  const monthKey = (value: Date) => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit' }).formatToParts(value)
    return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}`
  }
  const hourKey = (value: Date) => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', hour: '2-digit', hourCycle: 'h23' }).format(value))
  const monthlyMap = new Map<string, { total: number; count: number; car: number; motorcycle: number; carOvernight: number; motorcycleOvernight: number }>()
  for (let i = 0; i < 12; i++) {
    const date = new Date(new Date().getFullYear(), new Date().getMonth() - 11 + i, 1)
    monthlyMap.set(monthKey(date), { total: 0, count: 0, car: 0, motorcycle: 0, carOvernight: 0, motorcycleOvernight: 0 })
  }
  for (const session of monthlySessions) {
    if (!session.exitTime) continue
    const row = monthlyMap.get(monthKey(session.exitTime))
    if (!row) continue
    const key = classifySession(session)
    const fee = session.fee ?? 0
    row.total += fee
    row.count += 1
    if (key === 'car') row.car += fee
    if (key === 'motorcycle') row.motorcycle += fee
    if (key === 'overnightCar') row.carOvernight += fee
    if (key === 'overnightMotorcycle') row.motorcycleOvernight += fee
  }
  const monthlyReport = [...monthlyMap.entries()].map(([id, row]) => ({
    _id: id,
    ...row,
    overnight: row.carOvernight + row.motorcycleOvernight,
    overnightCount: 0,
    lostFines: 0,
  }))

  const hourlyMap = Array.from({ length: 24 }, (_, hour) => ({
    hour, total: 0, count: 0, car: 0, motorcycle: 0, carOvernight: 0, motorcycleOvernight: 0,
  }))
  for (const session of reportSessions) {
    if (!session.exitTime) continue
    const row = hourlyMap[hourKey(session.exitTime)]
    const key = classifySession(session)
    const fee = session.fee ?? 0
    row.total += fee
    row.count += 1
    if (key === 'car') row.car += fee
    if (key === 'motorcycle') row.motorcycle += fee
    if (key === 'overnightCar') row.carOvernight += fee
    if (key === 'overnightMotorcycle') row.motorcycleOvernight += fee
  }
  const hourlyReport = hourlyMap.map(row => ({
    ...row,
    avgTotal: Math.round((row.total / Math.max(1, Math.round((refDate.getTime() - startDate.getTime()) / 86400000))) * 100) / 100,
    avgCount: Math.round((row.count / Math.max(1, Math.round((refDate.getTime() - startDate.getTime()) / 86400000))) * 100) / 100,
  }))
  const [daily, monthly, summary, refundSummary, occupancyByType, hourlyRaw] = await Promise.all([
    // รายได้แต่ละวัน
    ParkingSession.aggregate([
      { $match: matchFilter },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$exitTime', timezone: '+07:00' } }, total: { $sum: '$totalFee' }, count: { $sum: 1 }, lostCardUids: { $addToSet: { $cond: [{ $gt: ['$lostFine', 0] }, '$cardUid', null] } }, ...typeFields } },
      { $sort: { _id: 1 } },
    ]),
    // รายได้รายเดือน (12 เดือนล่าสุด เสมอ)
    ParkingSession.aggregate([
      { $match: { status: { $in: ['completed', 'lost'] }, exitTime: { $gte: new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1, 0, 0, 0, 0), $lte: new Date() } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$exitTime', timezone: '+07:00' } }, total: { $sum: '$totalFee' }, count: { $sum: 1 }, ...typeFields } },
      { $sort: { _id: 1 } },
    ]),
    // รวมแต่ละประเภท (+ ระยะเวลาเฉลี่ยต่อคัน)
    // สรุปรวม
    ParkingSession.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalFee' },
          count: { $sum: 1 },
          avg: { $avg: '$totalFee' },
          lostFines: { $sum: '$lostFine' },
          maxFee: { $max: '$totalFee' },
          cash: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$totalFee', 0] } },
          transfer: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'qr'] }, '$totalFee', 0] } },
        },
      },
    ]),
    // ยอดคืนค่าปรับบัตรหายตามวันที่คืนเงินจริง
    Shift.aggregate([
      { $unwind: '$cardRefunds' },
      { $match: { 'cardRefunds.refundedAt': { $gte: startDate, $lte: refDate } } },
      {
        $group: {
          _id: null,
          total: { $sum: '$cardRefunds.amount' },
          count: { $sum: 1 },
          cash: { $sum: { $cond: [{ $eq: ['$cardRefunds.paymentMethod', 'cash'] }, '$cardRefunds.amount', 0] } },
          transfer: { $sum: { $cond: [{ $eq: ['$cardRefunds.paymentMethod', 'qr'] }, '$cardRefunds.amount', 0] } },
        },
      },
    ]),
    // ค่าเฉลี่ยจำนวนรถในลาน แยกรถยนต์/รถจักรยานยนต์ — เฉลี่ยจาก "vehicle-hours" ที่ทับซ้อนกับช่วงเวลาที่เลือก
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
  const dailyReport = daily.map(row => ({
    ...row,
    lostCardCount: (row.lostCardUids ?? []).filter(Boolean).length,
  }))
  const lostCardCount = new Set(reportSessions
    .filter(session => session.lostCard === true || (session.lostFine ?? 0) > 0 || session.status === 'lost')
    .map(session => session.cardUid)
    .filter(Boolean)).size
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
  void monthly
  void hourly

  return NextResponse.json({
    period,
    startDate: startDate.toISOString(),
    endDate:   refDate.toISOString(),
    daily: dailyReport,
    monthly: monthlyReport,
    byType: reportByType,
    summary: {
      ...(summary[0] ?? { total: 0, count: 0, avg: 0, lostFines: 0, maxFee: 0 }),
      total: Math.max(0, (summary[0]?.total ?? 0) - (refundSummary[0]?.total ?? 0)),
      avg: summary[0]?.count
        ? Math.max(0, (summary[0].total - (refundSummary[0]?.total ?? 0)) / summary[0].count)
        : 0,
      cash: Math.max(0, (summary[0]?.cash ?? 0) - (refundSummary[0]?.cash ?? 0)),
      transfer: Math.max(0, (summary[0]?.transfer ?? 0) - (refundSummary[0]?.transfer ?? 0)),
      lostFineRefunds: refundSummary[0]?.total ?? 0,
      lostFineRefundCount: refundSummary[0]?.count ?? 0,
      lostFineRefundCash: refundSummary[0]?.cash ?? 0,
      lostFineRefundTransfer: refundSummary[0]?.transfer ?? 0,
      lostCardCount,
      fineTotal: fineBreakdown.reduce((sum, row) => sum + row.total, 0),
      fineBreakdown,
    },
    avgOccupancy, // ค่าเฉลี่ยจำนวนรถในลาน (คัน) แยกรถยนต์/รถจักรยานยนต์ ตลอดช่วงเวลาที่เลือก
    hourly: hourlyReport,
    periodDays,
  })
}
