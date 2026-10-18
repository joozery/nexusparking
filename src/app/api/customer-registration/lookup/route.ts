import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE_NAME, verifyToken } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { CustomerRegistration } from '@/models/CustomerRegistration'

export async function GET(req: NextRequest) {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  if (!token || !verifyToken(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const refCode = new URL(req.url).searchParams.get('ref')?.trim().toUpperCase() ?? ''
  const kind = new URL(req.url).searchParams.get('kind') === 'return' ? 'return' : 'lost'
  if (!/^A20-[0-9]{6}$/.test(refCode)) return NextResponse.json({ error: 'กรุณากรอกเลข Ref ให้ถูกต้อง' }, { status: 400 })
  await connectDB()
  const row = await CustomerRegistration.findOne({ refCode, kind }).select('refCode fullName verifiedAt').lean()
  if (!row) return NextResponse.json({ error: 'ไม่พบข้อมูลจากเลข Ref นี้' }, { status: 404 })
  return NextResponse.json({ refCode: row.refCode, fullName: row.fullName, verifiedAt: row.verifiedAt ?? null })
}
