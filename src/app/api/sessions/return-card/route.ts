import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE_NAME, verifyToken } from '@/lib/auth'
import { parkingMutation } from '@/lib/parkingMutation'
import { connectDB } from '@/lib/mongodb'
import { ParkingSession } from '@/models/ParkingSession'
import { ParkingQueue } from '@/models/ParkingQueue'
import { Shift } from '@/models/Shift'

async function operator() {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  return token ? verifyToken(token) : null
}

export async function GET(req: NextRequest) {
  if (!await operator()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uid = req.nextUrl.searchParams.get('uid')?.trim()
  if (!uid) return NextResponse.json({ error: 'กรุณาระบุบัตร' }, { status: 400 })
  await connectDB()
  const visit = await ParkingSession.findOne({ cardUid: uid, status: { $ne: 'void' } }).sort({ entryTime: -1, _id: -1 }).lean()
  if (!visit || visit.status === 'active' || !(visit.lostCard || visit.lostFine > 0 || visit.status === 'lost')) return NextResponse.json(null)
  if (await Shift.exists({ 'cardRefunds.sessionId': String(visit._id) })) return NextResponse.json(null)
  return NextResponse.json({ _id: visit._id, cardUid: visit.cardUid, plate: visit.plate, cardType: visit.cardType, exitTime: visit.exitTime, lostFine: visit.lostFine })
}

export const POST = parkingMutation(async (req: NextRequest) => {
  const user = await operator()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!/^[a-f\d]{24}$/i.test(body.sessionId ?? '') || !['cash', 'qr'].includes(body.paymentMethod)) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
  const visit = await ParkingSession.findById(body.sessionId).lean()
  if (!visit || !['completed', 'lost'].includes(visit.status) || !(visit.lostCard || visit.lostFine > 0 || visit.status === 'lost')) return NextResponse.json({ error: 'ไม่พบรายการบัตรหายที่รับเงินแล้ว' }, { status: 409 })
  if (await Shift.exists({ 'cardRefunds.sessionId': body.sessionId })) return NextResponse.json({ error: 'รายการนี้คืนบัตรและคืนเงินแล้ว' }, { status: 409 })
  const latest = await ParkingSession.findOne({ cardUid: visit.cardUid, status: { $ne: 'void' } }).sort({ entryTime: -1, _id: -1 }).lean()
  if (String(latest?._id) !== body.sessionId || await ParkingQueue.exists({ cardUid: visit.cardUid, status: 'waiting' })) return NextResponse.json({ error: 'บัตรนี้มีการใช้งานใหม่แล้ว กรุณาตรวจสอบรายการ' }, { status: 409 })
  const amount = Math.max(0, visit.lostFine || 0)
  // Ledger and shift cash movement are one atomic write, including on standalone MongoDB.
  const shift = await Shift.findOneAndUpdate(
    { operatorId: user.sub, status: 'active', 'cardRefunds.sessionId': { $ne: body.sessionId } },
    { $push: { cardRefunds: { sessionId: body.sessionId, cardUid: visit.cardUid, plate: visit.plate, amount, paymentMethod: body.paymentMethod, refundedAt: new Date(), operatorId: user.sub } },
      $inc: { [body.paymentMethod === 'cash' ? 'cashAmount' : 'qrAmount']: -amount, totalAmount: -amount } },
    { new: true },
  )
  if (!shift) return NextResponse.json({ error: 'กรุณาเปิดกะก่อนคืนเงิน' }, { status: 409 })
  return NextResponse.json({ amount, paymentMethod: body.paymentMethod })
})
