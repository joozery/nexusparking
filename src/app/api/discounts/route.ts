import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Discount } from '@/models/Discount'

export async function GET(req: NextRequest) {
  await connectDB()
  const onlyActive = new URL(req.url).searchParams.get('active') === '1'
  const filter = onlyActive ? { isActive: true } : {}
  const discounts = await Discount.find(filter).sort({ name: 1 }).lean()
  return NextResponse.json(discounts)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, discountType, discountValue, maxDiscount, description } = body

    if (!name || !discountType || discountValue == null)
      return NextResponse.json({ error: 'name, discountType, discountValue จำเป็น' }, { status: 400 })

    await connectDB()
    const doc = await Discount.create({ name, discountType, discountValue, maxDiscount, description })
    return NextResponse.json(doc, { status: 201 })
  } catch (err) {
    console.error('[POST /api/discounts]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
