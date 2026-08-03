import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { HardwareLog } from '@/models/HardwareLog'
import { getSettings } from '@/models/SystemSettings'

const DEVICES = ['camera', 'barrier', 'reader', 'printer', 'drawer'] as const

// GET /api/hardware/status — last known status per device merged with config
export async function GET() {
  await connectDB()

  const [settings, lastEvents] = await Promise.all([
    getSettings(),
    HardwareLog.aggregate([
      { $sort: { createdAt: -1 } },
      { $group: {
        _id:       '$device',
        success:   { $first: '$success' },
        latencyMs: { $first: '$latencyMs' },
        lastSeen:  { $first: '$createdAt' },
        event:     { $first: '$event' },
        ip:        { $first: '$ip' },
      }},
    ]),
  ])

  type LogEntry = { success: boolean; latencyMs: number; lastSeen: Date; event: string; ip: string }
  const logMap: Record<string, LogEntry> = {}
  for (const e of lastEvents) logMap[e._id] = e

  const data = DEVICES.map(d => {
    const hw  = settings.hardware[d]
    const log = logMap[d]
    return {
      device:    d,
      enabled:   hw?.enabled ?? false,
      ip:        hw?.ip ?? '',
      port:      hw?.port ?? 80,
      success:   log?.success   ?? null,
      latencyMs: log?.latencyMs ?? null,
      lastSeen:  log?.lastSeen  ?? null,
      event:     log?.event     ?? null,
    }
  })

  return NextResponse.json(data)
}
