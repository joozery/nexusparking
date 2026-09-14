import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { Shift } from '@/models/Shift'
import { ParkingSession } from '@/models/ParkingSession'
import { getSettings } from '@/models/SystemSettings'
import { sendLineMessage, buildShiftEndMessage } from '@/lib/lineNotify'
import { triggerDrawer, printRaw } from '@/lib/hardware'
import { buildShiftEndSlip } from '@/lib/escpos'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const closingFloat: number = Number(body.closingFloat ?? 0)
  const closingBreakdown: Record<string, number> = body.closingBreakdown ?? {}

  const jar     = await cookies()
  const token   = jar.get(COOKIE_NAME)?.value
  const payload = token ? verifyToken(token) : null
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const shift = await Shift.findOne({ operatorId: payload.sub, status: 'active' })
  if (!shift) return NextResponse.json({ error: 'ไม่มีกะที่เปิดอยู่' }, { status: 404 })

  // นับรถที่ยังค้างอยู่ตอนปิดกะ
  const closingCarCount = await ParkingSession.countDocuments({ status: 'active' })

  shift.status           = 'closed'
  shift.endTime          = new Date()
  shift.closingFloat     = closingFloat
  shift.closingBreakdown = new Map(Object.entries(closingBreakdown))
  shift.closingCarCount  = closingCarCount
  await shift.save()

  const cfg = await getSettings()

  // เปิดลิ้นชัก — operator ต้องนับเงินปิดกะ (closing float) ออกจากลิ้นชัก
  void triggerDrawer(cfg.hardware)
  void printRaw(cfg.hardware, buildShiftEndSlip({
    operatorName:   shift.operatorName,
    startTime:      shift.startTime,
    endTime:        shift.endTime!,
    checkinsCount:  shift.checkinsCount,
    checkoutsCount: shift.checkoutsCount,
    cashAmount:     shift.cashAmount,
    qrAmount:       shift.qrAmount,
    totalAmount:    shift.totalAmount,
    openingFloat:   shift.openingFloat,
    closingFloat,
    closingCarCount,
  }))

  // LINE notification — fire and forget
  if (cfg.line?.enabled && cfg.line.channelToken && cfg.line.targets?.length) {
    sendLineMessage(
      cfg.line.channelToken,
      cfg.line.targets,
      buildShiftEndMessage({
        operatorName:   shift.operatorName,
        startTime:      shift.startTime,
        endTime:        shift.endTime!,
        checkinsCount:  shift.checkinsCount,
        checkoutsCount: shift.checkoutsCount,
        cashAmount:     shift.cashAmount,
        qrAmount:       shift.qrAmount,
        totalAmount:    shift.totalAmount,
        openingFloat:   shift.openingFloat,
        closingFloat,
        closingCarCount,
      }),
    ).catch(() => {})
  }

  return NextResponse.json(shift)
}
