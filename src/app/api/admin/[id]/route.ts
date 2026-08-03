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

// PATCH — update admin (name, role, isActive, password)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session || session.role !== 'superadmin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const update: Record<string, unknown> = {}
  if (body.name)     update.name    = body.name
  if (body.role)     update.role    = body.role
  if ('isActive' in body) update.isActive = body.isActive
  if (body.password) update.passwordHash  = hashPassword(body.password)

  await connectDB()
  const admin = await Admin.findByIdAndUpdate(id, update, { new: true }).select('-passwordHash')
  if (!admin) return NextResponse.json({ error: 'ไม่พบแอดมิน' }, { status: 404 })
  return NextResponse.json(admin)
}

// DELETE — soft delete (deactivate)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session || session.role !== 'superadmin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (id === session.sub) return NextResponse.json({ error: 'ไม่สามารถลบตัวเองได้' }, { status: 400 })

  await connectDB()
  await Admin.findByIdAndDelete(id)
  return NextResponse.json({ ok: true })
}
