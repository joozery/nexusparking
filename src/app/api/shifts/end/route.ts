import { NextRequest, NextResponse } from 'next/server'
import { parkingMutation } from '@/lib/parkingMutation'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { Shift } from '@/models/Shift'
import { ParkingQueue } from '@/models/ParkingQueue'
import { ParkingSession } from '@/models/ParkingSession'
import { countActiveVehicles, countActiveVehiclesByBilling } from '@/lib/countActiveVehicles'
import { countRemainingTemporaryCards } from '@/lib/countRemainingTemporaryCards'
import { getSettings } from '@/models/SystemSettings'
import { sendLineMessage, buildShiftEndMessage } from '@/lib/lineNotify'
import { triggerDrawer, printRaw } from '@/lib/hardware'
import { buildShiftEndSlip } from '@/lib/escpos'
import { calcFeeBreakdown } from '@/lib/calcFee'

async function handlePost(req: NextRequest) {
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
  const closingByType = await countActiveVehicles()
  const closingCarCount = closingByType.car + closingByType.motorcycle
  const cfg = await getSettings()
  const closingByBilling = await countActiveVehiclesByBilling(cfg.rates.overnight, new Date())
  const checkoutRows = await ParkingSession.find({
    shiftId: String(shift._id),
    status: { $in: ['completed', 'lost'] },
  }).select('cardType entryTime exitTime discountAmount').lean()
  const discountTotal = checkoutRows.reduce((sum, row) => sum + (row.discountAmount ?? 0), 0)
  const checkoutsByBilling = { carNormal: 0, carOvernight: 0, motorcycleNormal: 0, motorcycleOvernight: 0 }
  for (const row of checkoutRows) {
    const cardType = row.cardType as 'car' | 'motorcycle' | 'overnight'
    const entryTime = new Date(row.entryTime)
    const exitTime = row.exitTime ? new Date(row.exitTime) : new Date()
    const overnight = cardType === 'overnight' || calcFeeBreakdown(cardType, entryTime, exitTime, cfg.rates.overnight).segments.some(segment => segment.kind === 'overnight')
    if (cardType === 'motorcycle') {
      if (overnight) checkoutsByBilling.motorcycleOvernight++
      else checkoutsByBilling.motorcycleNormal++
    } else if (overnight) {
      checkoutsByBilling.carOvernight++
    } else {
      checkoutsByBilling.carNormal++
    }
  }
  const temporaryCardsRemaining = await countRemainingTemporaryCards()
  // Count each queue visit once, including visits already admitted or cancelled.
  const queuedRows = await ParkingQueue.aggregate<{ _id: string; count: number }>([
    { $match: { shiftId: String(shift._id) } },
    { $group: { _id: '$cardType', count: { $sum: 1 } } },
  ])
  const queuedByType = {
    car: queuedRows.find(row => row._id === 'car')?.count ?? 0,
    motorcycle: queuedRows.find(row => row._id === 'motorcycle')?.count ?? 0,
  }

  shift.status           = 'closed'
  // Count distinct cards reported lost in this shift, including zero-fee reports.
  // Older sessions recorded only the fine or the lost status.
  const lostCardSessions = await ParkingSession.find({
    shiftId: String(shift._id),
    status: { $in: ['completed', 'lost'] },
    $or: [{ lostCard: true }, { lostFine: { $gt: 0 } }, { status: 'lost' }],
  }).select('cardUid lostFine').lean()
  const lostCardsCount = new Set(lostCardSessions.map(session => session.cardUid)).size
  const lostCardsFineTotal = lostCardSessions.reduce((sum, session) => sum + (session.lostFine ?? 0), 0)
  const otherFines = await ParkingSession.aggregate<{ _id: string | null; count: number; total: number }>([
    { $match: { shiftId: String(shift._id), status: { $in: ['completed', 'lost'] }, fineAmount: { $gt: 0 } } },
    { $group: { _id: '$fineName', count: { $sum: 1 }, total: { $sum: '$fineAmount' } } },
    { $sort: { _id: 1 } },
  ])
  shift.endTime          = new Date()
  shift.closingFloat     = closingFloat
  shift.closingBreakdown = new Map(Object.entries(closingBreakdown))
  shift.closingCarCount  = closingCarCount
  shift.closingByType = closingByType
  shift.closingByBilling = closingByBilling
  shift.closingCardsByType = temporaryCardsRemaining
  await shift.save()


  // เปิดลิ้นชัก — operator ต้องนับเงินปิดกะ (closing float) ออกจากลิ้นชัก
  void triggerDrawer(cfg.hardware).catch(() => {})
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
    checkinsByType: shift.checkinsByType,
    checkoutsByType: shift.checkoutsByType,
    closingByType,
    closingByBilling,
    closingCardsByType: temporaryCardsRemaining,
  })).catch(() => {})

  // LINE notification — fire and forget
  if (cfg.line?.enabled && cfg.line.channelToken && cfg.line.targets?.length) {
    sendLineMessage(
      cfg.line.channelToken,
      cfg.line.targets,
      buildShiftEndMessage({
        cardRefunds: shift.cardRefunds,
        operatorName:   shift.operatorName,
        startTime:      shift.startTime,
        endTime:        shift.endTime!,
        checkinsCount:  shift.checkinsCount,
        checkoutsCount: shift.checkoutsCount,
        checkinsByType: shift.checkinsByType,
        checkoutsByType: shift.checkoutsByType,
        checkoutsByBilling,
        cashAmount:     shift.cashAmount,
        qrAmount:       shift.qrAmount,
        totalAmount:    shift.totalAmount,
        openingFloat:   shift.openingFloat,
        closingFloat: shift.closingFloat,
        closingBreakdown: Object.fromEntries(shift.closingBreakdown),
        closingCarCount,
        closingByType,
        closingByBilling,
        discountTotal,
        temporaryCardsRemaining,
        queuedByType,
        lostCardsCount,
        lostCardsFineTotal,
        otherFines: otherFines.map(fine => ({ name: fine._id || 'ค่าปรับอื่น', count: fine.count, total: fine.total })),
      }),
    ).catch(() => {})
  }

  return NextResponse.json(shift)
}
export const POST = parkingMutation(handlePost)
