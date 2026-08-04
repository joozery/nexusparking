import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ParkingSession } from '@/models/ParkingSession'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await connectDB()

  const session = await ParkingSession.findByIdAndDelete(id)
  if (!session) {
    return NextResponse.json({ error: 'ไม่พบรายการนี้' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
