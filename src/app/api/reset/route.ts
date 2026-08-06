import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { connectDB } from '@/lib/mongodb'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { ParkingSession } from '@/models/ParkingSession'
import { ParkingCard } from '@/models/ParkingCard'
import { ParkingQueue } from '@/models/ParkingQueue'
import { Shift } from '@/models/Shift'
import { Discount } from '@/models/Discount'
import { HardwareLog } from '@/models/HardwareLog'

export async function DELETE() {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  const payload = token ? verifyToken(token) : null
  if (!payload || (payload.role !== 'admin' && payload.role !== 'superadmin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()

  const [sessions, cards, queues, shifts, discounts, logs] = await Promise.all([
    ParkingSession.deleteMany({}),
    ParkingCard.deleteMany({}),
    ParkingQueue.deleteMany({}),
    Shift.deleteMany({}),
    Discount.deleteMany({}),
    HardwareLog.deleteMany({}),
  ])

  return NextResponse.json({
    deleted: {
      sessions: sessions.deletedCount,
      cards: cards.deletedCount,
      queues: queues.deletedCount,
      shifts: shifts.deletedCount,
      discounts: discounts.deletedCount,
      hardwareLogs: logs.deletedCount,
    },
  })
}
