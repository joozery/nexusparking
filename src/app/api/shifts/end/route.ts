import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { Shift } from '@/models/Shift'
import { ParkingSession } from '@/models/ParkingSession'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const closingFloat: number = Number(body.closingFloat ?? 0)

  const jar     = await cookies()
  const token   = jar.get(COOKIE_NAME)?.value
  const payload = token ? verifyToken(token) : null
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const shift = await Shift.findOne({ operatorId: payload.sub, status: 'active' })
  if (!shift) return NextResponse.json({ error: 'ไม่มีกะที่เปิดอยู่' }, { status: 404 })

  // นับรถที่ยังค้างอยู่ตอนปิดกะ
  const closingCarCount = await ParkingSession.countDocuments({ status: 'active' })

  shift.status         = 'closed'
  shift.endTime        = new Date()
  shift.closingFloat   = closingFloat
  shift.closingCarCount = closingCarCount
  await shift.save()

  return NextResponse.json(shift)
}
