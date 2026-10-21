import { randomInt } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE_NAME, verifyToken } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { CustomerFormLink } from '@/models/CustomerFormLink'

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url)
  const publicSlug = requestUrl.searchParams.get('slug')?.trim() ?? ''
  if (publicSlug) {
    await connectDB()
    const publicLink = await CustomerFormLink.findOne({ slug: publicSlug, active: true }).select('slug kind').lean()
    if (!publicLink) return NextResponse.json({ error: 'ลิงก์นี้ไม่พร้อมใช้งาน' }, { status: 404 })
    return NextResponse.json({ slug: publicLink.slug, kind: publicLink.kind })
  }
  const token = (await cookies()).get(COOKIE_NAME)?.value
  const user = token ? verifyToken(token) : null
  if (!user || !['admin', 'superadmin'].includes(user.role)) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงลิงก์' }, { status: 403 })
  await connectDB()
  const kind = new URL(req.url).searchParams.get('kind') === 'return' ? 'return' : 'lost'
  const link = await CustomerFormLink.findOne({ kind, active: true }).sort({ createdAt: -1 }).select('slug').lean()
  if (!link) return NextResponse.json({ link: null })
  return NextResponse.json({ link: { slug: link.slug, url: `${new URL(req.url).origin}/register/${link.slug}` } })
}

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
  await CustomerFormLink.updateMany({ kind, slug: { $ne: slug }, active: true }, { $set: { active: false } })
  const origin = new URL(req.url).origin
  return NextResponse.json({ slug, url: `${origin}/register/${slug}` })
}
