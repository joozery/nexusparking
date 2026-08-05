import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ParkingSession } from '@/models/ParkingSession'

export async function GET(req: NextRequest) {
  await connectDB()
  const { searchParams } = new URL(req.url)
  const status  = searchParams.get('status')   // active | completed | lost
  const limit   = parseInt(searchParams.get('limit') ?? '50')
  const page    = parseInt(searchParams.get('page')  ?? '1')
  const plate   = searchParams.get('plate')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo   = searchParams.get('dateTo')

  const shiftId = searchParams.get('shiftId')

  const filter: Record<string, unknown> = {}
  if (status)  filter.status  = status
  if (plate)   filter.plate   = { $regex: plate, $options: 'i' }
  if (shiftId) filter.shiftId = shiftId
  if (dateFrom || dateTo) {
    filter.entryTime = {}
    if (dateFrom) {
      const from = dateFrom.includes('T') ? new Date(dateFrom) : new Date(dateFrom + 'T00:00:00')
      ;(filter.entryTime as Record<string, unknown>).$gte = from
    }
    if (dateTo) {
      // ถ้าเป็น full ISO timestamp ใช้ตรงๆ ถ้าเป็น date-only (YYYY-MM-DD) เติม end-of-day
      const dateToVal = dateTo.includes('T') ? new Date(dateTo) : new Date(dateTo + 'T23:59:59')
      ;(filter.entryTime as Record<string, unknown>).$lte = dateToVal
    }
  }

  const [sessions, total] = await Promise.all([
    ParkingSession.find(filter).sort({ entryTime: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ParkingSession.countDocuments(filter),
  ])

  return NextResponse.json({ sessions, total, page, limit })
}
