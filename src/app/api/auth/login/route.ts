import { NextRequest, NextResponse } from 'next/server'
import { signToken, verifyPassword, COOKIE_NAME, COOKIE_OPTIONS } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()
  if (!username || !password)
    return NextResponse.json({ error: 'กรุณากรอก username และ password' }, { status: 400 })

  const input = username.trim().toLowerCase()

  // ── 1. Try MongoDB first ──────────────────────────────────────
  try {
    const { connectDB } = await import('@/lib/mongodb')
    const { Admin }     = await import('@/models/Admin')
    await connectDB()
    const admin = await Admin.findOne({ username: input, isActive: true })
    if (admin && verifyPassword(password, admin.passwordHash)) {
      admin.lastLoginAt = new Date()
      await admin.save()
      const token = signToken({ sub: String(admin._id), name: admin.name, role: admin.role })
      const res = NextResponse.json({ name: admin.name, role: admin.role })
      res.cookies.set(COOKIE_NAME, token, COOKIE_OPTIONS)
      return res
    }
    if (admin) return NextResponse.json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })
  } catch {
    // DB unavailable — fall through to env fallback
  }

  // ── 2. Env-var fallback admin ─────────────────────────────────
  const envUser = (process.env.ADMIN_USERNAME ?? 'admin').toLowerCase()
  const envHash = process.env.ADMIN_PASSWORD_HASH ?? ''
  const envName = process.env.ADMIN_NAME ?? 'System Admin'

  if (input === envUser && envHash && verifyPassword(password, envHash)) {
    const token = signToken({ sub: 'env-admin', name: envName, role: 'superadmin' })
    const res = NextResponse.json({ name: envName, role: 'superadmin' })
    res.cookies.set(COOKIE_NAME, token, COOKIE_OPTIONS)
    return res
  }

  return NextResponse.json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })
}
