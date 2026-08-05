import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { Shift } from '@/models/Shift'

export async function GET() {
  const jar     = await cookies()
  const token   = jar.get(COOKIE_NAME)?.value
  const payload = token ? verifyToken(token) : null
  if (!payload) return NextResponse.json(null, { status: 401 })

  await connectDB()
  const shift = await Shift.findOne({ operatorId: payload.sub, status: 'active' }).lean()
  return NextResponse.json(shift ?? null)
}
