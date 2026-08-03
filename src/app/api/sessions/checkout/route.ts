import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ParkingSession } from '@/models/ParkingSession'
import { getSettings } from '@/models/SystemSettings'
import { calcFeeFromMinutes, calcDurationMinutes } from '@/lib/calcFee'
import { runCheckoutSequence } from '@/lib/hardware'

export async function GET(req: NextRequest) {
  const uid = new URL(req.url).searchParams.get('uid')
  if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 })

  await connectDB()
  const session = await ParkingSession.findOne({ cardUid: uid.trim(), status: 'active' }).lean()
  if (!session) return NextResponse.json({ error: 'ไม่พบยานพาหนะในลาน' }, { status: 404 })

  const now = new Date()
  const durationMin = calcDurationMinutes(session.entryTime, now)
  const fee = calcFeeFromMinutes(session.cardType, durationMin, session.entryTime, now)

  return NextResponse.json({ ...session, durationMin, fee, totalFee: fee })
}

export async function POST(req: NextRequest) {
  const { uid, sessionId } = await req.json()

  await connectDB()

  const session = sessionId
    ? await ParkingSession.findOne({ _id: sessionId, status: 'active' as const })
    : await ParkingSession.findOne({ cardUid: uid?.trim(), status: 'active' as const })

  if (!session) return NextResponse.json({ error: 'ไม่พบยานพาหนะในลาน' }, { status: 404 })

  const settings = await getSettings()
  const now = new Date()
  const durationMin = calcDurationMinutes(session.entryTime, now)
  const fee = calcFeeFromMinutes(session.cardType, durationMin, session.entryTime, now)

  session.exitTime    = now
  session.durationMin = durationMin
  session.fee         = fee
  session.lostFine    = 0
  session.totalFee    = fee
  session.status      = 'completed'
  await session.save()

  // trigger hardware (fire-and-forget)
  void runCheckoutSequence(settings.hardware, {
    cardUid: session.cardUid,
    plate:   session.plate,
    receipt: {
      plate:     session.plate,
      cardType:  session.cardType,
      entryTime: session.entryTime.toISOString(),
      exitTime:  now.toISOString(),
      duration:  `${Math.ceil(durationMin / 60)}h`,
      fee,
      total: fee,
    },
  })

  return NextResponse.json(session)
}
