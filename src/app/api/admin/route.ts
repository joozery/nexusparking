import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { connectDB } from '@/lib/mongodb'
import { Admin } from '@/models/Admin'
import { verifyToken, hashPassword, COOKIE_NAME } from '@/lib/auth'

async function requireAdmin() {
  const jar   = await cookies()
  const token = jar.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

// GET — list all admins
export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const admins = await Admin.find({}, '-passwordHash').sort({ createdAt: 1 }).lean()
  return NextResponse.json(admins)
}

// POST — create new admin (superadmin only)
export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session || session.role !== 'superadmin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { username, password, name, role } = await req.json()
  if (!username || !password || !name)
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 })

  await connectDB()
  const exists = await Admin.findOne({ username: username.trim().toLowerCase() })
  if (exists) return NextResponse.json({ error: 'Username นี้มีแล้ว' }, { status: 409 })

  const admin = await Admin.create({
    username: username.trim().toLowerCase(),
    passwordHash: hashPassword(password),
    name: name.trim(),
    role: role ?? 'operator',
    isActive: true,
  })
  const { passwordHash: _, ...safe } = admin.toObject()
  void _
  return NextResponse.json(safe, { status: 201 })
}
