import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'

export async function GET() {
  const jar   = await cookies()
  const token = jar.get(COOKIE_NAME)?.value
  if (!token) return NextResponse.json(null, { status: 401 })
  const payload = verifyToken(token)
  if (!payload) return NextResponse.json(null, { status: 401 })
  return NextResponse.json({ sub: payload.sub, name: payload.name, role: payload.role })
}
