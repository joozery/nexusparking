import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ParkingSession } from '@/models/ParkingSession'
import { getSettings } from '@/models/SystemSettings'
import { calcFeeBreakdown, calcDurationMinutes } from '@/lib/calcFee'

interface SeedRow {
  plate:         string
  cardType:      'car' | 'motorcycle' | 'overnight'
  entryTime:     string   // ISO string
  exitTime:      string   // ISO string
  paymentMethod: 'cash' | 'qr'
}

// POST — seed simulated sessions
export async function POST(req: NextRequest) {
  const rows: SeedRow[] = await req.json()
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'rows must be a non-empty array' }, { status: 400 })
  }

  await connectDB()
  const settings = await getSettings()
  const overnightCfg = settings.rates.overnight

  const docs = rows.map((r, i) => {
    const entry = new Date(r.entryTime)
    const exit  = new Date(r.exitTime)
    if (isNaN(entry.getTime()) || isNaN(exit.getTime())) {
      throw new Error(`row ${i}: invalid datetime`)
    }
    if (exit <= entry) throw new Error(`row ${i}: exitTime must be after entryTime`)

    const { total: fee } = calcFeeBreakdown(r.cardType, entry, exit, overnightCfg)
    const durationMin    = calcDurationMinutes(entry, exit)

    return {
      cardUid:       `SIM-${Date.now()}-${i}`,
      cardType:      r.cardType,
      plate:         r.plate.trim(),
      entryTime:     entry,
      exitTime:      exit,
      durationMin,
      fee,
      lostFine:      0,
      totalFee:      fee,
      status:        'completed' as const,
      paymentMethod: r.paymentMethod ?? 'cash',
      discountAmount: 0,
      isSimulated:   true,
    }
  })

  const created = await ParkingSession.insertMany(docs)
  return NextResponse.json({ created: created.length, sessions: created }, { status: 201 })
}

// DELETE — ลบ session ที่เป็น simulated ทั้งหมด
export async function DELETE() {
  await connectDB()
  const result = await ParkingSession.deleteMany({ isSimulated: true })
  return NextResponse.json({ deleted: result.deletedCount })
}
