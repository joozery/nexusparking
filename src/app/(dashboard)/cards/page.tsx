'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CreditCard, Plus, Trash2, Car, Bike, Moon,
  Search, RefreshCw, Nfc, X, Check, ShieldCheck, ShieldOff,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

// Thai Kedmanee layout → English mapping (for USB card readers sending keystrokes in Thai mode)
const THAI_TO_EN: Record<string, string> = {
  // Number row (some systems convert number keys in Thai mode)
  'ๅ': '`', 'ภ': '3', 'ถ': '4', 'ุ': '5', 'ึ': '6',
  'ค': '7', 'ต': '8', 'จ': '9', 'ข': '0', 'ช': '-',
  '๑': '1', '๒': '2', '๓': '3', '๔': '4', '๕': '5',
  '๖': '6', '๗': '7', '๘': '8', '๙': '9', '๐': '0',
  // QWERTY row (regular)
  'ๆ': 'q', 'ไ': 'w', 'ำ': 'e', 'พ': 'r', 'ะ': 't',
  'ั': 'y', 'ี': 'u', 'ร': 'i', 'น': 'o', 'ย': 'p',
  'บ': '[', 'ล': ']',
  // ASDF row (regular)
  'ฟ': 'a', 'ห': 's', 'ก': 'd', 'ด': 'f', 'เ': 'g',
  '้': 'h', '่': 'j', 'า': 'k', 'ส': 'l', 'ว': ';', 'ง': "'",
  // ZXCV row (regular)
  'ผ': 'z', 'ป': 'x', 'แ': 'c', 'อ': 'v', 'ิ': 'b',
  'ื': 'n', 'ท': 'm', 'ม': ',', 'ใ': '.', 'ฝ': '/',
  // QWERTY row (shift = uppercase)
  'ฎ': 'E', 'ฑ': 'R', 'ธ': 'T', 'ณ': 'I', 'ฯ': 'O', 'ญ': 'P',
  // ASDF row (shift = uppercase)
  'ฤ': 'A', 'ฆ': 'S', 'ฏ': 'D', 'โ': 'F', 'ฌ': 'G',
  '็': 'H', '๋': 'J', 'ษ': 'K', 'ศ': 'L', 'ซ': ':',
  // ZXCV row (shift = uppercase)
  'ฉ': 'C', 'ฮ': 'V', 'ฺ': 'B', 'ฒ': 'M',
}

function convertThaiToEn(text: string): string {
  return text.split('').map(ch => THAI_TO_EN[ch] ?? ch).join('')
}

/**
 * Sanitise a raw UID string coming from a USB card reader.
 * After Thai→EN conversion, keep only hex-valid characters (0-9, A-F, a-f)
 * plus common separators used in UID notation (colon, hyphen, space).
 * Non-matching characters are stripped so garbage from the reader is removed.
 */
function sanitizeUid(raw: string): string {
  // Allow hex digits and common separators; strip everything else
  return raw.replace(/[^0-9A-Fa-f:\- ]/g, '')
}

type CardType = 'car' | 'motorcycle' | 'overnight'

interface ParkingCard {
  _id: string
  uid: string
  type: CardType
  label: string
  ownerName: string
  plate: string
  expiryDate?: string
  isActive: boolean
  createdAt: string
}

function expiryStatus(expiryDate?: string): 'none' | 'active' | 'expiring' | 'expired' {
  if (!expiryDate) return 'none'
  const diff = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000)
  if (diff < 0) return 'expired'
  if (diff <= 7) return 'expiring'
  return 'active'
}

const EXPIRY_META = {
  none:     { label: '',           color: '',        bg: '' },
  active:   { label: 'รายเดือน',  color: '#059669', bg: 'rgba(5,150,105,0.1)' },
  expiring: { label: 'ใกล้หมด',   color: '#D97706', bg: 'rgba(217,119,6,0.1)' },
  expired:  { label: 'หมดอายุ',   color: '#DC2626', bg: 'rgba(220,38,38,0.1)' },
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

  const [uid,        setUid]        = useState('')
  const [type,       setType]       = useState<CardType>('car')
  const [label,      setLabel]      = useState('')
  const [ownerName,  setOwnerName]  = useState('')
  const [plate,      setPlate]      = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [renewId,    setRenewId]    = useState<string | null>(null)
  const uidInputRef = useRef<HTMLInputElement>(null)

  // Radix Dialog has a FocusTrap that finishes setting up *after*
  // onOpenAutoFocus fires. A double requestAnimationFrame lets the trap
  // fully initialise before we move focus, so it doesn't steal it back.

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
        body: JSON.stringify({ uid: uid.trim(), type, label, ownerName, plate, expiryDate: expiryDate || null }),
      })
      if (!res.ok) {
        const err = await res.json()
        toastError('ลงทะเบียนไม่สำเร็จ', err.error ?? 'เกิดข้อผิดพลาด')
        return
      }
      setUid(''); setLabel(''); setType('car'); setOwnerName(''); setPlate(''); setExpiryDate(''); setShowForm(false)
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

  async function handleRenew(id: string) {
    const card = cards.find(c => c._id === id)
    if (!card) return
    const base = card.expiryDate && new Date(card.expiryDate) > new Date()
      ? new Date(card.expiryDate)
      : new Date()
    base.setMonth(base.getMonth() + 1)
    const newExpiry = base.toISOString()
    await fetch(`/api/cards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiryDate: newExpiry }),
    })
    setCards(prev => prev.map(c => c._id === id ? { ...c, expiryDate: newExpiry } : c))
    setRenewId(null)
    success('ต่ออายุสำเร็จ', `ถึง ${new Date(newExpiry).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`)
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
            <button onClick={() => setShowForm(true)}
              className="h-8 px-4 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity"
              style={{ background: '#1D4ED8', boxShadow: '0 1px 8px rgba(29,78,216,0.3)' }}>
              <Plus className="size-3.5" />
              เพิ่มบัตรใหม่
            </button>
          </div>
        </div>
      </header>

      {/* ── ADD CARD DIALOG ── */}
      <Dialog open={showForm} onOpenChange={open => {
        setShowForm(open)
        if (!open) { setUid(''); setLabel(''); setType('car'); setOwnerName(''); setPlate(''); setExpiryDate('') }
      }}>
        <DialogContent className="max-w-md"
          onOpenAutoFocus={e => {
            e.preventDefault()
            requestAnimationFrame(() => requestAnimationFrame(() => uidInputRef.current?.focus()))
          }}>
          <DialogHeader>
            <div className="flex items-center gap-2 px-5 py-3.5"
              style={{ background: 'rgba(29,78,216,0.04)', borderBottom: '1px solid rgba(29,78,216,0.1)' }}>
              <Nfc className="size-4" style={{ color: '#1D4ED8' }} />
              <DialogTitle>ลงทะเบียนบัตรใหม่</DialogTitle>
            </div>
          </DialogHeader>
          <form onSubmit={handleAdd}>
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
                  <input ref={uidInputRef}
                    value={uid} onChange={e => setUid(sanitizeUid(convertThaiToEn(e.target.value)))}
                    placeholder="แตะบัตรหรือพิมพ์ UID"
                    required
                    className="w-full h-9 px-3 rounded-lg text-sm font-mono text-slate-800 outline-none"
                    style={{ border: '1.5px solid #E8ECF4', background: '#F8FAFF' }}
                    onFocus={e => e.currentTarget.style.borderColor = '#1D4ED8'}
                    onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">ทะเบียนรถ</label>
                  <input value={plate} onChange={e => setPlate(e.target.value)}
                    placeholder="เช่น กข 1234"
                    className="w-full h-9 px-3 rounded-lg text-sm text-slate-800 outline-none"
                    style={{ border: '1.5px solid #E8ECF4', background: '#F8FAFF' }}
                    onFocus={e => e.currentTarget.style.borderColor = '#1D4ED8'}
                    onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">ชื่อเจ้าของ</label>
                  <input value={ownerName} onChange={e => setOwnerName(e.target.value)}
                    placeholder="เช่น สมชาย ใจดี"
                    className="w-full h-9 px-3 rounded-lg text-sm text-slate-800 outline-none"
                    style={{ border: '1.5px solid #E8ECF4', background: '#F8FAFF' }}
                    onFocus={e => e.currentTarget.style.borderColor = '#1D4ED8'}
                    onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">ชื่อ / หมายเหตุ</label>
                  <input value={label} onChange={e => setLabel(e.target.value)}
                    placeholder="เช่น บัตรรายเดือน #001"
                    className="w-full h-9 px-3 rounded-lg text-sm text-slate-800 outline-none"
                    style={{ border: '1.5px solid #E8ECF4', background: '#F8FAFF' }}
                    onFocus={e => e.currentTarget.style.borderColor = '#1D4ED8'}
                    onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'} />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">วันหมดอายุ (ถ้าเป็นบัตรรายเดือน)</label>
                  <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg text-sm text-slate-800 outline-none"
                    style={{ border: '1.5px solid #E8ECF4', background: '#F8FAFF' }}
                    onFocus={e => e.currentTarget.style.borderColor = '#1D4ED8'}
                    onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 pb-5">
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
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-slate-50/60">

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

                const status = expiryStatus(card.expiryDate)
                const em = EXPIRY_META[status]
                const isRenew = renewId === card._id

                return (
                  <div key={card._id}
                    className="bg-white rounded-xl overflow-hidden transition-shadow hover:shadow-md"
                    style={{ border: `1px solid ${isConfirm ? 'rgba(220,38,38,0.3)' : status === 'expired' ? 'rgba(220,38,38,0.2)' : '#E8ECF4'}` }}>

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
                            {card.ownerName || card.label || <span className="text-slate-300 italic">ไม่มีชื่อ</span>}
                          </p>
                          {card.plate && (
                            <p className="text-[10px] font-mono font-semibold text-slate-600 mt-0.5">{card.plate}</p>
                          )}
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                              style={{ background: m.bg, color: m.color }}>{m.label}</span>
                            {status !== 'none' && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                style={{ background: em.bg, color: em.color }}>
                                {em.label} · {fmtDate(card.expiryDate!)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="shrink-0 flex items-center gap-1">
                          {/* Renew */}
                          {status !== 'none' && !isConfirm && (
                            isRenew ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => handleRenew(card._id)}
                                  className="h-6 px-2 rounded-lg text-[10px] font-semibold text-white"
                                  style={{ background: '#059669' }}>
                                  ยืนยัน +1 เดือน
                                </button>
                                <button onClick={() => setRenewId(null)}
                                  className="size-6 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400">
                                  <X className="size-3" />
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setRenewId(card._id)}
                                className="h-6 px-2 rounded-lg text-[10px] font-semibold transition-colors hover:bg-green-50"
                                style={{ color: '#059669', border: '1px solid rgba(5,150,105,0.3)' }}>
                                ต่ออายุ
                              </button>
                            )
                          )}
                          {/* Delete */}
                          {!isRenew && (isConfirm ? (
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
                          ))}
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
