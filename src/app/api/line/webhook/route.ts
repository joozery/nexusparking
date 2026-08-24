import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { SystemSettings } from '@/models/SystemSettings'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const events: { source?: { type?: string; userId?: string; groupId?: string; roomId?: string } }[] = body.events ?? []

    const discovered = new Set<string>()
    for (const event of events) {
      const src = event.source
      if (!src) continue
      if (src.groupId) discovered.add(src.groupId)
      else if (src.userId) discovered.add(src.userId)
    }

    if (discovered.size > 0) {
      await connectDB()
      // เก็บ ID ที่ตรวจจับได้ลง DB ชั่วคราว
      await SystemSettings.collection.updateOne(
        {},
        { $addToSet: { 'line._discovered': { $each: [...discovered] } } },
      )
    }
  } catch { /* ไม่ให้ LINE retry */ }

  return NextResponse.json({ ok: true })
}

export async function GET() {
  await connectDB()
  const doc = await SystemSettings.collection.findOne({}, { projection: { 'line._discovered': 1 } })
  const ids: string[] = (doc?.line as { _discovered?: string[] })?._discovered ?? []
  return NextResponse.json({ ids })
}

export async function DELETE() {
  await connectDB()
  await SystemSettings.collection.updateOne({}, { $unset: { 'line._discovered': '' } })
  return NextResponse.json({ ok: true })
}
