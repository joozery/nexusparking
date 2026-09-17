import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ParkingCard } from '@/models/ParkingCard'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  // UID is immutable: changing it could bypass the one-physical-card/one-record rule.
  const allowedFields = [
    'type', 'cardCategory', 'label', 'ownerName', 'plate', 'phone', 'address',
    'expiryDate', 'isActive',
  ] as const
  const update = Object.fromEntries(
    allowedFields.filter(field => Object.hasOwn(body, field)).map(field => [field, body[field]]),
  )
  await connectDB()
  const card = await ParkingCard.findByIdAndUpdate(id, update, { new: true, runValidators: true })
  if (!card) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(card)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await connectDB()
  const card = await ParkingCard.findByIdAndDelete(id)
  if (!card) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
