import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { Shift } from '@/models/Shift'
import { ParkingSession } from '@/models/ParkingSession'

export async function GET() {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  const user = token ? verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
  await connectDB()
  const shift = await Shift.findOne({ operatorId: user.sub, status: 'active' }).lean()
  if (!shift) return NextResponse.json({ error: 'ไม่พบกะที่กำลังทำงาน' }, { status: 404 })
  const sessions = await ParkingSession.find({
    shiftId: String(shift._id), status: { $in: ['completed', 'lost'] },
    exitTime: { $gte: shift.startTime },
  }).select('plate cardUid cardType entryTime exitTime totalFee paymentMethod status').sort({ exitTime: -1 }).lean()
  const cash = sessions.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.totalFee, 0)
  const qr = sessions.filter(s => s.paymentMethod === 'qr').reduce((sum, s) => sum + s.totalFee, 0)
  return NextResponse.json({ operatorName: shift.operatorName, startTime: shift.startTime, sessions,
    count: sessions.length, cash, qr, total: sessions.reduce((sum, s) => sum + s.totalFee, 0),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
