import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE_NAME, verifyToken } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { sessionFilters } from '@/lib/sessionFilters'
import { ParkingSession } from '@/models/ParkingSession'

export async function GET(req: NextRequest) {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  const user = token ? verifyToken(token) : null
  if (!user || !['admin', 'superadmin'].includes(user.role)) return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ' }, { status: 403 })
  let filter
  try { filter = sessionFilters(req.nextUrl.searchParams) }
  catch { return NextResponse.json({ error: 'ช่วงวันที่ไม่ถูกต้อง' }, { status: 400 }) }
  await connectDB()
  // One ordered query: no screen pagination or separate count that could drift.
  const sessions = await ParkingSession.find(filter)
    .select('cardUid cardType plate entryTime exitTime durationMin fee lostFine lostCard fineName fineAmount totalFee status paymentMethod discountName discountAmount note entryPhotoPath exitPhotoPath')
    .sort({ entryTime: -1, _id: -1 }).lean()
  return NextResponse.json({ sessions, total: sessions.length }, { headers: { 'Cache-Control': 'no-store' } })
}
