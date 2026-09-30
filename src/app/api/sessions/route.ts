import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { sessionFilters } from '@/lib/sessionFilters'
import { ParkingSession } from '@/models/ParkingSession'

export async function GET(req: NextRequest) {
  await connectDB()
  const { searchParams } = new URL(req.url)
  const status  = searchParams.get('status')   // active | completed | lost
  const allActive = status === 'active' && searchParams.get('allActive') === '1'
  const limit   = parseInt(searchParams.get('limit') ?? '50')
  const page    = parseInt(searchParams.get('page')  ?? '1')
  let filter
  try { filter = sessionFilters(searchParams) }
  catch { return NextResponse.json({ error: 'ช่วงวันที่ไม่ถูกต้อง' }, { status: 400 }) }

  const [sessions, total] = await Promise.all([
    ParkingSession.find(filter).sort({ entryTime: -1, _id: -1 }).skip(allActive ? 0 : (page - 1) * limit).limit(allActive ? 0 : limit).lean(),
    ParkingSession.countDocuments(filter),
  ])

  return NextResponse.json({ sessions, total, page, limit })
}
