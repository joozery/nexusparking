import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { Shift } from '@/models/Shift'
import { Admin } from '@/models/Admin'
import { ParkingSession } from '@/models/ParkingSession'
import { getSettings } from '@/models/SystemSettings'
import { sendLineMessage, buildShiftStartMessage } from '@/lib/lineNotify'
import { triggerDrawer, printRaw } from '@/lib/hardware'
import { buildShiftStartSlip } from '@/lib/escpos'

export async function POST(req: NextRequest) {
  try {
  const body = await req.json().catch(() => ({}))
  const openingFloat: number = Number(body.openingFloat ?? 0)
  const openingBreakdown: Record<string, number> = body.openingBreakdown ?? {}

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

  const cfg = await getSettings()
  const shift = await Shift.create({
    operatorId:   payload.sub,
    operatorName,
    startTime:    new Date(),
    status:       'active',
    openingFloat,
    openingBreakdown,
    carryoverCars,
  })


  // เปิดลิ้นชัก — operator ต้องใส่เงินทอนตั้งต้น (opening float) ลงลิ้นชักตอนเข้ากะ
  void triggerDrawer(cfg.hardware).catch(() => {})
  void printRaw(cfg.hardware, buildShiftStartSlip({ operatorName, startTime: shift.startTime, openingFloat, carryoverCars })).catch(() => {})

  // LINE notification — fire and forget
  if (cfg.line?.enabled && cfg.line.channelToken && cfg.line.targets?.length) {
    sendLineMessage(
      cfg.line.channelToken,
      cfg.line.targets,
      buildShiftStartMessage(operatorName, shift.startTime, carryoverCars),
    ).catch(() => {})
  }

  return NextResponse.json(shift, { status: 201 })
  } catch (error) {
    console.error('[shifts/start]', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: 'เริ่มกะไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูลและสถานะกะก่อนลองใหม่' }, { status: 503 })
  }
}
