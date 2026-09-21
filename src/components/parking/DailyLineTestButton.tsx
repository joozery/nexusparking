'use client'
import { useRef, useState } from 'react'
import { useToast } from '@/components/ui/Toast'

export function DailyLineTestButton() {
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const { success, error: toastError } = useToast()
  async function send() {
    if (sending.current) return
    sending.current = true; setBusy(true)
    try {
      const res = await fetch('/api/line/daily-report?period=today', { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'ส่งทดสอบไม่สำเร็จ กรุณาตรวจ LINE ก่อนลองซ้ำ')
      success('ส่งรายงานทดสอบแล้ว', 'ส่งยอดวันนี้ตั้งแต่เที่ยงคืนถึงเวลาที่กดไปยัง LINE แล้ว')
    } catch (error) {
      toastError('ส่งรายงานไม่สำเร็จ', error instanceof Error ? error.message : 'กรุณาลองใหม่')
    } finally { sending.current = false; setBusy(false) }
  }
  return <button type="button" disabled={busy} onClick={send}
    title="ส่งรายงานวันนี้ตั้งแต่เที่ยงคืนถึงเวลาที่กดเข้า LINE พร้อมระบุว่าเป็นข้อความทดสอบ"
    className="shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 disabled:opacity-40">
    {busy ? 'กำลังส่งรายงานเข้า LINE...' : 'ทดสอบรายงานประจำวัน → LINE'}
  </button>
}
