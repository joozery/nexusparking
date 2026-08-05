import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ParkingQueue } from '@/models/ParkingQueue'

// POST /api/queue/[id]/cancel — ยกเลิกคิว
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await connectDB()

  const q = await ParkingQueue.findOne({ _id: id, status: 'waiting' })
  if (!q) return NextResponse.json({ error: 'ไม่พบคิว' }, { status: 404 })

  q.status      = 'cancelled'
  q.cancelledAt = new Date()
  await q.save()

  return NextResponse.json(q)
}
