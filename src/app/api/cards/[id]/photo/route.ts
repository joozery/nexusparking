import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { connectDB } from '@/lib/mongodb'
import { ParkingCard } from '@/models/ParkingCard'

const CAPTURE_DIR = process.env.CAPTURE_DIR ?? path.join(process.cwd(), 'captures')
const ID_CARD_DIR = path.join(CAPTURE_DIR, 'id-cards')

// GET /api/cards/:id/photo — สตรีมรูปบัตรประชาชนที่อัปโหลดไว้กลับมา
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  await connectDB()
  const card = await ParkingCard.findById(id).lean()
  if (!card) return NextResponse.json({ error: 'ไม่พบบัตรนี้' }, { status: 404 })
  if (!card.idCardPhotoPath) return NextResponse.json({ error: 'ยังไม่มีรูปบัตรประชาชน' }, { status: 404 })

  try {
    const buf = await fs.readFile(card.idCardPhotoPath)
    return new NextResponse(buf, {
      headers: {
        'Content-Type':  'image/jpeg',
        'Cache-Control': 'private, max-age=86400',
      },
    })
  } catch {
    return NextResponse.json({ error: 'ไฟล์ภาพไม่พบ (อาจถูกลบหรือย้าย)' }, { status: 404 })
  }
}

// POST /api/cards/:id/photo — อัปโหลด/แทนที่รูปบัตรประชาชน (multipart/form-data, field name "photo")
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  await connectDB()
  const card = await ParkingCard.findById(id)
  if (!card) return NextResponse.json({ error: 'ไม่พบบัตรนี้' }, { status: 404 })

  const form = await req.formData()
  const file = form.get('photo')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'ไม่พบไฟล์รูปภาพ' }, { status: 400 })
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'รองรับเฉพาะไฟล์รูปภาพ' }, { status: 400 })
  }

  const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
  const fileName = `${id}_${Date.now()}.${ext}`
  const filePath = path.join(ID_CARD_DIR, fileName)

  await fs.mkdir(ID_CARD_DIR, { recursive: true })
  const buf = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(filePath, buf)

  // ลบไฟล์เก่าทิ้ง ถ้ามีการอัปโหลดแทนที่
  if (card.idCardPhotoPath && card.idCardPhotoPath !== filePath) {
    await fs.unlink(card.idCardPhotoPath).catch(() => {})
  }

  card.idCardPhotoPath = filePath
  await card.save()

  return NextResponse.json({ success: true })
}
