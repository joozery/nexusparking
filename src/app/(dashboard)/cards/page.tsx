'use client'

import { useEffect, useState } from 'react'
import {
  CreditCard, Plus, Trash2, Car, Bike, Moon,
  Search, RefreshCw, Nfc, X, Check, ShieldCheck, ShieldOff,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

type CardType = 'car' | 'motorcycle' | 'overnight'

interface ParkingCard {
  _id: string
  uid: string
  type: CardType
  label: string
  isActive: boolean
  createdAt: string
}

const TYPE_META: Record<CardType, { label: string; icon: typeof Car; color: string; bg: string; grad: string; bgImage?: string }> = {
  car:        { label: 'รถยนต์',       icon: Car,  color: '#1D4ED8', bg: 'rgba(29,78,216,0.08)',  grad: 'linear-gradient(135deg,#1E3A8A,#2563EB)', bgImage: '/cardbg/car.png' },
  motorcycle: { label: 'มอเตอร์ไซค์', icon: Bike, color: '#0891B2', bg: 'rgba(8,145,178,0.08)',  grad: 'linear-gradient(135deg,#164E63,#0891B2)', bgImage: '/cardbg/motor.png' },
  overnight:  { label: 'ค้างคืน',     icon: Moon, color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', grad: 'linear-gradient(135deg,#4C1D95,#7C3AED)' },
}

const TYPE_TABS = [
  { key: '',            label: 'ทั้งหมด' },
  { key: 'car',        label: 'รถยนต์' },
  { key: 'motorcycle', label: 'มอเตอร์ไซค์' },
  { key: 'overnight',  label: 'ค้างคืน' },
] as const

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function CardsPage() {
  const { success, error: toastError } = useToast()
  const [cards,     setCards]     = useState<ParkingCard[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [typeTab,   setTypeTab]   = useState('')
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleting,  setDeleting]  = useState<string | null>(null)

  const [uid,   setUid]   = useState('')
  const [type,  setType]  = useState<CardType>('car')
  const [label, setLabel] = useState('')

  async function fetchCards() {
    setLoading(true)
    try {
      const res = await fetch('/api/cards')
      setCards(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCards() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!uid.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: uid.trim(), type, label }),
      })
      if (!res.ok) {
        const err = await res.json()
        toastError('ลงทะเบียนไม่สำเร็จ', err.error ?? 'เกิดข้อผิดพลาด')
        return
      }
      setUid(''); setLabel(''); setType('car'); setShowForm(false)
      success('ลงทะเบียนบัตรสำเร็จ', `UID: ${uid.trim()}`)
      fetchCards()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      const res = await fetch(`/api/cards/${id}`, { method: 'DELETE' })
      if (res.ok) {
        const card = cards.find(c => c._id === id)
        setCards(prev => prev.filter(c => c._id !== id))
        success('ลบบัตรแล้ว', `UID: ${card?.uid}`)
      } else {
        toastError('ลบไม่สำเร็จ', 'กรุณาลองใหม่อีกครั้ง')
      }
    } finally {
      setDeleting(null)
      setConfirmId(null)
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    await fetch(`/api/cards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    })
    setCards(prev => prev.map(c => c._id === id ? { ...c, isActive: !isActive } : c))
  }

  const filtered = cards.filter(c => {
    const matchType   = !typeTab || c.type === typeTab
    const matchSearch = !search || c.uid.toLowerCase().includes(search.toLowerCase()) || c.label.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  const activeCount   = cards.filter(c => c.isActive).length
  const inactiveCount = cards.length - activeCount

  return (
    <>
      {/* ── HEADER ── */}
      <header className="shrink-0 bg-white" style={{ borderBottom: '1px solid #E8ECF4' }}>
        <div className="flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-3">
            <div className="flex size-7 items-center justify-center rounded-lg"
              style={{ background: 'rgba(29,78,216,0.08)' }}>
              <CreditCard className="size-3.5" style={{ color: '#1D4ED8' }} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-none">จัดการบัตรจอดรถ</h1>
              <p className="text-[10px] text-slate-400 mt-0.5">บัตรทั้งหมด {cards.length} ใบ · ใช้งานได้ {activeCount} ใบ</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchCards}
              className="size-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors">
              <RefreshCw className={`size-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => { setShowForm(v => !v) }}
              className="h-8 px-4 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity"
              style={{ background: showForm ? '#374151' : '#1D4ED8', boxShadow: '0 1px 8px rgba(29,78,216,0.3)' }}>
              {showForm ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
              {showForm ? 'ยกเลิก' : 'เพิ่มบัตรใหม่'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-slate-50/60">

        {/* ── ADD FORM ── */}
        {showForm && (
          <div className="shrink-0 mx-5 mt-4">
            <form onSubmit={handleAdd}
              className="bg-white rounded-xl overflow-hidden"
              style={{ border: '1.5px solid rgba(29,78,216,0.25)', boxShadow: '0 0 0 4px rgba(29,78,216,0.05)' }}>
              <div className="flex items-center gap-2 px-5 py-3.5"
                style={{ background: 'rgba(29,78,216,0.04)', borderBottom: '1px solid rgba(29,78,216,0.1)' }}>
                <Nfc className="size-4" style={{ color: '#1D4ED8' }} />
                <p className="text-sm font-semibold text-slate-800">ลงทะเบียนบัตรใหม่</p>
              </div>
              <div className="p-5 space-y-4">
                {/* Card type visual selector */}
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-2">ประเภทบัตร</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['car', 'motorcycle', 'overnight'] as CardType[]).map(t => {
                      const m = TYPE_META[t]
                      const Icon = m.icon
                      const active = type === t
                      return (
                        <button key={t} type="button" onClick={() => setType(t)}
                          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all text-left"
                          style={active
                            ? { background: m.bg, border: `1.5px solid ${m.color}`, color: m.color }
                            : { background: '#F8FAFF', border: '1.5px solid #E8ECF4', color: '#94A3B8' }}>
                          <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                          <span className="text-xs font-semibold">{m.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">UID บัตร *</label>
                    <input value={uid} onChange={e => setUid(e.target.value)}
                      placeholder="เช่น A1B2C3D4"
                      required
                      className="w-full h-9 px-3 rounded-lg text-sm font-mono text-slate-800 outline-none"
                      style={{ border: '1.5px solid #E8ECF4', background: '#F8FAFF' }}
                      onFocus={e => e.currentTarget.style.borderColor = '#1D4ED8'}
                      onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">ชื่อ / หมายเหตุ</label>
                    <input value={label} onChange={e => setLabel(e.target.value)}
                      placeholder="เช่น บัตร VIP #001"
                      className="w-full h-9 px-3 rounded-lg text-sm text-slate-800 outline-none"
                      style={{ border: '1.5px solid #E8ECF4', background: '#F8FAFF' }}
                      onFocus={e => e.currentTarget.style.borderColor = '#1D4ED8'}
                      onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'} />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setShowForm(false)}
                    className="h-8 px-4 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
                    ยกเลิก
                  </button>
                  <button type="submit" disabled={saving || !uid.trim()}
                    className="h-8 px-5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
                    style={{ background: '#1D4ED8' }}>
                    {saving ? <RefreshCw className="size-3 animate-spin" /> : <Check className="size-3" />}
                    {saving ? 'กำลังบันทึก...' : 'บันทึกบัตร'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ── SUMMARY + FILTER ── */}
        <div className="shrink-0 px-5 pt-4 pb-3 space-y-3">
          {/* Stat row */}
          <div className="grid grid-cols-5 gap-3">
            <div className="col-span-2 bg-white rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ border: '1px solid #E8ECF4' }}>
              <div className="size-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(29,78,216,0.08)' }}>
                <CreditCard className="size-4" style={{ color: '#1D4ED8' }} />
              </div>
              <div>
                <p className="text-[10px] text-slate-400">บัตรทั้งหมด</p>
                <p className="text-xl font-bold text-slate-900">{cards.length}</p>
              </div>
              <div className="ml-auto flex flex-col items-end gap-0.5">
                <span className="text-[10px] font-semibold flex items-center gap-1" style={{ color: '#059669' }}>
                  <ShieldCheck className="size-3" />{activeCount} ใช้งานได้
                </span>
                <span className="text-[10px] font-semibold flex items-center gap-1 text-slate-400">
                  <ShieldOff className="size-3" />{inactiveCount} ปิดใช้
                </span>
              </div>
            </div>
            {(['car', 'motorcycle', 'overnight'] as CardType[]).map(t => {
              const m = TYPE_META[t]
              const Icon = m.icon
              const count = cards.filter(c => c.type === t).length
              return (
                <div key={t} className="bg-white rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer transition-shadow hover:shadow-sm"
                  style={{ border: `1px solid ${typeTab === t ? m.color : '#E8ECF4'}` }}
                  onClick={() => setTypeTab(prev => prev === t ? '' : t)}>
                  <div className="size-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: m.bg }}>
                    <Icon className="size-4" style={{ color: m.color }} strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">{m.label}</p>
                    <p className="text-lg font-bold text-slate-900">{count}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Search + filter */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="size-3 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="ค้นหา UID หรือชื่อบัตร..."
                className="h-8 pl-8 pr-3 rounded-lg text-xs text-slate-700 outline-none w-52"
                style={{ background: 'white', border: '1px solid #E8ECF4' }}
                onFocus={e => e.currentTarget.style.borderColor = '#1D4ED8'}
                onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'} />
            </div>
            <div className="flex items-center rounded-lg p-0.5 gap-0.5" style={{ background: '#F1F5F9' }}>
              {TYPE_TABS.map(t => (
                <button key={t.key}
                  onClick={() => setTypeTab(t.key)}
                  className="h-7 px-3 rounded-md text-[11px] font-semibold transition-all"
                  style={typeTab === t.key
                    ? { background: 'white', color: '#1D4ED8', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
                    : { color: '#94A3B8' }}>
                  {t.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-400 ml-auto">{filtered.length} บัตร</span>
          </div>
        </div>

        {/* ── CARD GRID ── */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 scrollbar-hide">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw className="size-5 text-slate-300 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 bg-white rounded-xl"
              style={{ border: '1px solid #E8ECF4' }}>
              <CreditCard className="size-8 text-slate-200" />
              <p className="text-sm text-slate-400">ยังไม่มีบัตรที่ลงทะเบียน</p>
              <button onClick={() => setShowForm(true)}
                className="text-xs font-semibold mt-1" style={{ color: '#1D4ED8' }}>
                + เพิ่มบัตรแรก
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map(card => {
                const m = TYPE_META[card.type]
                const Icon = m.icon
                const isConfirm = confirmId === card._id

                return (
                  <div key={card._id}
                    className="bg-white rounded-xl overflow-hidden transition-shadow hover:shadow-md"
                    style={{ border: `1px solid ${isConfirm ? 'rgba(220,38,38,0.3)' : '#E8ECF4'}` }}>

                    {/* Card header — gradient / bg image */}
                    <div className="relative px-4 pt-4 pb-3 overflow-hidden"
                      style={m.bgImage
                        ? { backgroundImage: `url(${m.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                        : { background: m.grad }}>
                      <div className="absolute -top-4 -right-4 size-20 rounded-full pointer-events-none"
                        style={{ background: 'rgba(255,255,255,0.08)' }} />
                      <div className="absolute -bottom-3 -left-3 size-12 rounded-full pointer-events-none"
                        style={{ background: 'rgba(255,255,255,0.05)' }} />
                      <div className="relative z-10 flex items-start justify-between">
                        <div className="size-9 rounded-lg flex items-center justify-center"
                          style={{ background: 'rgba(255,255,255,0.2)' }}>
                          <Icon className="size-5 text-white" strokeWidth={1.75} />
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Active toggle */}
                          <button onClick={() => handleToggle(card._id, card.isActive)}
                            className="h-6 px-2 rounded-full text-[10px] font-semibold transition-all"
                            style={card.isActive
                              ? { background: 'rgba(255,255,255,0.25)', color: 'white' }
                              : { background: 'rgba(0,0,0,0.2)', color: 'rgba(255,255,255,0.6)' }}>
                            {card.isActive ? '● ใช้งาน' : '○ ปิดใช้'}
                          </button>
                        </div>
                      </div>
                      <div className="relative z-10 mt-3">
                        <p className="text-white/60 text-[9px] font-semibold uppercase tracking-widest">UID</p>
                        <p className="text-white font-bold font-mono text-base tracking-wider leading-tight">{card.uid}</p>
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-700 truncate">
                            {card.label || <span className="text-slate-300 italic">ไม่มีชื่อ</span>}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                              style={{ background: m.bg, color: m.color }}>{m.label}</span>
                            · {fmtDate(card.createdAt)}
                          </p>
                        </div>

                        {/* Delete */}
                        <div className="shrink-0">
                          {isConfirm ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDelete(card._id)} disabled={deleting === card._id}
                                className="size-7 rounded-lg flex items-center justify-center transition-colors"
                                style={{ background: '#DC2626', color: 'white' }}>
                                {deleting === card._id
                                  ? <RefreshCw className="size-3 animate-spin" />
                                  : <Check className="size-3" />}
                              </button>
                              <button onClick={() => setConfirmId(null)}
                                className="size-7 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-400">
                                <X className="size-3" />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmId(card._id)}
                              className="size-7 rounded-lg flex items-center justify-center transition-all hover:bg-red-50"
                              style={{ color: '#CBD5E1' }}
                              onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
                              onMouseLeave={e => e.currentTarget.style.color = '#CBD5E1'}>
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
