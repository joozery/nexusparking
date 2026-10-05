import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE_NAME, verifyToken } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { ParkingSession } from '@/models/ParkingSession'
import { Shift } from '@/models/Shift'

export async function GET(req: NextRequest) {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  const user = token ? verifyToken(token) : null
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ' }, { status: 403 })
  }

  await connectDB()
  const from = req.nextUrl.searchParams.get('dateFrom')
  const to = req.nextUrl.searchParams.get('dateTo')
  const refundedAt: Record<string, Date> = {}
  if (from) refundedAt.$gte = new Date(`${from}T00:00:00`)
  if (to) refundedAt.$lte = new Date(`${to}T23:59:59.999`)

  const shifts = await Shift.find({
    'cardRefunds.0': { $exists: true },
    ...(Object.keys(refundedAt).length ? { cardRefunds: { $elemMatch: { refundedAt } } } : {}),
  }).select('operatorName cardRefunds').lean()

  const refunds = shifts.flatMap(shift => (shift.cardRefunds ?? [])
    .filter(refund => !Object.keys(refundedAt).length || (
      new Date(refund.refundedAt) >= (refundedAt.$gte ?? new Date(0)) &&
      new Date(refund.refundedAt) <= (refundedAt.$lte ?? new Date(8640000000000000))
    ))
    .map(refund => ({
      id: `${refund.sessionId}-${new Date(refund.refundedAt).getTime()}`,
      sessionId: refund.sessionId,
      cardUid: refund.cardUid,
      plate: refund.plate,
      amount: refund.amount,
      paymentMethod: refund.paymentMethod,
      refundedAt: refund.refundedAt,
      operatorId: refund.operatorId,
      operatorName: shift.operatorName,
    })))

  const sessionIds = [...new Set(refunds.map(refund => refund.sessionId))]
  const sessions = await ParkingSession.find({ _id: { $in: sessionIds } })
    .select('entryTime exitTime cardType lostFine')
    .lean()
  const sessionById = new Map(sessions.map(session => [String(session._id), session]))

  const result = refunds
    .map(refund => {
      const session = sessionById.get(refund.sessionId)
      return {
        ...refund,
        cardType: session?.cardType ?? 'car',
        originalEntryTime: session?.entryTime,
        originalExitTime: session?.exitTime,
        lostFine: session?.lostFine ?? 0,
      }
    })
    .sort((a, b) => new Date(b.refundedAt).getTime() - new Date(a.refundedAt).getTime())

  return NextResponse.json({ refunds: result }, { headers: { 'Cache-Control': 'no-store' } })
}
