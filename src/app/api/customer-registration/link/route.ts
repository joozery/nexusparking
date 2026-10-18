import { randomInt } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE_NAME, verifyToken } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { CustomerFormLink } from '@/models/CustomerFormLink'

export async function POST(req: NextRequest) {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  const user = token ? verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const kind = body.kind === 'return' ? 'return' : 'lost'
  await connectDB()
  let slug = ''
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = String(randomInt(1000, 10000))
    if (!await CustomerFormLink.exists({ slug: candidate })) { slug = candidate; break }
  }
  if (!slug) return NextResponse.json({ error: 'สร้างลิงก์ใหม่ไม่สำเร็จ กรุณาลองอีกครั้ง' }, { status: 503 })

  await CustomerFormLink.create({ slug, kind, createdBy: user.sub })
  const origin = new URL(req.url).origin
  return NextResponse.json({ slug, url: `${origin}/register/${slug}` })
}
