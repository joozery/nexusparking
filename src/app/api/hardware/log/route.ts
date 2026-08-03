import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { HardwareLog } from '@/models/HardwareLog'

// GET /api/hardware/log?limit=50&device=barrier
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
  const device = searchParams.get('device')

  await connectDB()

  const filter = device ? { device } : {}
  const logs = await HardwareLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()

  return NextResponse.json(logs)
}
