import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { ParkingQueue } from '@/models/ParkingQueue'
import { ParkingSession } from '@/models/ParkingSession'
import { Shift } from '@/models/Shift'

// POST /api/queue/[id]/enter — รถออกจากคิวเข้าลานจอด
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const jar     = await cookies()
  const token   = jar.get(COOKIE_NAME)?.value
  const payload = token ? verifyToken(token) : null

  await connectDB()

  const q = await ParkingQueue.findOne({ _id: id, status: 'waiting' })
  if (!q) return NextResponse.json({ error: 'ไม่พบคิว' }, { status: 404 })

  const now = new Date()

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
    cardUid:    q.cardUid ?? `WALKIN-${Date.now()}`,
    cardType:   q.cardType,
    plate:      q.plate,
    entryTime:  now,
    status:     'active',
    operatorId: payload?.sub,
    shiftId,
  })

  q.status    = 'entered'
  q.enteredAt = now
  await q.save()

  return NextResponse.json({ queue: q, session })
}
