import { parkingMutation } from '@/lib/parkingMutation'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { ParkingQueue } from '@/models/ParkingQueue'
import { ParkingSession } from '@/models/ParkingSession'
import { Shift } from '@/models/Shift'
import { getSettings } from '@/models/SystemSettings'

// POST /api/queue/[id]/enter — รถออกจากคิวเข้าลานจอด
// body.skipCapacityCheck: true — ใช้เมื่อรถ "ไม่รอแล้ว" และแค่เช็คเอาต์จ่ายค่าคิวทันที
// (ไม่ได้เข้าไปจอดในลานจริง จึงไม่ต้องนับที่ว่าง ต่างจากการโปรโมทคิวเข้าลานปกติที่ต้องมีที่ว่างจริง)
async function handlePost(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { skipCapacityCheck } = await req.json().catch(() => ({ skipCapacityCheck: false }))
  const jar     = await cookies()
  const token   = jar.get(COOKIE_NAME)?.value
  const payload = token ? verifyToken(token) : null

  await connectDB()

  const q = await ParkingQueue.findOne({ _id: id, status: 'waiting' })
  if (!q) return NextResponse.json({ error: 'ไม่พบคิว' }, { status: 404 })
  if (q.cardUid && await ParkingSession.exists({ cardUid: q.cardUid, status: 'active' })) {
    return NextResponse.json({ error: 'บัตรนี้มีรถอยู่ในลานแล้ว กรุณาตรวจรายการรถก่อนย้ายคิว' }, { status: 409 })
  }

  if (!skipCapacityCheck) {
    const settings      = await getSettings()
    const isCarBucket   = q.cardType !== 'motorcycle'
    const bucketTypes   = isCarBucket ? (['car', 'overnight'] as const) : (['motorcycle'] as const)
    const bucketCapacity = isCarBucket ? settings.capacity.car : settings.capacity.motorcycle
    const bucketActive   = await ParkingSession.countDocuments({ cardType: { $in: bucketTypes }, status: 'active' })
    if (bucketActive >= bucketCapacity) {
      return NextResponse.json({
        error: isCarBucket ? 'ลานจอดรถยนต์เต็มแล้ว กรุณาใช้ระบบคิวรอ' : 'ลานจอดรถจักรยานยนต์เต็มแล้ว กรุณาใช้ระบบคิวรอ',
      }, { status: 409 })
    }
  }

  // เวลาเข้าลานใช้เวลาที่เข้าคิวจริง (joinedAt) เสมอ — ห้ามแก้ไขเอง ป้องกันการโกงเวลา
  const now = q.joinedAt

  // สร้าง session ใหม่
  let shiftId: string | undefined
  if (payload) {
    const shift = await Shift.findOne({ operatorId: payload.sub, status: 'active' })
    if (shift) {
      shiftId = String(shift._id)
      shift.checkinsCount += 1
      await shift.save()
    }
  }

  const session = await ParkingSession.create({
    cardUid:    q.cardUid ?? `WALKIN-${crypto.randomUUID()}`,
    cardType:   q.cardType,
    plate:      q.plate,
    entryTime:  now,
    status:     'active',
    operatorId: payload?.sub,
    shiftId,
  })

  q.status    = 'entered'
  q.enteredAt = new Date()
  await q.save()

  return NextResponse.json({ queue: q, session })
}

export const POST = parkingMutation(handlePost)
