import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ParkingSession } from '@/models/ParkingSession'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[a-f\d]{24}$/i.test(id)) return NextResponse.json({ error: 'เลขรายการไม่ถูกต้อง' }, { status: 400 })
  await connectDB()
  const session = await ParkingSession.findOne({ _id: id, status: { $in: ['completed', 'lost'] } })
    .select('plate cardUid cardType entryTime exitTime fee discountAmount fineAmount lostFine totalFee paymentMethod').lean()
  if (!session) return NextResponse.json({ error: 'ไม่พบรายการรับเงิน' }, { status: 404 })
  return NextResponse.json(session, { headers: { 'Cache-Control': 'no-store' } })
}
