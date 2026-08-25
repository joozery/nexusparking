import { NextRequest, NextResponse } from 'next/server'
import { sendLineMessage } from '@/lib/lineNotify'

export async function POST(req: NextRequest) {
  const { channelToken, targets } = await req.json()
  if (!channelToken || !Array.isArray(targets) || targets.length === 0) {
    return NextResponse.json({ error: 'missing channelToken or targets' }, { status: 400 })
  }

  try {
    await sendLineMessage(channelToken, targets, '✅ ทดสอบการแจ้งเตือน LINE จากระบบลานจอดรถ\nการตั้งค่าถูกต้องแล้ว')
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'send failed' }, { status: 500 })
  }
}
