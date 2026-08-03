import { NextRequest, NextResponse } from 'next/server'

// GET — check if first-time setup is needed
// Returns needsSetup: false if env-admin exists (always has one)
export async function GET() {
  // If env admin is configured, no setup needed
  if (process.env.ADMIN_PASSWORD_HASH) {
    return NextResponse.json({ needsSetup: false })
  }
  // Try DB
  try {
    const { connectDB } = await import('@/lib/mongodb')
    const { Admin }     = await import('@/models/Admin')
    await connectDB()
    const count = await Admin.countDocuments()
    return NextResponse.json({ needsSetup: count === 0 })
  } catch {
    // DB unavailable and no env admin → show setup
    return NextResponse.json({ needsSetup: true })
  }
}

// POST — create first superadmin in DB
export async function POST(req: NextRequest) {
  const { username, password, name } = await req.json()
  if (!username || !password || !name)
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 })

  try {
    const { connectDB }   = await import('@/lib/mongodb')
    const { Admin }       = await import('@/models/Admin')
    const { hashPassword } = await import('@/lib/auth')
    await connectDB()
    const count = await Admin.countDocuments()
    if (count > 0) return NextResponse.json({ error: 'ระบบมีแอดมินแล้ว' }, { status: 403 })

    const admin = await Admin.create({
      username: username.trim().toLowerCase(),
      passwordHash: hashPassword(password),
      name, role: 'superadmin', isActive: true,
    })
    return NextResponse.json({ ok: true, name: admin.name }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูล — ใช้บัญชีจาก .env แทน' }, { status: 503 })
  }
}
