import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Fine } from '@/models/Fine'

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
    const { name, amount, description, isActive = true } = body

    if (!name || amount == null)
      return NextResponse.json({ error: 'name, amount จำเป็น' }, { status: 400 })

    await connectDB()
    const doc = await Fine.create({ name, amount, description, isActive })

    return NextResponse.json(doc, { status: 201 })
  } catch (err) {
    console.error('[POST /api/fines]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
