import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Fine } from '@/models/Fine'
import { getSettings } from '@/models/SystemSettings'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  await connectDB()

  const doc = await Fine.findByIdAndUpdate(id, { $set: body }, { new: true })
  if (!doc) return NextResponse.json({ error: 'ไม่พบ' }, { status: 404 })

  // Only one fine of a given type can be "active" at a time — see POST /api/fines.
  if (body.isActive) {
    await Fine.updateMany({ _id: { $ne: doc._id }, fineType: doc.fineType }, { $set: { isActive: false } })
    if (doc.fineType === 'after_hours') {
      const settings = await getSettings()
      settings.afterHoursFine = doc.amount
      await settings.save()
    }
  }

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
