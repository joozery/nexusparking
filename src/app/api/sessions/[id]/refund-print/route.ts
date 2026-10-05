import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE_NAME, verifyToken } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { ParkingSession } from '@/models/ParkingSession'
import { Shift } from '@/models/Shift'
import { getSettings } from '@/models/SystemSettings'
import { printRaw } from '@/lib/hardware'
import { buildRefundReceipt } from '@/lib/escpos'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  if (!token || !verifyToken(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!/^[a-f\d]{24}$/i.test(id)) return NextResponse.json({ error: 'รายการไม่ถูกต้อง' }, { status: 400 })
  await connectDB()

  const [session, shift] = await Promise.all([
    ParkingSession.findById(id).select('plate cardUid cardType exitTime').lean(),
    Shift.findOne({ 'cardRefunds.sessionId': id }).select('cardRefunds').lean(),
  ])
  const refund = shift?.cardRefunds?.find(item => item.sessionId === id)
  if (!session || !refund) return NextResponse.json({ error: 'ไม่พบรายการคืนเงิน' }, { status: 404 })

  const settings = await getSettings()
  const result = await printRaw(settings.hardware, buildRefundReceipt({
    plate: session.plate,
    cardUid: session.cardUid,
    cardType: session.cardType,
    exitTime: session.exitTime?.toISOString(),
    refundedAt: new Date(refund.refundedAt).toISOString(),
    amount: refund.amount,
    paymentMethod: refund.paymentMethod,
  }))
  return NextResponse.json({ success: result.success })
}
