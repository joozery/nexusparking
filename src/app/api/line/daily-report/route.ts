import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomUUID } from 'node:crypto'
import { COOKIE_NAME, verifyToken } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { buildDailyReport } from '@/lib/dailyReport'
import { splitLineReport, thaiDayStart } from '@/lib/dailyReportFormat'
import { getSettings } from '@/models/SystemSettings'

async function handle(req: NextRequest, send: boolean) {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  const user = token ? verifyToken(token) : null
  if (!user || !['admin', 'superadmin', 'operator'].includes(user.role)) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 403 })
  const yesterday = new Date(thaiDayStart(new Date()).getTime() - 86_400_000 + 25_200_000).toISOString().slice(0, 10)
  const now = new Date()
  const todayStart = thaiDayStart(now)
  const today = new Date(todayStart.getTime() + 25_200_000).toISOString().slice(0, 10)
  const partial = req.nextUrl.searchParams.get('period') === 'today'
  const date = partial ? today : req.nextUrl.searchParams.get('date') ?? yesterday
  // Operators can send today's snapshot to saved recipients without reading financial data here.
  if (user.role === 'operator' && (!send || !partial)) return NextResponse.json({ error: 'พนักงานส่งทดสอบรายงานวันนี้ได้เท่านั้น' }, { status: 403 })
  const start = new Date(`${date}T00:00:00+07:00`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(start.getTime()) || new Date(start.getTime() + 25_200_000).toISOString().slice(0, 10) !== date || (!partial && start >= todayStart)) {
    return NextResponse.json({ error: 'กรุณาเลือกวันที่ก่อนวันนี้' }, { status: 400 })
  }
  let accepted = 0
  try {
    await connectDB()
    const text = await buildDailyReport(start, partial ? now : new Date(start.getTime() + 86_400_000), partial)
    if (!send) return NextResponse.json({ text }, { headers: { 'Cache-Control': 'no-store' } })
    const cfg = await getSettings()
    if (!cfg.line.enabled || !cfg.line.channelToken || !cfg.line.targets.length) return NextResponse.json({ error: 'กรุณาบันทึกการตั้งค่าและเปิดใช้ LINE ก่อน' }, { status: 400 })
    const parts = splitLineReport(text).map(part => `🧪 ทดสอบรายงานประจำวัน\n${part}`)
    for (const target of new Set(cfg.line.targets)) {
      for (const part of parts) {
        const response = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST', signal: AbortSignal.timeout(20_000),
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.line.channelToken}`, 'X-Line-Retry-Key': randomUUID() },
          body: JSON.stringify({ to: target, messages: [{ type: 'text', text: part }] }),
        })
        if (!response.ok) throw new Error(`LINE HTTP ${response.status}`)
        accepted++
      }
    }
    return NextResponse.json({ ok: true, accepted })
  } catch {
    return NextResponse.json({ error: send ? `ส่งทดสอบไม่ครบ (LINE ตอบรับแล้ว ${accepted} ข้อความ) กรุณาตรวจ LINE ก่อนลองซ้ำ` : 'สร้างตัวอย่างไม่สำเร็จ กรุณาตรวจการเชื่อมต่อฐานข้อมูล' }, { status: 502 })
  }
}
export const GET = (req: NextRequest) => handle(req, false)
export const POST = (req: NextRequest) => handle(req, true)
