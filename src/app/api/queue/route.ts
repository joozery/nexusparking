import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { ParkingQueue } from '@/models/ParkingQueue'
import { Shift } from '@/models/Shift'
import { getSettings } from '@/models/SystemSettings'
import { runCheckinSequence } from '@/lib/hardware'

// GET — รายการคิวที่รอ (status=waiting)
export async function GET() {
  await connectDB()
  const queues = await ParkingQueue.find({ status: 'waiting' }).sort({ joinedAt: 1 }).lean()
  return NextResponse.json(queues)
}

// POST — เพิ่มรถเข้าคิว
export async function POST(req: NextRequest) {
  const { plate, cardType, cardUid } = await req.json()
  if (!plate || !cardType) return NextResponse.json({ error: 'plate และ cardType จำเป็น' }, { status: 400 })

  const jar     = await cookies()
  const token   = jar.get(COOKIE_NAME)?.value
  const payload = token ? verifyToken(token) : null

  await connectDB()

  // ห้ามเพิ่มทะเบียนเดิมซ้ำ
  const existing = await ParkingQueue.findOne({ plate: plate.trim(), status: 'waiting' })
  if (existing) return NextResponse.json({ error: 'ทะเบียนนี้อยู่ในคิวแล้ว' }, { status: 409 })

  let shiftId: string | undefined
  if (payload) {
    const shift = await Shift.findOne({ operatorId: payload.sub, status: 'active' })
    if (shift) shiftId = String(shift._id)
  }

  const resolvedUid = cardUid ?? `WALKIN-Q-${Date.now()}`

  const q = await ParkingQueue.create({
    plate:      plate.trim().toUpperCase(),
    cardType,
    cardUid:    resolvedUid,
    joinedAt:   new Date(),
    status:     'waiting',
    operatorId: payload?.sub,
    shiftId,
  })

  // เปิดกล้อง + ไม้กั้นให้รถเข้าพื้นที่รอคิว
  const settings = await getSettings()
  void runCheckinSequence(settings.hardware, { cardUid: resolvedUid, plate: plate.trim().toUpperCase() })

  return NextResponse.json(q, { status: 201 })
}
