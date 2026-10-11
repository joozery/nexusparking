import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/mongodb'
import { sessionFilters } from '@/lib/sessionFilters'
import { ParkingSession } from '@/models/ParkingSession'
import { Shift } from '@/models/Shift'

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

  // The history page can request only outstanding lost-card records. Keep this
  // opt-in so other callers of status=lost still see the full lost-card history.
  if (status === 'lost' && searchParams.get('outstanding') === '1') {
    const refundShifts = await Shift.find({ 'cardRefunds.0': { $exists: true } })
      .select('cardRefunds.sessionId').lean()
    const refundedIds = refundShifts
      .flatMap(shift => (shift.cardRefunds ?? []).map(refund => String(refund.sessionId)))
      .filter(id => mongoose.isValidObjectId(id))
      .map(id => new mongoose.Types.ObjectId(id))
    filter._id = { $nin: refundedIds }
  }

  // Summary cards must cover the full filtered dataset, not only the current page.
  // Ignore the selected status tab so the cards remain a consistent overview.
  const summaryParams = new URLSearchParams(searchParams)
  summaryParams.delete('status')
  const summaryFilter = sessionFilters(summaryParams)

  const [sessions, total, allTotal, activeTotal, completedTotal, revenueRows] = await Promise.all([
    ParkingSession.find(filter).sort({ entryTime: -1, _id: -1 }).skip(allActive ? 0 : (page - 1) * limit).limit(allActive ? 0 : limit).lean(),
    ParkingSession.countDocuments(filter),
    ParkingSession.countDocuments(summaryFilter),
    ParkingSession.countDocuments({ ...summaryFilter, status: 'active' }),
    ParkingSession.countDocuments({ ...summaryFilter, status: 'completed' }),
    ParkingSession.aggregate<{ _id: null; total: number }>([
      { $match: filter },
      { $match: { status: { $ne: 'active' } } },
      { $group: { _id: null, total: { $sum: '$totalFee' } } },
    ]),
  ])

  return NextResponse.json({
    sessions,
    total,
    page,
    limit,
    summary: {
      all: allTotal,
      active: activeTotal,
      completed: completedTotal,
      revenueTotal: revenueRows[0]?.total ?? 0,
    },
  })
}
