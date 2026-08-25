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

    await connectDB()

    // เก็บ raw event ล่าสุดไว้ debug และ ID ที่ตรวจจับได้
    const ops: object[] = [
      { $set: { 'line._lastWebhook': new Date().toISOString(), 'line._eventCount': events.length } },
    ]
    if (discovered.size > 0) {
      ops.push({ $addToSet: { 'line._discovered': { $each: [...discovered] } } } as object)
    }
    for (const op of ops) {
      await SystemSettings.collection.updateOne({}, op)
    }
  } catch (e) {
    console.error('[LINE webhook]', e)
  }

  return NextResponse.json({ ok: true })
}

export async function GET() {
  await connectDB()
  const doc = await SystemSettings.collection.findOne({}, { projection: { 'line._discovered': 1, 'line._lastWebhook': 1, 'line._eventCount': 1 } })
  const lineDoc = doc?.line as { _discovered?: string[]; _lastWebhook?: string; _eventCount?: number } | undefined
  return NextResponse.json({
    ids:          lineDoc?._discovered  ?? [],
    lastWebhook:  lineDoc?._lastWebhook ?? null,
    eventCount:   lineDoc?._eventCount  ?? 0,
  })
}

export async function DELETE() {
  await connectDB()
  await SystemSettings.collection.updateOne({}, { $unset: { 'line._discovered': '' } })
  return NextResponse.json({ ok: true })
}
