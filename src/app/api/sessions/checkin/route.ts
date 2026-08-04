import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ParkingCard } from '@/models/ParkingCard'
import { ParkingSession } from '@/models/ParkingSession'
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

  await connectDB()

  const settings = await getSettings()
  const now = new Date()

  const [openH, openM]   = settings.businessHours.open.split(':').map(Number)
  const [closeH, closeM] = settings.businessHours.close.split(':').map(Number)
  const curMin       = now.getHours() * 60 + now.getMinutes()
  const outsideHours = curMin < openH * 60 + openM || curMin >= closeH * 60 + closeM

  // ถ้ามี uid → ต้องเจอบัตรใน DB
  // ถ้าไม่มี uid แต่มี cardType → walk-in (ไม่มีบัตร)
  let resolvedUid: string
  let resolvedType: string

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
    // walk-in — สร้าง UID ชั่วคราว
    resolvedUid  = `WALKIN-${Date.now()}`
    resolvedType = manualType
  }

  const session = await ParkingSession.create({
    cardUid:   resolvedUid,
    cardType:  resolvedType,
    plate:     plate.trim(),
    entryTime: now,
    status:    'active',
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
