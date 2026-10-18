import fs from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE_NAME, verifyToken } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { CustomerRegistration } from '@/models/CustomerRegistration'

export async function GET(req: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  const user = token ? verifyToken(token) : null
  if (!user || !['admin', 'superadmin'].includes(user.role)) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงเอกสาร' }, { status: 403 })
  const refCode = (await params).ref.trim().toUpperCase()
  const type = new URL(req.url).searchParams.get('type')
  const photoType = type === 'id-card' ? 'id-card' : type === 'vehicle' ? 'vehicle' : null
  if (!/^A20-[0-9]{6}$/.test(refCode) || !photoType) return NextResponse.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 400 })
  await connectDB()
  const row = await CustomerRegistration.findOne({ refCode }).select('idCardPhotoPath vehicleRegistrationPhotoPath').lean()
  if (!row) return NextResponse.json({ error: 'ไม่พบข้อมูล' }, { status: 404 })
  const filePath = photoType === 'id-card' ? row.idCardPhotoPath : row.vehicleRegistrationPhotoPath
  try {
    const body = await fs.readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
    return new NextResponse(body, { headers: { 'Content-Type': contentType, 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'ไม่พบไฟล์เอกสาร' }, { status: 404 })
  }
}
