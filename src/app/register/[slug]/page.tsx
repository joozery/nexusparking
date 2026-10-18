'use client'

import { FormEvent, useEffect, useState } from 'react'

export default function CustomerRegistrationPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [idCard, setIdCard] = useState<File | null>(null)
  const [vehicle, setVehicle] = useState<File | null>(null)
  const [refCode, setRefCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { void params.then(value => setSlug(value.slug)) }, [params])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!idCard || !vehicle) return setError('กรุณาแนบรูปบัตรประชาชนและสำเนาทะเบียนรถ')
    setBusy(true)
    try {
      const form = new FormData()
      form.set('slug', slug); form.set('fullName', name); form.set('phone', phone)
      form.set('idCardPhoto', idCard); form.set('vehicleRegistrationPhoto', vehicle)
      const res = await fetch('/api/customer-registration', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'บันทึกข้อมูลไม่สำเร็จ')
      setRefCode(data.refCode)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกข้อมูลไม่สำเร็จ')
    } finally { setBusy(false) }
  }

  if (refCode) return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <section className="mx-auto max-w-md rounded-2xl bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-emerald-600">ลงทะเบียนสำเร็จ</p>
        <h1 className="mt-2 text-2xl font-black text-slate-900">เลข Ref ของคุณ</h1>
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 font-mono text-3xl font-black tracking-wider text-amber-700">{refCode}</p>
        <p className="mt-4 text-sm text-slate-600">กรุณาเก็บเลขนี้ไว้ สามารถส่งเลข Ref ผ่าน LINE เพื่อตรวจสอบว่าข้อมูลถูกส่งเข้าระบบแล้ว</p>
      </section>
    </main>
  )

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <form onSubmit={submit} className="mx-auto max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-sm">
        <div><h1 className="text-2xl font-black text-slate-900">ลงทะเบียนข้อมูลลูกค้า</h1><p className="mt-1 text-sm text-slate-500">กรุณากรอกข้อมูลให้ครบถ้วน</p></div>
        <label className="block text-sm font-bold text-slate-700">ชื่อ–นามสกุล<input required value={name} onChange={e => setName(e.target.value)} className="mt-1 h-11 w-full rounded-lg border px-3 font-normal outline-none" /></label>
        <label className="block text-sm font-bold text-slate-700">เบอร์โทรศัพท์<input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 h-11 w-full rounded-lg border px-3 font-normal outline-none" /></label>
        <label className="block text-sm font-bold text-slate-700">รูปบัตรประชาชน<input required type="file" accept="image/*" onChange={e => setIdCard(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm font-normal" /></label>
        <label className="block text-sm font-bold text-slate-700">รูปสำเนาทะเบียนรถ<input required type="file" accept="image/*" onChange={e => setVehicle(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm font-normal" /></label>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button disabled={busy || !slug} className="h-11 w-full rounded-lg bg-amber-500 font-black text-white disabled:opacity-50">{busy ? 'กำลังบันทึก...' : 'ส่งข้อมูล'}</button>
      </form>
    </main>
  )
}
