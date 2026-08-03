'use client'

import { useEffect, useState } from 'react'
import {
  CreditCard, Plus, Trash2, Car, Bike, Moon,
  Search, RefreshCw, Nfc,
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

const TYPE_META: Record<CardType, { label: string; icon: typeof Car; color: string; bg: string; border: string }> = {
  car:        { label: 'รถยนต์',       icon: Car,  color: '#1D4ED8', bg: 'rgba(29,78,216,0.07)',  border: 'rgba(29,78,216,0.2)'  },
  motorcycle: { label: 'มอเตอร์ไซค์', icon: Bike, color: '#3B82F6', bg: 'rgba(59,130,246,0.07)', border: 'rgba(59,130,246,0.2)' },
  overnight:  { label: 'ค้างคืน',     icon: Moon, color: '#F59E0B', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.2)' },
}

export default function CardsPage() {
  const { success, error: toastError } = useToast()
  const [cards,    setCards]    = useState<ParkingCard[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)

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
      setUid(''); setLabel(''); setShowForm(false)
      success('ลงทะเบียนบัตรสำเร็จ', `UID: ${uid.trim()}`)
      fetchCards()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, cardUid: string) {
    if (!confirm(`ลบบัตร UID: ${cardUid} ออกจากระบบ?`)) return
    const res = await fetch(`/api/cards/${id}`, { method: 'DELETE' })
    if (res.ok) { success('ลบบัตรแล้ว', `UID: ${cardUid}`); fetchCards() }
    else toastError('ลบไม่สำเร็จ', 'กรุณาลองใหม่อีกครั้ง')
  }

  async function handleToggle(id: string, isActive: boolean) {
    await fetch(`/api/cards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    })
    fetchCards()
  }

  const filtered = cards.filter(c =>
    c.uid.toLowerCase().includes(search.toLowerCase()) ||
    c.label.toLowerCase().includes(search.toLowerCase())
  )

  const countByType = (t: CardType) => cards.filter(c => c.type === t).length

  return (
    <>
      <header className="shrink-0 h-14 bg-white flex items-center justify-between px-6"
        style={{ borderBottom: '1px solid #E8ECF4' }}>
        <div className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded-lg"
            style={{ background: 'rgba(29,78,216,0.08)' }}>
            <CreditCard className="size-3.5" style={{ color: '#1D4ED8' }} />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 leading-none">จัดการบัตรจอดรถ</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">ลงทะเบียน UID บัตรก่อนนำไปใช้งาน</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchCards}
            className="size-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: '#F1F5F9' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#E2E8F0' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#F1F5F9' }}>
            <RefreshCw className={`size-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowForm(v => !v)}
            className="h-8 px-4 rounded-lg text-white text-xs font-bold flex items-center gap-1.5 transition-opacity hover:opacity-90"
            style={{ background: '#1D4ED8', boxShadow: '0 1px 8px rgba(29,78,216,0.35)' }}>
            <Plus className="size-3.5" /> ลงทะเบียนบัตรใหม่
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col gap-4 p-5 overflow-auto">

        {/* Summary */}
        <div className="shrink-0 grid grid-cols-3 gap-3">
          {(['car', 'motorcycle', 'overnight'] as CardType[]).map(t => {
            const m = TYPE_META[t]
            const Icon = m.icon
            return (
              <div key={t} className="bg-white rounded-2xl px-5 py-4 flex items-center gap-4"
                style={{ border: '1px solid #E8ECF4' }}>
                <div className="size-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: m.bg }}>
                  <Icon className="size-5" style={{ color: m.color }} strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400">{m.label}</p>
                  <p className="text-2xl font-black text-slate-900">{countByType(t)}</p>
                  <p className="text-[10px] text-slate-400">บัตรทั้งหมด</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Add form */}
        {showForm && (
          <form onSubmit={handleAdd} className="bg-white rounded-2xl p-5 shrink-0"
            style={{ border: '1px solid rgba(29,78,216,0.2)', boxShadow: '0 0 0 4px rgba(29,78,216,0.04)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Nfc className="size-4" style={{ color: '#1D4ED8' }} />
              <p className="text-sm font-black text-slate-900">ลงทะเบียนบัตรใหม่</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">UID บัตร *</label>
                <input value={uid} onChange={e => setUid(e.target.value)} placeholder="เช่น A1B2C3D4"
                  required className="w-full h-9 px-3 rounded-lg text-sm font-mono text-slate-800 outline-none"
                  style={{ border: '1px solid #E8ECF4', background: '#F8FAFF' }} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">ประเภทบัตร *</label>
                <select value={type} onChange={e => setType(e.target.value as CardType)}
                  className="w-full h-9 px-3 rounded-lg text-sm text-slate-800 outline-none"
                  style={{ border: '1px solid #E8ECF4', background: '#F8FAFF' }}>
                  <option value="car">รถยนต์ (Car)</option>
                  <option value="motorcycle">มอเตอร์ไซค์ (Motorcycle)</option>
                  <option value="overnight">ค้างคืน (Overnight)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">ชื่อ / หมายเหตุ</label>
                <input value={label} onChange={e => setLabel(e.target.value)} placeholder="เช่น บัตร #001"
                  className="w-full h-9 px-3 rounded-lg text-sm text-slate-800 outline-none"
                  style={{ border: '1px solid #E8ECF4', background: '#F8FAFF' }} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setShowForm(false)}
                className="h-8 px-4 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors">
                ยกเลิก
              </button>
              <button type="submit" disabled={saving}
                className="h-8 px-5 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: '#1D4ED8' }}>
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </form>
        )}

        {/* Card list */}
        <div className="flex-1 bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
          <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid #E8ECF4' }}>
            <div className="relative flex-1 max-w-xs">
              <Search className="size-3 text-slate-400 absolute left-3 top-2.5" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="ค้นหา UID หรือชื่อบัตร..."
                className="w-full h-8 pl-8 pr-3 rounded-lg text-xs text-slate-700 outline-none"
                style={{ background: '#F8FAFF', border: '1px solid #E8ECF4' }} />
            </div>
            <span className="text-xs text-slate-400">{filtered.length} บัตร</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw className="size-5 text-slate-300 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <CreditCard className="size-8 text-slate-200" />
              <p className="text-sm text-slate-400">ยังไม่มีบัตรที่ลงทะเบียน</p>
              <button onClick={() => setShowForm(true)}
                className="text-xs font-bold mt-1" style={{ color: '#1D4ED8' }}>
                + ลงทะเบียนบัตรแรก
              </button>
            </div>
          ) : (
            <div>
              {filtered.map((card, i) => {
                const m = TYPE_META[card.type]
                const Icon = m.icon
                return (
                  <div key={card._id}
                    className="flex items-center gap-4 px-5 py-3.5"
                    style={i < filtered.length - 1 ? { borderBottom: '1px solid #F1F5F9' } : {}}>
                    <div className="size-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: m.bg, border: `1px solid ${m.border}` }}>
                      <Icon className="size-4" style={{ color: m.color }} strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black font-mono text-slate-800">{card.uid}</span>
                        {card.label && <span className="text-xs text-slate-400">{card.label}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: m.bg, color: m.color }}>{m.label}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(card.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => handleToggle(card._id, card.isActive)}
                        className="text-[10px] font-bold px-2 py-1 rounded-full transition-colors"
                        style={card.isActive
                          ? { background: 'rgba(16,185,129,0.08)', color: '#059669' }
                          : { background: 'rgba(239,68,68,0.08)', color: '#DC2626' }
                        }>
                        {card.isActive ? 'ใช้งานได้' : 'ปิดใช้'}
                      </button>
                      <button onClick={() => handleDelete(card._id, card.uid)}
                        className="size-7 rounded-lg flex items-center justify-center transition-colors"
                        style={{ color: '#CBD5E1' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#EF4444'; (e.currentTarget as HTMLElement).style.background = '#FEF2F2' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#CBD5E1'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                        <Trash2 className="size-3.5" />
                      </button>
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
