import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE_NAME, verifyToken } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { ParkingSession } from '@/models/ParkingSession'

async function adminOnly() {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  const user = token ? verifyToken(token) : null
  return user && ['admin', 'superadmin'].includes(user.role)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await adminOnly()) return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ' }, { status: 403 })
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const plate = typeof body.plate === 'string' ? body.plate.trim() : ''
  const entryTime = typeof body.entryTime === 'string' ? new Date(body.entryTime) : null
  if (!plate || plate.length > 32 || !entryTime || !Number.isFinite(entryTime.getTime())) {
    return NextResponse.json({ error: 'กรุณากรอกทะเบียนและเวลาเข้าให้ถูกต้อง' }, { status: 400 })
  }
  if (entryTime > new Date()) return NextResponse.json({ error: 'เวลาเข้าห้ามเป็นเวลาอนาคต' }, { status: 400 })

  await connectDB()
  const session = await ParkingSession.findOneAndUpdate(
    { _id: id, status: 'active' },
    { $set: { plate, entryTime } },
    { new: true, runValidators: true },
  ).lean()
  if (!session) return NextResponse.json({ error: 'แก้ไขได้เฉพาะรายการที่ยังจอดอยู่' }, { status: 409 })
  return NextResponse.json(session)
}

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
