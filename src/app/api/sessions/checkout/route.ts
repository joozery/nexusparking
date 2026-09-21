import { parkingMutation } from '@/lib/parkingMutation'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { ParkingSession } from '@/models/ParkingSession'
import { ParkingQueue } from '@/models/ParkingQueue'
import { Shift } from '@/models/Shift'
import { Discount } from '@/models/Discount'
import { Fine } from '@/models/Fine'
import { getSettings } from '@/models/SystemSettings'
import { calcFeeFromMinutes, calcFeeBreakdown, calcDurationMinutes } from '@/lib/calcFee'
import { runCheckoutSequence } from '@/lib/hardware'

export async function GET(req: NextRequest) {
  const uid = new URL(req.url).searchParams.get('uid')
  if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 })

  await connectDB()
  const [session, settings] = await Promise.all([
    ParkingSession.findOne({ cardUid: uid.trim(), status: 'active' }).lean(),
    getSettings(),
  ])
  if (!session) return NextResponse.json({ error: 'ไม่พบยานพาหนะในลาน' }, { status: 404 })

  const now = new Date()
  const durationMin = calcDurationMinutes(session.entryTime, now)
  const fee = calcFeeFromMinutes(session.cardType, durationMin, session.entryTime, now, settings.rates.overnight)

  return NextResponse.json({ ...session, durationMin, fee, totalFee: fee })
}

async function handlePost(req: NextRequest) {
  const { uid, sessionId, queueId, paymentMethod = 'cash', discountId, dailyDiscountId, fineId, exitTime: exitTimeRaw, lostCard } = await req.json()

  const jar     = await cookies()
  const token   = jar.get(COOKIE_NAME)?.value
  const payload = token ? verifyToken(token) : null

  await connectDB()

  const queue = queueId ? await ParkingQueue.findOne({ _id: queueId, status: 'waiting' }) : null
  if (queueId && !queue) return NextResponse.json({ error: 'คิวนี้ไม่ได้รออยู่แล้ว กรุณารีเฟรชรายการ' }, { status: 409 })
  if (queue && await ParkingSession.exists({ _id: queue._id })) {
    return NextResponse.json({ error: 'คิวนี้บันทึกรับเงินแล้ว กรุณาให้ผู้ดูแลตรวจสอบสถานะคิว' }, { status: 409 })
  }
  const session = queue ? new ParkingSession({
    _id: queue._id, cardUid: queue.cardUid ?? `WALKIN-Q-${queue._id}`, cardType: queue.cardType,
    plate: queue.plate, entryTime: queue.joinedAt,
  }) : sessionId
    ? await ParkingSession.findOne({ _id: sessionId, status: 'active' as const })
    : await ParkingSession.findOne({ cardUid: uid?.trim(), status: 'active' as const })

  if (!session) return NextResponse.json({ error: 'ไม่พบยานพาหนะในลาน' }, { status: 404 })

  const settings = await getSettings()
  const now = exitTimeRaw ? new Date(exitTimeRaw) : new Date()
  const durationMin = calcDurationMinutes(session.entryTime, now)
  const fee = calcFeeFromMinutes(session.cardType, durationMin, session.entryTime, now, settings.rates.overnight)

  // คำนวณส่วนลดร้านค้า (fixed / percent)
  const nights = calcFeeBreakdown(session.cardType, session.entryTime, now, settings.rates.overnight)
    .segments.filter(segment => segment.kind === 'overnight').length
  let appliedDiscountId: string | undefined
  let appliedDailyDiscountId: string | undefined
  let discountAmount = 0
  const discountNames: string[] = []
  if (discountId && nights === 0) {
    const discount = await Discount.findById(discountId).lean() as {
      name: string; discountType: string; discountValue: number; maxDiscount?: number
    } | null
    if (discount && ['fixed', 'percent'].includes(discount.discountType)) {
      appliedDiscountId = discountId
      discountNames.push(discount.name)
      if (discount.discountType === 'fixed') {
        discountAmount += Math.min(discount.discountValue, fee)
      } else {
        const pct = Math.floor(fee * discount.discountValue / 100)
        discountAmount += discount.maxDiscount ? Math.min(pct, discount.maxDiscount) : pct
      }
    }
  }

  // คำนวณส่วนลดรายคืน (per_day)
  if (dailyDiscountId && nights > 0) {
    const dailyDiscount = await Discount.findById(dailyDiscountId).lean() as {
      name: string; discountType: string; discountValue: number
    } | null
    if (dailyDiscount && dailyDiscount.discountType === 'per_day') {
      if (nights > 0) {
        appliedDailyDiscountId = dailyDiscountId
        discountNames.push(`${dailyDiscount.name} (${nights} คืน)`)
        discountAmount += dailyDiscount.discountValue * nights
      }
    }
  }

  const discountName = discountNames.join(' + ') || undefined

  // ค่าปรับที่ operator เลือกจาก dropdown ตอน checkout
  let fineName: string | undefined
  let fineAmount = 0
  if (fineId) {
    const fine = await Fine.findById(fineId).lean() as { name: string; amount: number } | null
    if (fine) {
      fineName = fine.name
      fineAmount = fine.amount
    }
  }

  const lostFine = lostCard ? settings.lostCardFine : 0
  const totalFee = Math.max(0, fee - discountAmount) + fineAmount + lostFine

  session.exitTime       = now
  session.durationMin    = durationMin
  session.fee            = fee
  session.lostFine       = lostFine
  session.lostCard       = Boolean(lostCard)
  session.totalFee       = totalFee
  session.discountId     = appliedDiscountId ?? appliedDailyDiscountId
  session.discountName   = discountName
  session.discountAmount = discountAmount
  session.fineId         = fineId ?? undefined
  session.fineName       = fineName
  session.fineAmount     = fineAmount
  session.status         = 'completed'
  session.paymentMethod  = paymentMethod as 'cash' | 'qr'
  if (payload) session.operatorId = payload.sub

  // Link to active shift
  if (payload) {
    const shift = await Shift.findOne({ operatorId: payload.sub, status: 'active' })
    if (shift) {
      session.shiftId = String(shift._id)
      shift.checkoutsCount += 1
      if (shift.checkoutsByType) shift.checkoutsByType[session.cardType === 'motorcycle' ? 'motorcycle' : 'car'] += 1
      if (paymentMethod === 'qr') {
        shift.qrAmount += totalFee
      } else {
        shift.cashAmount += totalFee
      }
      shift.totalAmount += totalFee
      await shift.save()
    }
  }

  await session.save()
  if (queue) {
    queue.status = 'cancelled'
    queue.cancelledAt = now
    await queue.save()
  }

  void runCheckoutSequence(settings.hardware, {
    sessionId: String(session._id),
    cardUid:   session.cardUid,
    plate:     session.plate,
  })

  return NextResponse.json(session)
}

export const POST = parkingMutation(handlePost)
