import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ParkingCard } from '@/models/ParkingCard'

export async function GET() {
  await connectDB()
  const cards = await ParkingCard.find().sort({ createdAt: -1 }).lean()
  return NextResponse.json(cards)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { uid, type, cardCategory, label, ownerName, plate, phone, address, expiryDate } = body

  if (!uid || !type) {
    return NextResponse.json({ error: 'uid and type are required' }, { status: 400 })
  }

  await connectDB()

  const existing = await ParkingCard.findOne({ uid: uid.trim() })
  if (existing) {
    return NextResponse.json({ error: 'UID นี้ถูกลงทะเบียนแล้ว' }, { status: 409 })
  }

  const card = await ParkingCard.create({
    uid: uid.trim(),
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
}
