import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE_NAME, verifyToken } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { normalizeUid } from '@/lib/thaiInput'
import { ParkingCard } from '@/models/ParkingCard'

export async function POST(req: NextRequest) {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  const user = token ? verifyToken(token) : null
  if (!user || !['admin', 'superadmin'].includes(user.role)) return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ' }, { status: 403 })
  const body = await req.json().catch(() => null)
  if (!body || !['car', 'motorcycle'].includes(body.type) || !Array.isArray(body.uids) || !body.uids.length || body.uids.length > 200 || body.uids.some((v: unknown) => typeof v !== 'string' || !/^[a-zA-Z0-9]{1,64}$/.test(normalizeUid(v)))) {
    return NextResponse.json({ error: 'ข้อมูลบัตรไม่ถูกต้อง รับได้ครั้งละไม่เกิน 200 ใบ' }, { status: 400 })
  }
  try {
    await connectDB()
    const results: { uid: string; status: string; error?: string }[] = []
    for (const uid of new Set<string>(body.uids.map((v: string) => normalizeUid(v)))) {
      try {
        await ParkingCard.create({ uid, type: body.type, cardCategory: 'temporary', isActive: true })
        results.push({ uid, status: 'saved' })
      } catch (error) {
        const duplicate = (error as { code?: number }).code === 11000
        results.push({ uid, status: duplicate ? 'duplicate' : 'failed', error: duplicate ? 'บัตรนี้ลงทะเบียนไว้แล้ว' : 'บันทึกไม่สำเร็จ กรุณาลองใหม่' })
      }
    }
    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ error: 'เชื่อมต่อฐานข้อมูลไม่สำเร็จ รายการสแกนยังเก็บไว้ให้ลองใหม่' }, { status: 503 })
  }
}
