import { randomInt } from 'node:crypto'
import fs from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE_NAME, verifyToken } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { CustomerFormLink } from '@/models/CustomerFormLink'
import { CustomerRegistration } from '@/models/CustomerRegistration'

const STORAGE_DIR = path.join(process.env.CAPTURE_DIR ?? path.join(process.cwd(), 'captures'), 'customer-registrations')

export async function GET(req: NextRequest) {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  const user = token ? verifyToken(token) : null
  if (!user || !['admin', 'superadmin'].includes(user.role)) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูล' }, { status: 403 })
  await connectDB()
  const kind = new URL(req.url).searchParams.get('kind') === 'return' ? 'return' : 'lost'
  const rows = await CustomerRegistration.find({ kind })
    .select('refCode fullName phone verifiedAt createdAt')
    .sort({ createdAt: -1 }).limit(200).lean()
  return NextResponse.json({ registrations: rows })
}

function clean(value: FormDataEntryValue | null, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

async function saveImage(file: File, ref: string, label: string) {
  if (!file.type.startsWith('image/')) throw new Error('รองรับเฉพาะไฟล์รูปภาพ')
  if (file.size > 8 * 1024 * 1024) throw new Error('รูปภาพต้องมีขนาดไม่เกิน 8 MB')
  const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg'
  const filePath = path.join(STORAGE_DIR, `${ref}_${label}.${ext}`)
  await fs.mkdir(STORAGE_DIR, { recursive: true })
  await fs.writeFile(filePath, Buffer.from(await file.arrayBuffer()))
  return filePath
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const slug = clean(form.get('slug'), 32)
    const fullName = clean(form.get('fullName'), 120)
    const phone = clean(form.get('phone'), 30)
    const idCard = form.get('idCardPhoto')
    const vehiclePhoto = form.get('vehicleRegistrationPhoto')
    if (!slug || !fullName || !phone || !(idCard instanceof File) || !(vehiclePhoto instanceof File)) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลและแนบเอกสารให้ครบ' }, { status: 400 })
    }
    if (!/^[0-9]{4,32}$/.test(slug)) return NextResponse.json({ error: 'ลิงก์แบบฟอร์มไม่ถูกต้อง' }, { status: 400 })

    await connectDB()
    const link = await CustomerFormLink.findOne({ slug, active: true }).lean()
    if (!link) return NextResponse.json({ error: 'ลิงก์นี้ไม่พร้อมใช้งาน' }, { status: 404 })

    let refCode = ''
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = `A20-${String(randomInt(100000, 1000000))}`
      if (!await CustomerRegistration.exists({ refCode: candidate })) { refCode = candidate; break }
    }
    if (!refCode) return NextResponse.json({ error: 'สร้างเลข Ref ไม่สำเร็จ กรุณาลองใหม่' }, { status: 503 })

    const idCardPhotoPath = await saveImage(idCard, refCode, 'id-card')
    let vehicleRegistrationPhotoPath = ''
    try {
      vehicleRegistrationPhotoPath = await saveImage(vehiclePhoto, refCode, 'vehicle')
      await CustomerRegistration.create({ kind: link.kind, refCode, linkSlug: slug, fullName, phone, idCardPhotoPath, vehicleRegistrationPhotoPath })
    } catch (error) {
      await fs.unlink(idCardPhotoPath).catch(() => {})
      if (vehicleRegistrationPhotoPath) await fs.unlink(vehicleRegistrationPhotoPath).catch(() => {})
      throw error
    }
    return NextResponse.json({ success: true, refCode })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'บันทึกข้อมูลไม่สำเร็จ' }, { status: 400 })
  }
}
