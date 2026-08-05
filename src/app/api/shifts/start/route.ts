import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { Shift } from '@/models/Shift'
import { Admin } from '@/models/Admin'
import { ParkingSession } from '@/models/ParkingSession'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const openingFloat: number = Number(body.openingFloat ?? 0)

  const jar     = await cookies()
  const token   = jar.get(COOKIE_NAME)?.value
  const payload = token ? verifyToken(token) : null
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  // ดึงชื่อจริงจาก DB
  let operatorName = payload.name
  if (payload.sub !== 'env-admin') {
    const admin = await Admin.findById(payload.sub).select('name').lean() as { name: string } | null
    if (admin?.name) operatorName = admin.name
  }

  // ป้องกันเปิดกะซ้ำ
  const existing = await Shift.findOne({ operatorId: payload.sub, status: 'active' })
  if (existing) return NextResponse.json({ error: 'มีกะที่เปิดอยู่แล้ว' }, { status: 409 })

  // นับรถค้างในลานตอนเริ่มกะ
  const carryoverCars = await ParkingSession.countDocuments({ status: 'active' })

  const shift = await Shift.create({
    operatorId:   payload.sub,
    operatorName,
    startTime:    new Date(),
    status:       'active',
    openingFloat,
    carryoverCars,
  })

  return NextResponse.json(shift, { status: 201 })
}
