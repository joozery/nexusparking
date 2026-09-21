'use client'
import { useState } from 'react'

export function DailyLineReportPreview() {
  const [yesterday] = useState(() => new Date(Date.now() + 7 * 3_600_000 - 86_400_000).toISOString().slice(0, 10))
  const [date, setDate] = useState(yesterday)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function run(send: boolean) {
    if (busy) return
    setBusy(true); setMessage('')
    try {
      const res = await fetch(`/api/line/daily-report?date=${date}`, { method: send ? 'POST' : 'GET', cache: 'no-store' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data) throw new Error(data?.error || 'โหลดรายงานไม่สำเร็จ')
      if (send) setMessage(`LINE ตอบรับข้อความทดสอบแล้ว ${data.accepted} ข้อความ`)
      else setPreview(data.text)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'ดำเนินการไม่สำเร็จ') }
    finally { setBusy(false) }
  }
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
    <h2 className="font-bold">รายงานประจำวันตอนเที่ยงคืน</h2>
    <p className="text-sm text-slate-500">สรุปวันก่อนหน้าตามเวลาไทย ระบบต้องเปิดทำงานเพื่อส่งตรงเวลา หากหยุดทำงานจะส่งย้อนหลังเมื่อเปิดระบบอีกครั้ง</p>
    <label className="block text-sm">วันที่รายงาน <input aria-label="วันที่รายงาน" type="date" max={yesterday} value={date} disabled={busy} onChange={e => { setDate(e.target.value); setPreview(''); setMessage('') }} className="ml-2 rounded-lg border p-2" /></label>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || !date} onClick={() => run(false)} className="rounded-lg border px-4 py-2 disabled:opacity-40">{busy ? 'กำลังดำเนินการ...' : 'ดูตัวอย่างรายงาน'}</button>
      <button type="button" disabled={busy || !preview} onClick={() => run(true)} className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-40">ส่งรายงานทดสอบเข้า LINE</button>
    </div>
    <p className="text-xs text-slate-500">ใช้ข้อมูลจริงของวันที่เลือกและผู้รับ LINE ที่บันทึกไว้ ข้อความทดสอบมีคำว่า “ทดสอบ” และไม่เปลี่ยนสถานะรายงานอัตโนมัติ</p>
    {message && <p role="status" className="text-sm">{message}</p>}
    {preview && <pre className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-sm font-sans">{preview}</pre>}
  </section>
}
