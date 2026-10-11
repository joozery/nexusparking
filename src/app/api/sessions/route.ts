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

  // Summary cards must cover the full filtered dataset, not only the current page.
  // Ignore the selected status tab so the cards remain a consistent overview.
  const summaryParams = new URLSearchParams(searchParams)
  summaryParams.delete('status')
  const summaryFilter = sessionFilters(summaryParams)

  const [sessions, total, activeTotal, completedTotal] = await Promise.all([
    ParkingSession.find(filter).sort({ entryTime: -1, _id: -1 }).skip(allActive ? 0 : (page - 1) * limit).limit(allActive ? 0 : limit).lean(),
    ParkingSession.countDocuments(filter),
    ParkingSession.countDocuments({ ...summaryFilter, status: 'active' }),
    ParkingSession.countDocuments({ ...summaryFilter, status: 'completed' }),
  ])

  return NextResponse.json({
    sessions,
    total,
    page,
    limit,
    summary: { active: activeTotal, completed: completedTotal },
  })
}
