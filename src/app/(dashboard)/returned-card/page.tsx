'use client'

import { useEffect, useState } from 'react'
import { Copy, Link as LinkIcon, RefreshCw } from 'lucide-react'

interface Registration { _id: string; refCode: string; fullName: string; phone: string; verifiedAt?: string; createdAt: string }

export default function ReturnedCardPage() {
  const [rows, setRows] = useState<Registration[]>([])
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function load() {
    const response = await fetch('/api/customer-registration?kind=return', { cache: 'no-store' })
    if (response.ok) setRows((await response.json()).registrations ?? [])
  }
  useEffect(() => { void load() }, [])

  async function createLink() {
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/customer-registration/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'return' }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'สร้างลิงก์ไม่สำเร็จ')
      setUrl(data.url); await navigator.clipboard?.writeText(data.url); setMessage('สร้างและคัดลอกลิงก์แล้ว')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'สร้างลิงก์ไม่สำเร็จ') }
    finally { setBusy(false) }
  }

  return <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-8"><div className="mx-auto max-w-5xl space-y-5">
    <div><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-600">Returned card</p><h1 className="mt-1 text-3xl font-black text-slate-900">คืนบัตร</h1><p className="mt-2 text-sm text-slate-500">ลิงก์ ข้อมูล และเลข Ref แยกจากเมนูบัตรหาย</p></div>
    <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center gap-3"><LinkIcon className="size-5 text-amber-600" /><div className="flex-1"><h2 className="font-black text-slate-900">ลิงก์แบบฟอร์มคืนบัตร</h2>{url && <p className="mt-2 break-all rounded bg-slate-50 px-2 py-1 font-mono text-sm">{url}</p>}</div><button type="button" onClick={createLink} disabled={busy} className="flex h-10 items-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-black text-white disabled:opacity-50"><RefreshCw className={`size-4 ${busy ? 'animate-spin' : ''}`} />สร้างลิงก์ใหม่</button>{url && <button type="button" onClick={() => void navigator.clipboard?.writeText(url)} className="flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-bold"><Copy className="size-4" />คัดลอก</button>}</div>{message && <p className="mt-2 text-xs font-semibold text-emerald-600">{message}</p>}</section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex justify-between"><div><h2 className="font-black">ข้อมูลการคืนบัตร</h2><p className="mt-1 text-xs text-slate-500">ข้อมูลจากเมนูคืนบัตรเท่านั้น</p></div><button type="button" onClick={() => void load()} className="rounded-lg border px-3 py-2 text-xs font-bold">รีเฟรช</button></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-400"><th className="px-2 py-2">Ref</th><th className="px-2 py-2">ชื่อ–นามสกุล</th><th className="px-2 py-2">เบอร์โทรศัพท์</th><th className="px-2 py-2">สถานะ LINE</th><th className="px-2 py-2">วันที่ส่ง</th></tr></thead><tbody>{rows.map(row => <tr key={row._id} className="border-b last:border-0"><td className="px-2 py-3 font-mono font-bold text-amber-700">{row.refCode}</td><td className="px-2 py-3 font-semibold">{row.fullName}</td><td className="px-2 py-3 text-slate-600">{row.phone}</td><td className="px-2 py-3 text-xs">{row.verifiedAt ? 'ยืนยันแล้ว' : 'รอยืนยัน'}</td><td className="px-2 py-3 text-xs text-slate-500">{new Date(row.createdAt).toLocaleString('th-TH')}</td></tr>)}</tbody></table>{rows.length === 0 && <p className="py-8 text-center text-sm text-slate-400">ยังไม่มีข้อมูล</p>}</div></section>
  </div></main>
}
