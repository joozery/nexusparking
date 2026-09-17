import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Fine } from '@/models/Fine'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  await connectDB()

  const doc = await Fine.findByIdAndUpdate(id, { $set: body }, { new: true })
  if (!doc) return NextResponse.json({ error: 'ไม่พบ' }, { status: 404 })

  return NextResponse.json(doc)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await connectDB()
  await Fine.findByIdAndDelete(id)
  return NextResponse.json({ ok: true })
}
