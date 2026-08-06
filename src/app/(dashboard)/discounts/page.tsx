'use client'

import { useState, useEffect, useCallback } from 'react'
import { Tag, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X, Check, Moon, Building2 } from 'lucide-react'

interface Discount {
  _id: string
  name: string
  discountType: 'fixed' | 'percent' | 'per_day'
  discountValue: number
  maxDiscount?: number
  isActive: boolean
  description?: string
}

const emptyForm = {
  name: '', discountType: 'fixed' as 'fixed' | 'percent' | 'per_day',
  discountValue: '', maxDiscount: '', description: '', isActive: true,
}

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Discount | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const fetchDiscounts = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/discounts')
    const data = await res.json()
    setDiscounts(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchDiscounts() }, [fetchDiscounts])

  function openCreate(defaultType?: 'fixed' | 'percent' | 'per_day') {
    setEditing(null)
    setForm({ ...emptyForm, discountType: defaultType ?? 'fixed' })
    setShowForm(true)
  }

  function openEdit(d: Discount) {
    setEditing(d)
    setForm({
      name: d.name,
      discountType: d.discountType,
      discountValue: String(d.discountValue),
      maxDiscount: d.maxDiscount != null ? String(d.maxDiscount) : '',
      description: d.description ?? '',
      isActive: d.isActive,
    })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.name || !form.discountValue) return
    setSaving(true)
    const body = {
      name: form.name,
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined,
      description: form.description || undefined,
      isActive: form.isActive,
    }
    if (editing) {
      await fetch(`/api/discounts/${editing._id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
    } else {
      await fetch('/api/discounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
    }
    setSaving(false)
    setShowForm(false)
    await fetchDiscounts()
  }

  async function toggleActive(d: Discount) {
    await fetch(`/api/discounts/${d._id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !d.isActive }),
    })
    await fetchDiscounts()
  }

  async function handleDelete(id: string) {
    await fetch(`/api/discounts/${id}`, { method: 'DELETE' })
    setDeleteId(null)
    await fetchDiscounts()
  }

  function fmtDiscount(d: Discount) {
    if (d.discountType === 'fixed')   return `ลด ฿${d.discountValue}`
    if (d.discountType === 'per_day') return `ลด ฿${d.discountValue}/คืน`
    return `ลด ${d.discountValue}%${d.maxDiscount ? ` (สูงสุด ฿${d.maxDiscount})` : ''}`
  }

  const storeDiscounts = discounts.filter(d => d.discountType !== 'per_day')
  const hotelDiscounts = discounts.filter(d => d.discountType === 'per_day')

  function DiscountCard({ d }: { d: Discount }) {
    const isHotel = d.discountType === 'per_day'
    const color = isHotel ? '#6D28D9' : '#EA580C'
    const bgColor = isHotel ? 'rgba(109,40,217,0.1)' : 'rgba(234,88,12,0.1)'
    const Icon = isHotel ? Moon : Tag

    return (
      <div
        className="bg-white rounded-2xl px-5 py-4 flex items-center gap-4"
        style={{ border: '1px solid #E8ECF4', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', opacity: d.isActive ? 1 : 0.55 }}>
        <div className="size-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: d.isActive ? bgColor : '#F1F5F9' }}>
          <Icon className="size-4" style={{ color: d.isActive ? color : '#94A3B8' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-black text-slate-900">{d.name}</p>
            {!d.isActive && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: '#F1F5F9', color: '#94A3B8' }}>ปิดใช้งาน</span>
            )}
          </div>
          <p className="text-sm font-bold mt-0.5" style={{ color }}>{fmtDiscount(d)}</p>
          {d.description && <p className="text-xs text-slate-400 mt-0.5">{d.description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => toggleActive(d)}
            className="size-8 rounded-lg flex items-center justify-center transition-colors hover:bg-slate-100"
            title={d.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}>
            {d.isActive
              ? <ToggleRight className="size-5" style={{ color: '#059669' }} />
              : <ToggleLeft className="size-5 text-slate-300" />}
          </button>
          <button onClick={() => openEdit(d)}
            className="size-8 rounded-lg flex items-center justify-center transition-colors hover:bg-slate-100">
            <Pencil className="size-3.5 text-slate-400" />
          </button>
          <button onClick={() => setDeleteId(d._id)}
            className="size-8 rounded-lg flex items-center justify-center transition-colors hover:bg-red-50">
            <Trash2 className="size-3.5 text-red-400" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <header className="shrink-0 h-14 bg-white flex items-center justify-between px-6"
        style={{ borderBottom: '1px solid #E8ECF4' }}>
        <div className="flex items-center gap-3">
          <div className="size-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(234,88,12,0.08)' }}>
            <Tag className="size-3.5" style={{ color: '#EA580C' }} />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900">จัดการส่วนลด</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">ร้านค้าพาร์ทเนอร์ และส่วนลดรายคืนสำหรับโรงแรม</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="size-5 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            {/* ── ส่วนลดร้านค้า / พาร์ทเนอร์ ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(234,88,12,0.08)' }}>
                    <Tag className="size-3.5" style={{ color: '#EA580C' }} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800">ส่วนลดร้านค้า / พาร์ทเนอร์</p>
                    <p className="text-[10px] text-slate-400">ลดตามจำนวนเงิน หรือเปอร์เซ็นต์ — ใช้ได้ทุกรอบการจอด</p>
                  </div>
                </div>
                <button onClick={() => openCreate('fixed')}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg,#EA580C,#F97316)', boxShadow: '0 2px 8px rgba(234,88,12,0.35)' }}>
                  <Plus className="size-3.5" /> เพิ่มส่วนลดร้านค้า
                </button>
              </div>

              {storeDiscounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-28 gap-2 rounded-2xl"
                  style={{ border: '1.5px dashed #E8ECF4' }}>
                  <Tag className="size-8 text-slate-200" />
                  <p className="text-xs text-slate-400">ยังไม่มีส่วนลดร้านค้า</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 max-w-2xl">
                  {storeDiscounts.map(d => <DiscountCard key={d._id} d={d} />)}
                </div>
              )}
            </div>

            {/* ── ส่วนลดรายคืน / โรงแรม ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(109,40,217,0.08)' }}>
                    <Building2 className="size-3.5" style={{ color: '#6D28D9' }} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800">ส่วนลดรายคืน / โรงแรม</p>
                    <p className="text-[10px] text-slate-400">ลดต่อจำนวนคืนที่จอด — สำหรับพาร์ทเนอร์โรงแรมเท่านั้น</p>
                  </div>
                </div>
                <button onClick={() => openCreate('per_day')}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg,#5B21B6,#7C3AED)', boxShadow: '0 2px 8px rgba(109,40,217,0.35)' }}>
                  <Plus className="size-3.5" /> เพิ่มส่วนลดโรงแรม
                </button>
              </div>

              {hotelDiscounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-28 gap-2 rounded-2xl"
                  style={{ border: '1.5px dashed #E8ECF4' }}>
                  <Building2 className="size-8 text-slate-200" />
                  <p className="text-xs text-slate-400">ยังไม่มีส่วนลดรายคืน</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 max-w-2xl">
                  {hotelDiscounts.map(d => <DiscountCard key={d._id} d={d} />)}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-3xl w-full max-w-sm mx-4 overflow-hidden shadow-2xl">

            {(() => {
              const isHotel = form.discountType === 'per_day'
              const gradFrom = isHotel ? '#5B21B6' : '#C2410C'
              const gradTo   = isHotel ? '#7C3AED' : '#EA580C'
              return (
                <div className="px-6 py-5 flex items-center justify-between"
                  style={{ background: `linear-gradient(135deg,${gradFrom},${gradTo})` }}>
                  <p className="text-white font-black">
                    {editing
                      ? (isHotel ? 'แก้ไขส่วนลดโรงแรม' : 'แก้ไขส่วนลดร้านค้า')
                      : (isHotel ? 'เพิ่มส่วนลดโรงแรม' : 'เพิ่มส่วนลดร้านค้า')}
                  </p>
                  <button onClick={() => setShowForm(false)}
                    className="size-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.15)' }}>
                    <X className="size-4 text-white" />
                  </button>
                </div>
              )
            })()}

            <div className="p-5 space-y-4">
              {/* ชื่อ */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  {form.discountType === 'per_day' ? 'ชื่อโรงแรม / พาร์ทเนอร์' : 'ชื่อร้าน / ส่วนลด'}
                </label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={form.discountType === 'per_day' ? 'เช่น The Grand Hotel' : 'เช่น ร้านกาแฟ The Corner'}
                  className="w-full h-10 rounded-xl px-3 text-sm text-slate-800 outline-none"
                  style={{ border: '2px solid #E2E8F0', background: '#FAFBFF' }}
                  onFocus={e => { e.currentTarget.style.borderColor = form.discountType === 'per_day' ? '#7C3AED' : '#EA580C' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0' }} />
              </div>

              {/* ประเภทส่วนลด */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">ประเภทส่วนลด</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'fixed',   label: '฿ จำนวนเงิน', color: '#EA580C', bg: 'rgba(234,88,12,0.1)' },
                    { key: 'percent', label: '% เปอร์เซ็นต์', color: '#EA580C', bg: 'rgba(234,88,12,0.1)' },
                    { key: 'per_day', label: '🌙 รายคืน', color: '#7C3AED', bg: 'rgba(124,58,237,0.1)' },
                  ] as const).map(t => (
                    <button key={t.key} onClick={() => setForm(f => ({ ...f, discountType: t.key }))}
                      className="h-10 rounded-xl text-xs font-bold transition-all"
                      style={form.discountType === t.key
                        ? { background: t.bg, border: `2px solid ${t.color}`, color: t.color }
                        : { background: '#F8FAFF', border: '2px solid #E2E8F0', color: '#64748B' }}>
                      {t.label}
                    </button>
                  ))}
                </div>
                {form.discountType === 'per_day' && (
                  <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                    <Building2 className="size-3" /> คิดตามจำนวนคืนที่จอดผ่าน overnight window
                  </p>
                )}
              </div>

              {/* ค่าส่วนลด */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    {form.discountType === 'fixed' ? 'ลด (บาท)' : form.discountType === 'per_day' ? 'ลดต่อคืน (บาท)' : 'ลด (%)'}
                  </label>
                  <input type="number" min="0" value={form.discountValue}
                    onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))}
                    placeholder="0"
                    className="w-full h-10 rounded-xl px-3 text-sm font-black text-slate-800 outline-none"
                    style={{ border: '2px solid #E2E8F0', background: '#FAFBFF' }}
                    onFocus={e => { e.currentTarget.style.borderColor = form.discountType === 'per_day' ? '#7C3AED' : '#EA580C' }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0' }} />
                </div>
                {form.discountType === 'percent' && (
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1.5">สูงสุด (บาท)</label>
                    <input type="number" min="0" value={form.maxDiscount}
                      onChange={e => setForm(f => ({ ...f, maxDiscount: e.target.value }))}
                      placeholder="ไม่จำกัด"
                      className="w-full h-10 rounded-xl px-3 text-sm text-slate-800 outline-none"
                      style={{ border: '2px solid #E2E8F0', background: '#FAFBFF' }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#EA580C' }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0' }} />
                  </div>
                )}
              </div>

              {/* หมายเหตุ */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">หมายเหตุ (ไม่บังคับ)</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder={form.discountType === 'per_day' ? 'เช่น สำหรับแขกโรงแรม' : 'เช่น สำหรับลูกค้าที่ซื้อครบ 100 บาท'}
                  className="w-full h-10 rounded-xl px-3 text-sm text-slate-800 outline-none"
                  style={{ border: '2px solid #E2E8F0', background: '#FAFBFF' }}
                  onFocus={e => { e.currentTarget.style.borderColor = form.discountType === 'per_day' ? '#7C3AED' : '#EA580C' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0' }} />
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 h-11 rounded-xl text-sm font-bold text-slate-600"
                  style={{ background: '#F1F5F9', border: '1px solid #E2E8F0' }}>
                  ยกเลิก
                </button>
                <button onClick={handleSave} disabled={saving || !form.name || !form.discountValue}
                  className="flex-1 h-11 rounded-xl text-sm font-black text-white disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ background: form.discountType === 'per_day'
                    ? 'linear-gradient(135deg,#5B21B6,#7C3AED)'
                    : 'linear-gradient(135deg,#C2410C,#EA580C)' }}>
                  <Check className="size-4" />
                  {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete ── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl w-full max-w-xs mx-4 p-6 shadow-2xl text-center">
            <Trash2 className="size-10 mx-auto mb-3 text-red-400" />
            <p className="font-black text-slate-900">ลบส่วนลดนี้?</p>
            <p className="text-sm text-slate-400 mt-1">ไม่สามารถกู้คืนได้</p>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 h-10 rounded-xl text-sm font-bold text-slate-600"
                style={{ background: '#F1F5F9' }}>
                ยกเลิก
              </button>
              <button onClick={() => handleDelete(deleteId)}
                className="flex-1 h-10 rounded-xl text-sm font-black text-white"
                style={{ background: '#DC2626' }}>
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
