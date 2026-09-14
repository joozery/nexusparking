import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Fine } from '@/models/Fine'
import { getSettings } from '@/models/SystemSettings'

export async function GET(req: NextRequest) {
  await connectDB()
  const onlyActive = new URL(req.url).searchParams.get('active') === '1'
  const filter = onlyActive ? { isActive: true } : {}
  const fines = await Fine.find(filter).sort({ createdAt: -1 }).lean()
  return NextResponse.json(fines)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, fineType, amount, description, isActive = true } = body

    if (!name || !fineType || amount == null)
      return NextResponse.json({ error: 'name, fineType, amount จำเป็น' }, { status: 400 })

    await connectDB()
    const doc = await Fine.create({ name, fineType, amount, description, isActive })

    // Only one fine of a given type can be "active" at a time — it's what checkout actually
    // charges, unlike discounts which operators pick manually per transaction.
    if (isActive) {
      await Fine.updateMany({ _id: { $ne: doc._id }, fineType }, { $set: { isActive: false } })
      if (fineType === 'after_hours') {
        const settings = await getSettings()
        settings.afterHoursFine = amount
        await settings.save()
      }
    }

    return NextResponse.json(doc, { status: 201 })
  } catch (err) {
    console.error('[POST /api/fines]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
