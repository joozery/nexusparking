import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { ParkingSession } from '@/models/ParkingSession'
import { Shift } from '@/models/Shift'
import { Discount } from '@/models/Discount'
import { getSettings } from '@/models/SystemSettings'
import { calcFeeFromMinutes, calcDurationMinutes } from '@/lib/calcFee'
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

export async function POST(req: NextRequest) {
  const { uid, sessionId, paymentMethod = 'cash', discountId } = await req.json()

  const jar     = await cookies()
  const token   = jar.get(COOKIE_NAME)?.value
  const payload = token ? verifyToken(token) : null

  await connectDB()

  const session = sessionId
    ? await ParkingSession.findOne({ _id: sessionId, status: 'active' as const })
    : await ParkingSession.findOne({ cardUid: uid?.trim(), status: 'active' as const })

  if (!session) return NextResponse.json({ error: 'ไม่พบยานพาหนะในลาน' }, { status: 404 })

  const settings = await getSettings()
  const now = new Date()
  const durationMin = calcDurationMinutes(session.entryTime, now)
  const fee = calcFeeFromMinutes(session.cardType, durationMin, session.entryTime, now, settings.rates.overnight)

  // คำนวณส่วนลด
  let discountAmount = 0
  let discountName: string | undefined
  if (discountId) {
    const discount = await Discount.findById(discountId).lean() as {
      name: string; discountType: string; discountValue: number; maxDiscount?: number
    } | null
    if (discount) {
      discountName = discount.name
      if (discount.discountType === 'fixed') {
        discountAmount = Math.min(discount.discountValue, fee)
      } else {
        const pct = Math.floor(fee * discount.discountValue / 100)
        discountAmount = discount.maxDiscount ? Math.min(pct, discount.maxDiscount) : pct
      }
    }
  }

  const totalFee = Math.max(0, fee - discountAmount)

  session.exitTime       = now
  session.durationMin    = durationMin
  session.fee            = fee
  session.lostFine       = 0
  session.totalFee       = totalFee
  session.discountId     = discountId ?? undefined
  session.discountName   = discountName
  session.discountAmount = discountAmount
  session.status         = 'completed'
  session.paymentMethod  = paymentMethod as 'cash' | 'qr'
  if (payload) session.operatorId = payload.sub

  // Link to active shift
  if (payload) {
    const shift = await Shift.findOne({ operatorId: payload.sub, status: 'active' })
    if (shift) {
      session.shiftId = String(shift._id)
      shift.checkoutsCount += 1
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

  void runCheckoutSequence(settings.hardware, {
    cardUid: session.cardUid,
    plate:   session.plate,
    receipt: {
      plate:     session.plate,
      cardType:  session.cardType,
      entryTime: session.entryTime.toISOString(),
      exitTime:  now.toISOString(),
      duration:  `${Math.ceil(durationMin / 60)}h`,
      fee,
      total: fee,
    },
  })

  return NextResponse.json(session)
}
