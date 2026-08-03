import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ParkingSession } from '@/models/ParkingSession'
import { getSettings } from '@/models/SystemSettings'
import { calcFeeFromMinutes } from '@/lib/calcFee'

const LOST_FINE = 300

async function triggerHardware(plate: string) {
  try {
    const settings = await getSettings()
    const { triggerDrawer, triggerCamera } = await import('@/lib/hardware')
    void triggerDrawer(settings.hardware)
    void triggerCamera(settings.hardware, { cardUid: 'LOST', plate, event: 'lost' })
  } catch { /* hardware optional */ }
}

export async function POST(req: NextRequest) {
  const { plate, estimatedHours, cardType: reqCardType, note } = await req.json()

  if (!plate || !estimatedHours) {
    return NextResponse.json({ error: 'plate and estimatedHours are required' }, { status: 400 })
  }

  await connectDB()

  const existing    = await ParkingSession.findOne({ plate: plate.trim(), status: 'active' })
  const now         = new Date()
  const durationMin = (estimatedHours as number) * 60

  // ใช้ cardType จาก session จริง → ถ้าไม่มีใช้ที่ส่งมา → fallback 'car'
  const resolvedType = existing?.cardType ?? reqCardType ?? 'car'
  const parkingFee   = calcFeeFromMinutes(resolvedType, durationMin)
  const totalFee     = parkingFee + LOST_FINE

  if (existing) {
    existing.exitTime    = now
    existing.durationMin = durationMin
    existing.fee         = parkingFee
    existing.lostFine    = LOST_FINE
    existing.totalFee    = totalFee
    existing.status      = 'lost'
    existing.note        = note ?? 'บัตรหาย'
    await existing.save()
    void triggerHardware(plate.trim())
    return NextResponse.json(existing)
  }

  // ไม่เจอ session — สร้าง record ใหม่
  const session = await ParkingSession.create({
    cardUid:     'LOST',
    cardType:    resolvedType,
    plate:       plate.trim(),
    entryTime:   new Date(now.getTime() - durationMin * 60000),
    exitTime:    now,
    durationMin,
    fee:         parkingFee,
    lostFine:    LOST_FINE,
    totalFee,
    status:      'lost',
    note:        note ?? 'บัตรหาย',
  })

  void triggerHardware(plate.trim())
  return NextResponse.json(session, { status: 201 })
}
