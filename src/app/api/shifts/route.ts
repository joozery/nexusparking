import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Shift } from '@/models/Shift'
import { ParkingSession } from '@/models/ParkingSession'
import { Admin } from '@/models/Admin'

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
    const parseFilterDate = (value: string, endOfDay = false) => {
      if (value.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(value)) return new Date(value)
      if (value.includes('T')) return new Date(`${value}:00+07:00`)
      return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+07:00`)
    }
    if (dateFrom) {
      // date-only (YYYY-MM-DD) → ใช้ local midnight, full ISO → ใช้ตรงๆ
      const from = parseFilterDate(dateFrom)
      ;(filter.startTime as Record<string, unknown>).$gte = from
    }
    if (dateTo) {
      const to = parseFilterDate(dateTo, true)
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
      $or: [
        { operatorId: shift.operatorId },
        { operatorId: { $exists: false } },
        { operatorId: null },
        { operatorId: '' },
      ],
    }).select('paymentMethod totalFee').lean()

    // Checkouts made outside the booth operator's shift (for example by
    // systemadmin from /gate) have no shiftId. Include them in the vehicle
    // count/detail for this time window, but never add their money to this
    // shift's cash or QR totals.
    const externalSessions = await ParkingSession.find({
          operatorId: { $ne: shift.operatorId },
          shiftId: { $in: [null, '', String(shift._id)] },
          status: { $in: ['completed', 'lost'] },
          exitTime: { $gte: startTime, $lte: endTime },
        }).select('_id plate totalFee paymentMethod operatorId exitTime').lean()
    const externalCheckouts = externalSessions.length
    const externalSessionIds = externalSessions.map(session => String(session._id))
    const externalOperatorIds = [...new Set(externalSessions.map(session => session.operatorId).filter(Boolean))]
    const externalAdmins = externalOperatorIds.length
      ? await Admin.find({ _id: { $in: externalOperatorIds } }).select('_id name').lean()
      : []
    const externalNames = new Map(externalAdmins.map(admin => [String(admin._id), admin.name]))

    // Imported/simulated rows may not have a shiftId. Use checkout time as a
    // fallback so the shift summary still matches the transaction list.
    const sessions = linkedSessions.length > 0
      ? linkedSessions
      : await ParkingSession.find({
          status: { $in: ['completed', 'lost'] },
          exitTime: { $gte: startTime, $lte: endTime },
          // Keep the fallback useful for old/imported rows, but do not pull
          // another user's gate checkout (e.g. systemadmin) into this shift's
          // cash/QR totals.
          $or: [
            { operatorId: shift.operatorId },
            { operatorId: { $exists: false } },
            { operatorId: null },
            { operatorId: '' },
          ],
        }).select('paymentMethod totalFee').lean()

    if (sessions.length === 0) {
      return externalCheckouts > 0
        ? {
            ...shift,
            // Keep the checkout count owned by this operator's shift.
            // External checkouts are shown in their own operator card and
            // added only to the report-wide total on the client.
            checkoutsCount: shift.checkoutsCount,
            systemAdminSessionIds: externalSessionIds,
            externalSessions: externalSessions.map(session => ({
              ...session,
              _id: String(session._id),
              operatorName: session.operatorId === 'env-admin'
                ? (process.env.ADMIN_NAME ?? 'System Admin')
                : (externalNames.get(session.operatorId ?? '') ?? 'System Admin'),
            })),
          }
        : shift
    }
    const refundCash = (shift.cardRefunds ?? [])
      .filter(refund => refund.paymentMethod === 'cash')
      .reduce((sum, refund) => sum + refund.amount, 0)
    const refundQr = (shift.cardRefunds ?? [])
      .filter(refund => refund.paymentMethod === 'qr')
      .reduce((sum, refund) => sum + refund.amount, 0)
    const cashAmount = Math.max(0, sessions.filter(session => session.paymentMethod === 'cash').reduce((sum, session) => sum + session.totalFee, 0) - refundCash)
    const qrAmount = Math.max(0, sessions.filter(session => session.paymentMethod === 'qr').reduce((sum, session) => sum + session.totalFee, 0) - refundQr)
    return {
      ...shift,
      // Do not attribute another operator's checkout to this shift.
      checkoutsCount: shift.checkoutsCount,
      systemAdminSessionIds: externalSessionIds,
      externalSessions: externalSessions.map(session => ({
        ...session,
        _id: String(session._id),
        operatorName: session.operatorId === 'env-admin'
          ? (process.env.ADMIN_NAME ?? 'System Admin')
          : (externalNames.get(session.operatorId ?? '') ?? 'System Admin'),
      })),
      cashAmount,
      qrAmount,
      totalAmount: cashAmount + qrAmount,
    }
  }))

  return NextResponse.json({ shifts, total, page, limit })
}
