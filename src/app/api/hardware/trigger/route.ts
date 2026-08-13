import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { getSettings } from '@/models/SystemSettings'
import { triggerBarrier, triggerCamera, triggerDrawer, triggerPrinter } from '@/lib/hardware'

// POST /api/hardware/trigger
// body: { device: 'barrier'|'camera'|'drawer'|'printer', ...params }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { device, ...params } = body

  await connectDB()
  const settings = await getSettings()
  const hw = settings.hardware

  switch (device) {
    case 'barrier': {
      const direction = params.direction === 'checkout' ? 'checkout' : 'checkin'
      const r = await triggerBarrier(hw, direction)
      return NextResponse.json({ success: r.success, latencyMs: r.latencyMs, device })
    }
    case 'camera': {
      const r = await triggerCamera(hw, {
        cardUid: params.cardUid ?? '',
        plate:   params.plate   ?? '',
        event:   params.event   ?? 'checkin',
      })
      return NextResponse.json({ success: r.success, latencyMs: r.latencyMs, device })
    }
    case 'drawer': {
      const r = await triggerDrawer(hw)
      return NextResponse.json({ success: r.success, latencyMs: r.latencyMs, device })
    }
    case 'printer': {
      const r = await triggerPrinter(hw, params.receipt)
      return NextResponse.json({ success: r.success, latencyMs: r.latencyMs, device })
    }
    default:
      return NextResponse.json({ error: 'unknown device' }, { status: 400 })
  }
}

// GET /api/hardware/trigger?device=barrier — ping from monitor/settings page
export async function GET(req: NextRequest) {
  const device = new URL(req.url).searchParams.get('device')
  if (!device) return NextResponse.json({ error: 'device required' }, { status: 400 })

  await connectDB()
  const settings = await getSettings()
  const hw = settings.hardware

  let success = false
  let latencyMs = 0

  if (device === 'barrier') { const r = await triggerBarrier(hw); success = r.success; latencyMs = r.latencyMs }
  if (device === 'drawer')  { const r = await triggerDrawer(hw);  success = r.success; latencyMs = r.latencyMs }
  if (device === 'camera')  { const r = await triggerCamera(hw, { cardUid: 'TEST', plate: 'TEST', event: 'checkin' }); success = r.success; latencyMs = r.latencyMs }
  if (device === 'printer') { const r = await triggerPrinter(hw, { plate: 'TEST', cardType: 'car', entryTime: new Date().toISOString(), exitTime: new Date().toISOString(), duration: '0h', fee: 0, total: 0 }); success = r.success; latencyMs = r.latencyMs }

  return NextResponse.json({ success, latencyMs, device, timestamp: new Date().toISOString() })
}
