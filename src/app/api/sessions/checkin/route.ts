import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { ParkingCard } from '@/models/ParkingCard'
import { ParkingSession } from '@/models/ParkingSession'
import { Shift } from '@/models/Shift'
import { getSettings } from '@/models/SystemSettings'
import { runCheckinSequence } from '@/lib/hardware'

export async function POST(req: NextRequest) {
  const { uid, plate, cardType: manualType } = await req.json()

  if (!plate) {
    return NextResponse.json({ error: 'plate is required' }, { status: 400 })
  }
  if (!uid && !manualType) {
    return NextResponse.json({ error: 'uid or cardType is required' }, { status: 400 })
  }

  const jar     = await cookies()
  const token   = jar.get(COOKIE_NAME)?.value
  const payload = token ? verifyToken(token) : null

  await connectDB()

  const settings = await getSettings()
  const now = new Date()

  const [openH, openM]   = settings.businessHours.open.split(':').map(Number)
  const [closeH, closeM] = settings.businessHours.close.split(':').map(Number)
  const curMin       = now.getHours() * 60 + now.getMinutes()
  const outsideHours = curMin < openH * 60 + openM || curMin >= closeH * 60 + closeM

  let resolvedUid:  string
  let resolvedType: 'car' | 'motorcycle' | 'overnight'

  if (uid) {
    const card = await ParkingCard.findOne({ uid: uid.trim(), isActive: true })
    if (!card) {
      return NextResponse.json({ error: 'ไม่พบบัตรนี้ในระบบ' }, { status: 404 })
    }
    const existing = await ParkingSession.findOne({ cardUid: uid.trim(), status: 'active' })
    if (existing) {
      return NextResponse.json({ error: 'บัตรนี้มียานพาหนะอยู่ในลานแล้ว' }, { status: 409 })
    }
    resolvedUid  = card.uid
    resolvedType = card.type
  } else {
    resolvedUid  = `WALKIN-${Date.now()}`
    resolvedType = manualType as 'car' | 'motorcycle' | 'overnight'
  }

  // Find active shift and increment checkin count
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
    cardUid:    resolvedUid,
    cardType:   resolvedType,
    plate:      plate.trim(),
    entryTime:  now,
    status:     'active',
    operatorId: payload?.sub,
    shiftId,
  })

  void runCheckinSequence(settings.hardware, { cardUid: resolvedUid, plate: plate.trim() })

  return NextResponse.json({
    ...session.toObject(),
    outsideHours,
    businessHours: outsideHours
      ? `${settings.businessHours.open}–${settings.businessHours.close}`
      : undefined,
  }, { status: 201 })
}
