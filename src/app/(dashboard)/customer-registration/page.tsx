'use client'

import { useEffect, useState } from 'react'
import { Copy, Link as LinkIcon, RefreshCw } from 'lucide-react'

export default function CustomerRegistrationPage() {
  const [registrations, setRegistrations] = useState<{ _id: string; refCode: string; fullName: string; phone: string; verifiedAt?: string; createdAt: string }[]>([])
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedImage, setSelectedImage] = useState<{ url: string; label: string } | null>(null)

  async function loadRegistrations() {
    const response = await fetch('/api/customer-registration?kind=lost', { cache: 'no-store' })
    if (response.ok) setRegistrations((await response.json()).registrations ?? [])
  }

  useEffect(() => { void loadRegistrations() }, [])

  async function createLink() {
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/customer-registration/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'lost' }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'สร้างลิงก์ไม่สำเร็จ')
      setUrl(data.url)
      await navigator.clipboard?.writeText(data.url)
      setMessage('สร้างลิงก์และคัดลอกแล้ว')
      void loadRegistrations()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'สร้างลิงก์ไม่สำเร็จ')
    } finally { setBusy(false) }
  }

  async function copyLink() {
    if (!url) return
    await navigator.clipboard?.writeText(url)
    setMessage('คัดลอกลิงก์สำเร็จ')
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-600">Customer registration</p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">ข้อมูลบัตรหาย</h1>
          <p className="mt-2 text-sm text-slate-500">สร้างลิงก์ให้ลูกค้ากรอกข้อมูล และใช้เลข Ref ยืนยันตอนลูกค้าทำบัตรหาย</p>
        </div>
        <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><LinkIcon className="size-5" /></div>
            <div className="min-w-0 flex-1">
              <h2 className="font-black text-slate-900">ลิงก์แบบฟอร์มกลาง</h2>
              <p className="mt-1 text-xs text-slate-500">ส่งลิงก์นี้ให้ลูกค้าผ่าน LINE เพื่อกรอกชื่อ เบอร์โทรศัพท์ และรูปเอกสาร</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={createLink} disabled={busy} className="flex h-10 items-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-black text-white disabled:opacity-50"><RefreshCw className={`size-4 ${busy ? 'animate-spin' : ''}`} /> สร้างลิงก์ใหม่</button>
                <button type="button" onClick={copyLink} disabled={!url} className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700 disabled:opacity-40"><Copy className="size-4" /> คัดลอกลิงก์</button>
              </div>
              {url && <p className="mt-3 break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700">{url}</p>}
              {message && <p className="mt-2 text-xs font-semibold text-emerald-600">{message}</p>}
            </div>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-black text-slate-900">ขั้นตอนใช้งาน</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
            <li>กด “สร้างลิงก์ใหม่” แล้วส่งลิงก์ให้ลูกค้าผ่าน LINE</li>
            <li>ลูกค้ากรอกข้อมูลผ่านแบบฟอร์มกลาง และได้รับเลข Ref</li>
            <li>ลูกค้าจะส่งเลข Ref ผ่าน LINE หรือไม่ก็ได้ การส่งใช้สำหรับตรวจสอบว่าข้อมูลเข้าระบบแล้ว</li>
            <li>เมื่อลูกค้าทำบัตรหาย ให้เลือกเลขทะเบียนรถ ติ๊กบัตรหาย และกรอกเลข Ref ใน Popup</li>
          </ol>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="font-black text-slate-900">ข้อมูลที่ลูกค้าส่งมา</h2><p className="mt-1 text-xs text-slate-500">แสดงเฉพาะข้อมูลสำหรับผู้ดูแลระบบ ไม่แสดงรูปเอกสาร</p></div>
            <button type="button" onClick={() => void loadRegistrations()} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">รีเฟรช</button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead><tr className="border-b text-xs text-slate-400"><th className="px-2 py-2">เลข Ref</th><th className="px-2 py-2">ชื่อ–นามสกุล</th><th className="px-2 py-2">เบอร์โทรศัพท์</th><th className="px-2 py-2">บัตรประชาชน</th><th className="px-2 py-2">ทะเบียนรถ</th><th className="px-2 py-2">สถานะ LINE</th><th className="px-2 py-2">วันที่ส่ง</th></tr></thead>
              <tbody>{registrations.map(row => <tr key={row._id} className="border-b last:border-0"><td className="px-2 py-3 font-mono font-bold text-amber-700">{row.refCode}</td><td className="px-2 py-3 font-semibold text-slate-800">{row.fullName}</td><td className="px-2 py-3 text-slate-600">{row.phone}</td><td className="px-2 py-3"><button type="button" onClick={() => setSelectedImage({ url: `/api/customer-registration/${row.refCode}/photo?type=id-card`, label: `บัตรประชาชน — ${row.refCode}` })} className="rounded focus-visible:outline-2 focus-visible:outline-amber-500"><img src={`/api/customer-registration/${row.refCode}/photo?type=id-card`} alt="บัตรประชาชน" className="h-14 w-20 rounded border object-cover" /></button></td><td className="px-2 py-3"><button type="button" onClick={() => setSelectedImage({ url: `/api/customer-registration/${row.refCode}/photo?type=vehicle`, label: `สำเนาทะเบียนรถ — ${row.refCode}` })} className="rounded focus-visible:outline-2 focus-visible:outline-amber-500"><img src={`/api/customer-registration/${row.refCode}/photo?type=vehicle`} alt="สำเนาทะเบียนรถ" className="h-14 w-20 rounded border object-cover" /></button></td><td className="px-2 py-3">{row.verifiedAt ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">ยืนยันแล้ว</span> : <span className="text-xs text-slate-400">รอยืนยัน</span>}</td><td className="px-2 py-3 text-xs text-slate-500">{new Date(row.createdAt).toLocaleString('th-TH')}</td></tr>)}</tbody>
            </table>
            {registrations.length === 0 && <p className="py-8 text-center text-sm text-slate-400">ยังไม่มีข้อมูลที่ลูกค้าส่งมา</p>}
          </div>
        </section>
        {selectedImage && <div role="dialog" aria-modal="true" aria-label={selectedImage.label} onClick={() => setSelectedImage(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="relative max-h-[92vh] max-w-5xl rounded-xl bg-white p-3 shadow-2xl" onClick={event => event.stopPropagation()}>
            <button type="button" onClick={() => setSelectedImage(null)} className="absolute right-2 top-2 z-10 rounded-full bg-slate-900/75 px-3 py-1 text-lg font-bold text-white">×</button>
            <p className="mb-2 pr-10 text-sm font-bold text-slate-700">{selectedImage.label}</p>
            <img src={selectedImage.url} alt={selectedImage.label} className="max-h-[78vh] max-w-[min(88vw,70rem)] rounded-lg object-contain" />
          </div>
        </div>}
      </div>
    </main>
  )
}
