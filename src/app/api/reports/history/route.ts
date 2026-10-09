import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE_NAME, verifyToken } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { sessionFilters } from '@/lib/sessionFilters'
import { ParkingSession } from '@/models/ParkingSession'
import { Shift } from '@/models/Shift'

export async function GET(req: NextRequest) {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  const user = token ? verifyToken(token) : null
  if (!user || !['admin', 'superadmin'].includes(user.role)) return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ' }, { status: 403 })
  let filter
  try { filter = sessionFilters(req.nextUrl.searchParams) }
  catch { return NextResponse.json({ error: 'ช่วงวันที่ไม่ถูกต้อง' }, { status: 400 }) }
  const reportByExit = req.nextUrl.searchParams.get('reportMode') === 'revenue'
  if (reportByExit && (req.nextUrl.searchParams.has('dateFrom') || req.nextUrl.searchParams.has('dateTo'))) {
    const thaiDate = (value: string, endOfDay = false) =>
      new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+07:00`)
    const dateFrom = req.nextUrl.searchParams.get('dateFrom')
    const dateTo = req.nextUrl.searchParams.get('dateTo')
    const exitRange: Record<string, Date> = {}
    if (dateFrom) exitRange.$gte = thaiDate(dateFrom)
    if (dateTo) exitRange.$lte = thaiDate(dateTo, true)
    if (Object.values(exitRange).some(date => !Number.isFinite(date.getTime()))) {
      return NextResponse.json({ error: 'invalid report date range' }, { status: 400 })
    }
    delete filter.entryTime
    filter.exitTime = exitRange
  }
  await connectDB()
  // One ordered query: no screen pagination or separate count that could drift.
  const sessions = await ParkingSession.find(filter)
    .select('cardUid cardType plate entryTime exitTime durationMin fee lostFine lostCard fineName fineAmount totalFee status paymentMethod discountName discountAmount note entryPhotoPath exitPhotoPath operatorId shiftId')
    .sort(reportByExit ? { exitTime: -1, _id: -1 } : { entryTime: -1, _id: -1 }).lean()
  const shiftIds = sessions.map(session => session.shiftId).filter((id): id is string => Boolean(id))
  const operatorIds = sessions.map(session => session.operatorId).filter((id): id is string => Boolean(id))
  const shifts = shiftIds.length || operatorIds.length
    ? await Shift.find({ $or: [
        ...(shiftIds.length ? [{ _id: { $in: shiftIds } }] : []),
        ...(operatorIds.length ? [{ operatorId: { $in: operatorIds } }] : []),
      ] }).select('operatorId operatorName startTime endTime').lean()
    : []
  const shiftById = new Map(shifts.map(shift => [String(shift._id), shift]))
  const sessionsWithOperator = sessions.map(session => {
    const exactShift = session.shiftId ? shiftById.get(String(session.shiftId)) : undefined
    const fallbackShift = exactShift ?? shifts.find(shift =>
      shift.operatorId === session.operatorId
      && new Date(shift.startTime).getTime() <= new Date(session.entryTime).getTime()
      && (!shift.endTime || new Date(shift.endTime).getTime() >= new Date(session.entryTime).getTime()))
    return { ...session, operatorName: fallbackShift?.operatorName ?? '' }
  })
  return NextResponse.json({ sessions: sessionsWithOperator, total: sessionsWithOperator.length }, { headers: { 'Cache-Control': 'no-store' } })
}
