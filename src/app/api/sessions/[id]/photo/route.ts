import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import { connectDB } from '@/lib/mongodb'
import { ParkingSession } from '@/models/ParkingSession'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id }  = await params
  const type    = new URL(req.url).searchParams.get('type')
  if (type !== 'entry' && type !== 'exit') {
    return NextResponse.json({ error: 'type must be entry or exit' }, { status: 400 })
  }

  await connectDB()
  const session = await ParkingSession.findById(id).lean()
  if (!session) return NextResponse.json({ error: 'ไม่พบรายการนี้' }, { status: 404 })

  const filePath = type === 'entry' ? session.entryPhotoPath : session.exitPhotoPath
  if (!filePath) return NextResponse.json({ error: 'ไม่มีภาพสำหรับรายการนี้' }, { status: 404 })

  try {
    const buf = await fs.readFile(filePath)
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
