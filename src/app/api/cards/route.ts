import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ParkingCard } from '@/models/ParkingCard'
import { normalizeUid } from '@/lib/thaiInput'

function duplicateCardError(cardCategory?: string) {
  const category = cardCategory === 'monthly' ? 'รายเดือน' : 'ชั่วคราว'
  return NextResponse.json(
    { error: `UID นี้ลงทะเบียนเป็นบัตร${category}อยู่แล้ว ไม่สามารถใช้ซ้ำข้ามประเภทได้` },
    { status: 409 },
  )
}

export async function GET() {
  await connectDB()
  const cards = await ParkingCard.find().sort({ createdAt: -1 }).lean()
  return NextResponse.json(cards)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { uid, type, cardCategory, label, ownerName, plate, phone, address, expiryDate } = body

  const normalizedUid = typeof uid === 'string' ? normalizeUid(uid) : ''
  if (!normalizedUid || !type) {
    return NextResponse.json({ error: 'uid and type are required' }, { status: 400 })
  }

  await connectDB()

  const existing = await ParkingCard.findOne({ uid: normalizedUid })
  if (existing) {
    return duplicateCardError(existing.cardCategory)
  }

  try {
    const card = await ParkingCard.create({
      uid: normalizedUid,
      type,
      cardCategory: cardCategory === 'monthly' ? 'monthly' : 'temporary',
      label: label ?? '',
      ownerName: ownerName ?? '',
      plate: plate ?? '',
      phone: phone ?? '',
      address: address ?? '',
      expiryDate: expiryDate || null,
    })
    return NextResponse.json(card, { status: 201 })
  } catch (error) {
    // The unique index is the final guard if two requests race past findOne().
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      const duplicate = await ParkingCard.findOne({ uid: normalizedUid }).lean()
      return duplicateCardError(duplicate?.cardCategory)
    }
    throw error
  }
}
