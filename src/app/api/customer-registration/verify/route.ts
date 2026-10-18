import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { CustomerRegistration } from '@/models/CustomerRegistration'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const refCode = typeof body.refCode === 'string' ? body.refCode.trim().toUpperCase() : ''
  if (!/^A20-[0-9]{6}$/.test(refCode)) return NextResponse.json({ error: 'รูปแบบเลข Ref ไม่ถูกต้อง' }, { status: 400 })
  await connectDB()
  const row = await CustomerRegistration.findOneAndUpdate({ refCode }, { $set: { verifiedAt: new Date() } }, { new: true }).select('refCode fullName verifiedAt').lean()
  if (!row) return NextResponse.json({ error: 'ไม่พบเลข Ref นี้' }, { status: 404 })
  return NextResponse.json({ success: true, refCode: row.refCode, fullName: row.fullName, verifiedAt: row.verifiedAt })
}
