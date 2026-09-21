import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { Shift } from '@/models/Shift'
import { getSettings } from '@/models/SystemSettings'
import { printRaw } from '@/lib/hardware'
import { buildShiftEndSlip, buildShiftStartSlip } from '@/lib/escpos'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  const user = token ? verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
  const { id } = await params
  if (!/^[a-f\d]{24}$/i.test(id)) return NextResponse.json({ error: 'เลขกะไม่ถูกต้อง' }, { status: 400 })
  await connectDB()
  const opening = new URL(_req.url).searchParams.get('kind') === 'open'
  const shift = await Shift.findOne({ _id: id, operatorId: user.sub }).lean()
  if (!shift || (!opening && (shift.status !== 'closed' || !shift.endTime))) return NextResponse.json({ error: 'ไม่พบข้อมูลกะที่ต้องการ' }, { status: 404 })
  const cfg = await getSettings()
  const result = await printRaw(cfg.hardware, opening ? buildShiftStartSlip(shift) : buildShiftEndSlip({ ...shift, endTime: shift.endTime! }))
  return NextResponse.json({ success: result.success })
}
