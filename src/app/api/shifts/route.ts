import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Shift } from '@/models/Shift'

export async function GET(req: NextRequest) {
  await connectDB()
  const { searchParams } = new URL(req.url)
  const limit      = parseInt(searchParams.get('limit')  ?? '50')
  const page       = parseInt(searchParams.get('page')   ?? '1')
  const operatorId = searchParams.get('operatorId')
  const dateFrom   = searchParams.get('dateFrom')
  const dateTo     = searchParams.get('dateTo')
  const status     = searchParams.get('status')

  const filter: Record<string, unknown> = {}
  if (operatorId) filter.operatorId = operatorId
  if (status)     filter.status     = status
  if (dateFrom || dateTo) {
    filter.startTime = {}
    if (dateFrom) {
      // date-only (YYYY-MM-DD) → ใช้ local midnight, full ISO → ใช้ตรงๆ
      const from = dateFrom.includes('T') ? new Date(dateFrom) : new Date(dateFrom + 'T00:00:00')
      ;(filter.startTime as Record<string, unknown>).$gte = from
    }
    if (dateTo) {
      const to = dateTo.includes('T') ? new Date(dateTo) : new Date(dateTo + 'T23:59:59')
      ;(filter.startTime as Record<string, unknown>).$lte = to
    }
  }

  const [shifts, total] = await Promise.all([
    Shift.find(filter).sort({ startTime: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Shift.countDocuments(filter),
  ])

  return NextResponse.json({ shifts, total, page, limit })
}
