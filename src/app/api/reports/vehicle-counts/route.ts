import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE_NAME, verifyToken } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { ParkingSession } from '@/models/ParkingSession'
import { ParkingQueue } from '@/models/ParkingQueue'
import { getSettings } from '@/models/SystemSettings'
import { calcFeeBreakdown } from '@/lib/calcFee'

type EventRow = { date: string; vehicleType: string; reportType: string; parkingType: string; count: number }

export async function GET(req: NextRequest) {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  const user = token ? verifyToken(token) : null
  if (!user || !['admin', 'superadmin'].includes(user.role)) return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ' }, { status: 403 })

  const thaiDate = (value: string, endOfDay = false) => {
    if (value.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(value)) return new Date(value)
    if (value.includes('T')) return new Date(`${value}:00+07:00`)
    return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+07:00`)
  }
  const fromValue = req.nextUrl.searchParams.get('dateFrom')
  const toValue = req.nextUrl.searchParams.get('dateTo')
  if (!fromValue || !toValue) return NextResponse.json({ error: 'กรุณาระบุช่วงวันที่' }, { status: 400 })
  const from = thaiDate(fromValue)
  const to = thaiDate(toValue, true)
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return NextResponse.json({ error: 'ช่วงวันที่ไม่ถูกต้อง' }, { status: 400 })

  await connectDB()
  const settings = await getSettings()
  const [sessions, queues] = await Promise.all([
    ParkingSession.find({ status: { $ne: 'void' }, $or: [
      { entryTime: { $gte: from, $lte: to } },
      { exitTime: { $gte: from, $lte: to } },
    ] }).select('cardType entryTime exitTime').lean(),
    ParkingQueue.find({ joinedAt: { $gte: from, $lte: to } }).select('cardType joinedAt').lean(),
  ])
  const dateKey = (value: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value)
  const vehicleType = (cardType: string) => cardType === 'motorcycle' ? 'รถจักรยานยนต์' : 'รถยนต์'
  const exitReportType = (cardType: string, entryTime: Date, exitTime?: Date) => {
    if (cardType === 'overnight') return 'ค้างคืน'
    if (exitTime && calcFeeBreakdown(cardType as 'car' | 'motorcycle', entryTime, exitTime, settings.rates.overnight).segments.some(segment => segment.kind === 'overnight')) return 'ค้างคืน'
    return 'ปกติ'
  }
  const events: EventRow[] = []
  for (const session of sessions) {
    const type = vehicleType(session.cardType)
    if (session.entryTime >= from && session.entryTime <= to) events.push({ date: dateKey(session.entryTime), vehicleType: type, reportType: 'ปกติ', parkingType: 'เข้า', count: 1 })
    if (session.exitTime && session.exitTime >= from && session.exitTime <= to) events.push({ date: dateKey(session.exitTime), vehicleType: type, reportType: exitReportType(session.cardType, session.entryTime, session.exitTime), parkingType: 'ออก', count: 1 })
  }
  for (const queue of queues) events.push({ date: dateKey(queue.joinedAt), vehicleType: vehicleType(queue.cardType), reportType: 'ปกติ', parkingType: 'รอคิว', count: 1 })
  events.sort((a, b) => a.date.localeCompare(b.date) || a.vehicleType.localeCompare(b.vehicleType) || a.parkingType.localeCompare(b.parkingType))
  const summaryMap = new Map<string, EventRow>()
  for (const event of events) {
    const key = `${event.date}|${event.vehicleType}|${event.reportType}|${event.parkingType}`
    const current = summaryMap.get(key)
    if (current) current.count += event.count
    else summaryMap.set(key, { ...event })
  }
  return NextResponse.json({ summary: [...summaryMap.values()], details: events, from: from.toISOString(), to: to.toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
}
