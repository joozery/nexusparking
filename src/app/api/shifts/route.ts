import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Shift } from '@/models/Shift'
import { ParkingSession } from '@/models/ParkingSession'

export async function GET(req: NextRequest) {
  await connectDB()
  const { searchParams } = new URL(req.url)
  const limit      = parseInt(searchParams.get('limit')  ?? '50')
  const page       = parseInt(searchParams.get('page')   ?? '1')
  const operatorId = searchParams.get('operatorId')
  const dateFrom   = searchParams.get('dateFrom')
  const dateTo     = searchParams.get('dateTo')
  const status     = searchParams.get('status')

  const filter: Record<string, unknown> = {}
  if (operatorId) filter.operatorId = operatorId
  if (status)     filter.status     = status
  if (dateFrom || dateTo) {
    filter.startTime = {}
    if (dateFrom) {
      // date-only (YYYY-MM-DD) → ใช้ local midnight, full ISO → ใช้ตรงๆ
      const from = dateFrom.includes('T') ? new Date(dateFrom) : new Date(dateFrom + 'T00:00:00')
      ;(filter.startTime as Record<string, unknown>).$gte = from
    }
    if (dateTo) {
      const to = dateTo.includes('T') ? new Date(dateTo) : new Date(dateTo + 'T23:59:59')
      ;(filter.startTime as Record<string, unknown>).$lte = to
    }
  }

  const [rawShifts, total] = await Promise.all([
    Shift.find(filter).sort({ startTime: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Shift.countDocuments(filter),
  ])

  const shifts = await Promise.all(rawShifts.map(async shift => {
    const startTime = new Date(shift.startTime)
    const endTime = shift.endTime ? new Date(shift.endTime) : new Date()
    const linkedSessions = await ParkingSession.find({
      shiftId: String(shift._id),
      status: { $in: ['completed', 'lost'] },
    }).select('paymentMethod totalFee').lean()

    // Imported/simulated rows may not have a shiftId. Use checkout time as a
    // fallback so the shift summary still matches the transaction list.
    const sessions = linkedSessions.length > 0
      ? linkedSessions
      : await ParkingSession.find({
          status: { $in: ['completed', 'lost'] },
          exitTime: { $gte: startTime, $lte: endTime },
        }).select('paymentMethod totalFee').lean()

    if (sessions.length === 0) return shift
    const refundCash = (shift.cardRefunds ?? [])
      .filter(refund => refund.paymentMethod === 'cash')
      .reduce((sum, refund) => sum + refund.amount, 0)
    const refundQr = (shift.cardRefunds ?? [])
      .filter(refund => refund.paymentMethod === 'qr')
      .reduce((sum, refund) => sum + refund.amount, 0)
    const cashAmount = Math.max(0, sessions.filter(session => session.paymentMethod === 'cash').reduce((sum, session) => sum + session.totalFee, 0) - refundCash)
    const qrAmount = Math.max(0, sessions.filter(session => session.paymentMethod === 'qr').reduce((sum, session) => sum + session.totalFee, 0) - refundQr)
    return { ...shift, cashAmount, qrAmount, totalAmount: cashAmount + qrAmount }
  }))

  return NextResponse.json({ shifts, total, page, limit })
}
