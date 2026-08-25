import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ParkingSession } from '@/models/ParkingSession'
import { getSettings } from '@/models/SystemSettings'
import { triggerPrinter } from '@/lib/hardware'

// On-demand receipt print — checkout no longer auto-prints (most customers
// don't take the slip), operator triggers this only if the customer asks.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await connectDB()

  const session = await ParkingSession.findById(id)
  if (!session) return NextResponse.json({ error: 'ไม่พบรายการนี้' }, { status: 404 })

  const settings = await getSettings()
  const exitTime = session.exitTime ?? new Date()
  const durationMin = Math.max(1, Math.round((exitTime.getTime() - session.entryTime.getTime()) / 60000))

  const result = await triggerPrinter(settings.hardware, {
    plate:     session.plate,
    cardType:  session.cardType,
    entryTime: session.entryTime.toISOString(),
    exitTime:  exitTime.toISOString(),
    duration:  `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`,
    fee:       session.totalFee,
    lostFine:  session.lostFine || undefined,
    total:     session.totalFee,
  })

  return NextResponse.json({ success: result.success })
}
