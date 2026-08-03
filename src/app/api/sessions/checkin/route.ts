import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ParkingCard } from '@/models/ParkingCard'
import { ParkingSession } from '@/models/ParkingSession'
import { getSettings } from '@/models/SystemSettings'
import { runCheckinSequence } from '@/lib/hardware'

export async function POST(req: NextRequest) {
  const { uid, plate } = await req.json()

  if (!uid || !plate) {
    return NextResponse.json({ error: 'uid and plate are required' }, { status: 400 })
  }

  await connectDB()

  const settings = await getSettings()
  const now = new Date()

  // ตรวจสอบเวลาทำการ (warning เท่านั้น ไม่ block)
  const [openH, openM]  = settings.businessHours.open.split(':').map(Number)
  const [closeH, closeM] = settings.businessHours.close.split(':').map(Number)
  const curMin  = now.getHours() * 60 + now.getMinutes()
  const outsideHours = curMin < openH * 60 + openM || curMin >= closeH * 60 + closeM

  const card = await ParkingCard.findOne({ uid: uid.trim(), isActive: true })
  if (!card) {
    return NextResponse.json({ error: 'ไม่พบบัตรนี้ในระบบ' }, { status: 404 })
  }

  const existing = await ParkingSession.findOne({ cardUid: uid.trim(), status: 'active' })
  if (existing) {
    return NextResponse.json({ error: 'บัตรนี้มียานพาหนะอยู่ในลานแล้ว' }, { status: 409 })
  }

  const session = await ParkingSession.create({
    cardUid:   card.uid,
    cardType:  card.type,
    plate:     plate.trim(),
    entryTime: now,
    status:    'active',
  })

  void runCheckinSequence(settings.hardware, { cardUid: card.uid, plate: plate.trim() })

  return NextResponse.json({
    ...session.toObject(),
    outsideHours,
    businessHours: outsideHours
      ? `${settings.businessHours.open}–${settings.businessHours.close}`
      : undefined,
  }, { status: 201 })
}
