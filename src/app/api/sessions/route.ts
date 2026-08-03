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

  const filter: Record<string, unknown> = {}
  if (status) filter.status = status
  if (plate)  filter.plate  = { $regex: plate, $options: 'i' }
  if (dateFrom || dateTo) {
    filter.entryTime = {}
    if (dateFrom) (filter.entryTime as Record<string, unknown>).$gte = new Date(dateFrom)
    if (dateTo)   (filter.entryTime as Record<string, unknown>).$lte = new Date(dateTo + 'T23:59:59')
  }

  const [sessions, total] = await Promise.all([
    ParkingSession.find(filter).sort({ entryTime: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ParkingSession.countDocuments(filter),
  ])

  return NextResponse.json({ sessions, total, page, limit })
}
