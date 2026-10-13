'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Car, Search, Bell, AlertTriangle, LogIn, Printer,
  BadgeDollarSign, ShieldAlert, Clock, Hash,
  ArrowDownLeft, ArrowUpRight, Bike, Moon,
  ChevronRight, CircleParking, RefreshCw,
} from 'lucide-react'
import { CheckInDialog }  from '@/components/parking/CheckInDialog'
import { CheckOutDialog } from '@/components/parking/CheckOutDialog'
import { LostCardDialog } from '@/components/parking/LostCardDialog'
import { type CardType, calcFee } from '@/components/parking/types'
import { useToast } from '@/components/ui/Toast'

function checkOutsideHours(open: string, close: string) {
  const now = new Date()
  const cur = now.getHours() * 60 + now.getMinutes()
  const [oh, om] = open.split(':').map(Number)
  const [ch, cm] = close.split(':').map(Number)
  return cur < oh * 60 + om || cur >= ch * 60 + cm
}

interface Session {
  _id: string
  cardUid: string
  cardType: CardType
  plate: string
  entryTime: string
  exitTime?: string
  durationMin: number
  fee: number
  totalFee: number
  discountAmount?: number
  fineAmount?: number
  lostFine?: number
  paymentMethod?: 'cash' | 'qr'
  status: 'active' | 'completed' | 'lost'
}

interface LotStats {
  active:    number
  capacity:  number
  available: number
}

interface Stats {
  activeCars: number
  availableSlots: number
  totalCapacity: number
  todayEntries: number
  todayRevenue: number
  car: LotStats
  motorcycle: LotStats
}

const TYPE_META: Record<CardType, { label: string; icon: typeof Car; color: string; bg: string }> = {
  car:        { label: 'รถยนต์',       icon: Car,  color: '#A16207', bg: 'rgba(161,98,7,0.08)'  },
  motorcycle: { label: 'รถจักรยานยนต์', icon: Bike, color: '#EAB308', bg: 'rgba(234,179,8,0.08)' },
  overnight:  { label: 'ค้างคืน',     icon: Moon, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
}

function fmtDur(entryTime: string, exitTime?: string) {
  const end  = exitTime ? new Date(exitTime).getTime() : Date.now()
  const diff = end - new Date(entryTime).getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return h > 0 ? `${h} ชม. ${m} น.` : `${m} น.`
}

export default function GatePage() {
  const { success, error: toastError, warning, info } = useToast()
  const [sessions,     setSessions]     = useState<Session[]>([])
  const [stats,        setStats]        = useState<Stats | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [bizOpen,      setBizOpen]      = useState('06:30')
  const [bizClose,     setBizClose]     = useState('22:00')
  const [activeId,     setActiveId]     = useState<string | null>(null)
  const [activeTab,    setActiveTab]    = useState<'all' | 'active' | 'completed'>('all')
  const [search,       setSearch]       = useState('')

  const [checkInOpen,  setCheckInOpen]  = useState(false)
  const [checkOutOpen, setCheckOutOpen] = useState(false)
  const [lostOpen,     setLostOpen]     = useState(false)

  // CheckIn state
  const [ciStep,  setCiStep]  = useState<'scan' | 'confirm'>('scan')
  const [ciType,  setCiType]  = useState<CardType>('car')
  const [ciPlate, setCiPlate] = useState('')
  const [ciUid,   setCiUid]   = useState('')

  // CheckOut state
  const [coStep,  setCoStep]  = useState<'scan' | 'payment'>('scan')
  const [coType,  setCoType]  = useState<CardType>('car')
  const [coHours, setCoHours] = useState(1)
  const [coFee,   setCoFee]   = useState(0)
  const [coSessionId, setCoSessionId] = useState('')
  const [lockedLostCheckout, setLockedLostCheckout] = useState(false)

  function resetCI() { setCiStep('scan'); setCiPlate(''); setCiType('car'); setCiUid('') }
  function resetCO() { setCoStep('scan'); setCoSessionId(''); setLockedLostCheckout(false) }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, stRes, settingsRes] = await Promise.all([
        fetch('/api/sessions?limit=50'),
        fetch('/api/stats'),
        fetch('/api/settings'),
      ])
      const sData  = await sRes.json()
      const stData = await stRes.json()
      const settingsData = await settingsRes.json()
      setSessions(sData.sessions ?? [])
      setStats(stData)
      if (settingsData?.businessHours) {
        setBizOpen(settingsData.businessHours.open)
        setBizClose(settingsData.businessHours.close)
      }
      if (!activeId && sData.sessions?.length > 0) setActiveId(sData.sessions[0]._id)
    } finally {
      setLoading(false)
    }
  }, [activeId])

  useEffect(() => { fetchData() }, [])

  // Simulate card scan → pick random registered card UID for demo
  async function simulateCIScan() {
    const cardsRes = await fetch('/api/cards')
    const cards = await cardsRes.json()
    if (cards.length > 0) {
      const card = cards[Math.floor(Math.random() * cards.length)]
      setCiUid(card.uid)
      setCiType(card.type)
    } else {
      // No registered cards — fallback to demo mode
      const t: CardType[] = ['car', 'motorcycle']
      setCiType(t[Math.floor(Math.random() * t.length)])
      setCiUid('DEMO-' + Math.random().toString(36).slice(2, 8).toUpperCase())
    }
    setCiStep('confirm')
  }

  async function handleCheckin() {
    if (!ciPlate || ciPlate.length !== 4) return
    // ciUid มีค่า = สแกนบัตรจริง, ไม่มี = เลือกประเภทด้วยมือ (walk-in)
    const body = ciUid
      ? { uid: ciUid, plate: ciPlate }
      : { cardType: ciType, plate: ciPlate }
    const res = await fetch('/api/sessions/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const data = await res.json()
      setCheckInOpen(false); resetCI(); fetchData()
      if (data.outsideHours) {
        warning('ขาเข้าสำเร็จ (นอกเวลาทำการ)', `ทะเบียน ${ciPlate} — เวลาทำการ ${data.businessHours}`)
      } else {
        success('ขาเข้าสำเร็จ', `ทะเบียน ${ciPlate} เข้าลานเรียบร้อย`)
      }
    } else {
      const err = await res.json()
      toastError('ขาเข้าไม่สำเร็จ', err.error ?? 'เกิดข้อผิดพลาด')
    }
  }

  async function simulateCOScan() {
    // Find an active session for checkout demo
    const active = sessions.find(s => s.status === 'active')
    if (active) {
      const durationMin = Math.max(1, Math.floor((Date.now() - new Date(active.entryTime).getTime()) / 60000))
      const hours = Math.ceil(durationMin / 60)
      const fee = calcFee(active.cardType, hours)
      setCoType(active.cardType)
      setCoHours(hours)
      setCoFee(fee)
      setCoSessionId(active._id)
      setCoStep('payment')
    } else {
      const t: CardType[] = ['car', 'motorcycle']
      const type = t[Math.floor(Math.random() * t.length)]
      const h = Math.ceil(Math.random() * 5) + 1
      setCoType(type); setCoHours(h); setCoFee(calcFee(type, h))
      setCoStep('payment')
    }
  }

  async function handleCheckout(paymentMethod: 'cash' | 'qr' = 'cash', discountId?: string, dailyDiscountId?: string, isLostCard?: boolean, fineId?: string) {
    const res = await fetch('/api/sessions/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: coSessionId || undefined, paymentMethod, discountId, dailyDiscountId, lostCard: isLostCard === true, fineId }),
    })
    if (res.ok) {
      setCheckOutOpen(false); resetCO(); fetchData()
      success('ขาออกสำเร็จ', `ชำระค่าบริการ ฿${coFee} เรียบร้อย`)
    } else {
      const err = await res.json()
      toastError('ขาออกไม่สำเร็จ', err.error ?? 'เกิดข้อผิดพลาด')
    }
  }

  async function handleLostCard(plate: string, estimatedHours: number, cardType: 'car' | 'motorcycle') {
    const res = await fetch('/api/sessions/lost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plate, estimatedHours, cardType }),
    })
    if (res.ok) {
      const data = await res.json()
      setLostOpen(false); fetchData()
      warning('บันทึกบัตรหาย', `ทะเบียน ${plate} — ยอดรวม ฿${data.totalFee}`)
    } else {
      const err = await res.json()
      toastError('บันทึกไม่สำเร็จ', err.error ?? 'เกิดข้อผิดพลาด')
    }
  }

  async function printReceipt(s: Session, currentFee?: number) {
    if (s.status !== 'completed') return
    // The list response can be stale after checkout. Load the persisted receipt
    // data so discounts/fines printed from Gate match the completed session.
    let receiptSession = s
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(s._id)}/receipt`, { cache: 'no-store' })
      if (res.ok) receiptSession = { ...s, ...(await res.json()) }
    } catch {
      // Keep the currently displayed session as a safe fallback.
    }
    s = receiptSession
    const fee      = currentFee ?? s.totalFee ?? s.fee ?? 0
    const parkingFee = s.fee ?? fee
    const discountAmount = s.discountAmount ?? 0
    const fineAmount = s.fineAmount ?? 0
    const lostFine = s.lostFine ?? 0
    const combinedFine = fineAmount + lostFine
    const total = s.totalFee ?? fee
    const paymentLabel = s.paymentMethod === 'qr' ? 'โอนเงิน' : s.paymentMethod === 'cash' ? 'เงินสด' : 'ยังไม่ชำระ'
    const entry    = new Date(s.entryTime)
    const exit     = new Date((s as Session & { exitTime?: string }).exitTime ?? Date.now())
    const durationSeconds = Math.max(0, Math.floor((exit.getTime() - entry.getTime()) / 1000))
    const durationDays = Math.floor(durationSeconds / 86400)
    const durationHours = Math.floor(durationSeconds % 86400 / 3600)
    const durationMinutes = Math.floor(durationSeconds % 3600 / 60)
    const durationSecondsRemainder = durationSeconds % 60
    const fmt      = (d: Date) => d.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    const duration = `${durationDays} วัน ${durationHours} ชั่วโมง ${durationMinutes} นาที ${durationSecondsRemainder} วินาที`
    const typeLabel: Record<CardType, string> = { car: 'รถยนต์', motorcycle: 'รถจักรยานยนต์', overnight: 'ค้างคืน' }

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>ใบเสร็จจอดรถ</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
  @page { size: 80mm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Sarabun', 'Courier New', monospace;
    font-size: 12px;
    width: 80mm;
    padding: 6mm 5mm 10mm;
    color: #000;
    background: #fff;
  }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .lg { font-size: 16px; }
  .xl { font-size: 22px; }
  .sm { font-size: 12px; line-height: 1.5; }
  .logo { margin-bottom: 3px; }
  .logo img { width: 42mm; max-height: 18mm; object-fit: contain; }
  .dash { border-top: 1px dashed #000; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; padding: 2px 0; }
  .row.total { font-weight: 700; font-size: 15px; border-top: 2px solid #000; padding-top: 4px; margin-top: 2px; }
  .badge { display: inline-block; border: 1px solid #000; border-radius: 3px; padding: 0 4px; font-size: 10px; }
  .lost-row { color: #000; font-weight: 700; }
</style>
</head>
<body>
<div class="center logo"><img src="${location.origin}/logo/receipt-logo.png" alt="A20 Park"></div>
<div class="center bold lg">ใบเสร็จรับเงิน</div>
<div class="center bold lg">A20 Park</div>
<div class="row"><span>ทะเบียน</span><span class="bold">${s.plate}</span></div>
<div class="row"><span>ประเภทรถ</span><span class="bold">${typeLabel[s.cardType]}</span></div>

<div class="dash"></div>

<div class="row"><span>เวลาเข้า</span><span class="bold">${fmt(entry)}</span></div>
<div class="row"><span>เวลาออก</span><span class="bold">${fmt(exit)}</span></div>

<div class="dash"></div>

<div class="row"><span>เวลาจอด</span><span class="bold">${duration}</span></div>

<div class="row"><span>ค่าจอดรถ</span><span>${parkingFee.toLocaleString('th-TH')} บาท</span></div>
<div class="row"><span>ส่วนลด</span><span>${discountAmount.toLocaleString('th-TH')} บาท</span></div>
<div class="row lost-row"><span>ค่าปรับ</span><span>${combinedFine.toLocaleString('th-TH')} บาท</span></div>

<div class="row total"><span>ยอดชำระสุทธิ</span><span>${total.toLocaleString('th-TH')} บาท</span></div>

<div class="row"><span>ชำระโดย</span><span class="bold">${paymentLabel}</span></div>
<div class="dash"></div>
<div class="center sm" style="margin:6px 0">หากมีข้อสงสัยหรือต้องการสอบถามข้อมูลเพิ่มเติม<br>Facebook:A20Park<br>ขอบคุณที่ใช้บริการ</div>
</body>
</html>`

    const w = window.open('', '_blank', 'width=340,height=600,scrollbars=yes')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.onload = () => { w.focus(); w.print() }
  }

  function openCheckoutFromList(s: Session) {
    const durationMin = Math.max(1, Math.floor((Date.now() - new Date(s.entryTime).getTime()) / 60000))
    const hours = Math.ceil(durationMin / 60)
    setCoType(s.cardType); setCoHours(hours); setCoFee(calcFee(s.cardType, hours))
    setCoSessionId(s._id); setCoStep('payment'); setCheckOutOpen(true)
  }

  function openLostCardFromActive() {
    if (!active) { setLostOpen(true); return }
    const durationMin = Math.max(1, Math.floor((Date.now() - new Date(active.entryTime).getTime()) / 60000))
    const hours = Math.ceil(durationMin / 60)
    setCoType(active.cardType); setCoHours(hours); setCoFee(calcFee(active.cardType, hours))
    setCoSessionId(active._id); setLockedLostCheckout(true); setCoStep('payment'); setCheckOutOpen(true)
  }

  const filtered = sessions.filter(s => {
    const matchTab = activeTab === 'all' ? true : activeTab === 'active' ? s.status === 'active' : s.status === 'completed'
    const matchSearch = search === '' || s.plate.toLowerCase().includes(search.toLowerCase()) || s.cardUid.toLowerCase().includes(search.toLowerCase())
    return matchTab && matchSearch
  })

  const active = sessions.find(s => s._id === activeId) ?? sessions[0] ?? null
  const tm     = active ? TYPE_META[active.cardType] : null
  const TypeIcon = tm?.icon ?? Car
  const baseRate  = active?.cardType === 'car' ? 30 : active?.cardType === 'motorcycle' ? 20 : 100
  const extraRate = active?.cardType === 'car' ? 20 : active?.cardType === 'motorcycle' ? 10 : 0
  // active session → คำนวณ live, completed/lost → ใช้ค่าที่บันทึกไว้
  const isActiveSession = active?.status === 'active'
  const durationMin = active
    ? isActiveSession
      ? Math.max(1, Math.floor((Date.now() - new Date(active.entryTime).getTime()) / 60000))
      : active.durationMin
    : 0
  const hours    = Math.ceil(durationMin / 60)
  const extraHrs = hours > 1 ? hours - 1 : 0
  const liveFee  = active
    ? isActiveSession ? calcFee(active.cardType, hours) : active.totalFee
    : 0

  return (
    <>
      {/* Header */}
      <header className="shrink-0 h-14 bg-white flex items-center justify-between px-6"
        style={{ borderBottom: '1px solid #E8ECF4' }}>
        <div className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded-lg"
            style={{ background: 'rgba(161,98,7,0.08)' }}>
            <ArrowDownLeft className="size-3.5" style={{ color: '#A16207' }} />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 leading-none">ประตูเข้า-ออก</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">เวลาทำการ {bizOpen}–{bizClose}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData}
            className="size-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: '#F1F5F9' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#E2E8F0' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#F1F5F9' }}>
            <RefreshCw className={`size-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button className="size-8 rounded-lg flex items-center justify-center relative transition-colors"
            style={{ background: '#F1F5F9' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#E2E8F0' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#F1F5F9' }}>
            <Bell className="size-3.5 text-slate-500" />
            <span className="absolute top-1.5 right-1.5 size-1.5 bg-red-500 rounded-full border border-white" />
          </button>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <button onClick={() => { resetCI(); setCheckInOpen(true) }}
            className="h-8 px-4 rounded-lg text-black text-xs font-bold flex items-center gap-1.5 transition-opacity hover:opacity-90"
            style={{ background: '#EAB308', boxShadow: '0 1px 8px rgba(161,98,7,0.35)' }}>
            <LogIn className="size-3.5" /> ขาเข้า
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex flex-col gap-4 p-5 overflow-y-auto md:overflow-hidden min-h-0">

        {/* Stats */}
        <div className="shrink-0 grid grid-cols-3 gap-3">
          {[
            { label: 'รถในลาน',      value: stats?.activeCars,     sub: stats ? `รถ ${stats.car.active} · รถจักรยานยนต์ ${stats.motorcycle.active}` : `จาก 200 คัน`, icon: CircleParking,   iconBg: 'rgba(161,98,7,0.1)',  iconColor: '#A16207', bar: true },
            { label: 'ที่จอดว่าง',   value: stats?.availableSlots, sub: stats ? `รถ ${stats.car.available} · รถจักรยานยนต์ ${stats.motorcycle.available}` : 'ที่ว่าง', icon: Car,             iconBg: 'rgba(16,185,129,0.1)', iconColor: '#10B981', bar: false },
            { label: 'รายได้วันนี้', value: stats ? `฿${stats.todayRevenue.toLocaleString()}` : undefined, sub: 'วันนี้', icon: BadgeDollarSign, iconBg: 'rgba(16,185,129,0.1)', iconColor: '#10B981', bar: false },
            { label: 'แจ้งเตือน',   value: sessions.filter(s => s.status === 'lost' || !s.status).length || undefined, sub: 'รายการผิดปกติ', icon: ShieldAlert, iconBg: 'rgba(245,158,11,0.1)', iconColor: '#F59E0B', bar: false },
          ].slice(0, 3).map(({ label, value, sub, icon: Icon, iconBg, iconColor, bar }) => (
            <div key={label} className="bg-white rounded-xl px-4 py-3.5 flex items-center gap-3.5"
              style={{ border: '1px solid #E8ECF4' }}>
              <div className="size-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: iconBg }}>
                <Icon className="size-4" style={{ color: iconColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-slate-400 truncate">{label}</p>
                <p className="text-lg font-black text-slate-900 leading-tight">{value ?? '—'}</p>
                {bar
                  ? <div className="mt-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${stats ? Math.round((stats.activeCars / stats.totalCapacity) * 100) : 0}%`, background: iconColor }} />
                    </div>
                  : <p className="text-[10px] text-slate-400 truncate">{sub}</p>
                }
              </div>
            </div>
          ))}
        </div>

        {/* Split */}
        <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-0">

          {/* Vehicle list */}
          <div className="w-full md:w-[280px] shrink-0 flex flex-col bg-white rounded-xl overflow-hidden max-h-[48vh] md:max-h-none"
            style={{ border: '1px solid #E8ECF4' }}>
            <div className="shrink-0 px-4 pt-3.5 pb-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-black text-slate-900">รถในลาน</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(161,98,7,0.08)', color: '#A16207' }}>
                  {sessions.filter(s => s.status === 'active').length} คัน
                </span>
              </div>
              <div className="relative">
                <Search className="size-3 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="ค้นหาทะเบียน / UID..."
                  className="w-full h-8 pl-7 pr-3 rounded-lg text-xs text-slate-700 outline-none"
                  style={{ background: '#F8FAFF', border: '1px solid #E8ECF4' }} />
              </div>
            </div>

            <div className="shrink-0 flex px-3 gap-1 pb-2">
              {([
                { key: 'all',       label: 'ทั้งหมด', count: sessions.length },
                { key: 'active',    label: 'จอดอยู่',  count: sessions.filter(s => s.status === 'active').length },
                { key: 'completed', label: 'เสร็จแล้ว', count: sessions.filter(s => s.status === 'completed').length },
              ] as const).map(({ key, label, count }) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                  style={activeTab === key
                    ? { background: '#EAB308', color: 'black' }
                    : { background: '#F8FAFF', color: '#94A3B8' }
                  }>
                  {label}<span className="opacity-60">({count})</span>
                </button>
              ))}
            </div>

            <div style={{ borderTop: '1px solid #F1F5F9' }} />

            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
              {loading ? (
                <div className="flex items-center justify-center h-20">
                  <RefreshCw className="size-4 text-slate-300 animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-20 gap-1">
                  <p className="text-xs text-slate-300">ไม่มีข้อมูล</p>
                </div>
              ) : filtered.map((s) => {
                const on = s._id === activeId
                const m  = TYPE_META[s.cardType]
                const VIcon = m.icon
                return (
                  <div key={s._id} onClick={() => setActiveId(s._id)}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-all relative"
                    style={on ? { background: 'rgba(161,98,7,0.05)' } : {}}
                    onMouseEnter={e => { if (!on) e.currentTarget.style.background = '#F8FAFF' }}
                    onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent' }}>
                    {on && <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full" style={{ background: '#EAB308' }} />}
                    <div className="size-8 rounded-lg flex items-center justify-center shrink-0"
                      style={on ? { background: '#EAB308' } : { background: m.bg }}>
                      <VIcon className="size-3.5" style={{ color: on ? 'black' : m.color }} strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black tracking-wide" style={{ color: on ? '#A16207' : '#1E293B' }}>
                          {s.plate}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={s.status === 'active'
                            ? { background: 'rgba(16,185,129,0.08)', color: '#059669' }
                            : { background: 'rgba(161,98,7,0.07)', color: '#A16207' }
                          }>
                          {s.status === 'active' ? 'จอดอยู่' : 'เสร็จ'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="size-2.5" /> {fmtDur(s.entryTime, s.exitTime)}
                        </span>
                        <span className="text-[10px] font-medium" style={{ color: m.color }}>{m.label}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-black" style={{ color: on ? '#A16207' : '#334155' }}>
                        ฿{s.status === 'active' ? calcFee(s.cardType, Math.ceil(Math.max(1, (Date.now() - new Date(s.entryTime).getTime()) / 3600000))) : s.totalFee}
                      </p>
                      <p className="text-[9px] text-slate-400 font-mono">{s.cardUid.slice(0, 8)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Detail panel */}
          {!active ? (
            <div className="flex-1 bg-white rounded-xl flex items-center justify-center"
              style={{ border: '1px solid #E8ECF4' }}>
              <div className="text-center">
                <CircleParking className="size-12 text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-300">เลือกรายการจากรายการด้านซ้าย</p>
              </div>
            </div>
          ) : (
            <div className="gate-detail-panel w-full min-w-0 md:flex-1 flex flex-col bg-white rounded-xl overflow-hidden min-h-[520px] md:min-h-0"
              style={{ border: '1px solid #E8ECF4' }}>

              {/* Yellow header */}
              <div className="shrink-0 relative overflow-hidden px-4 md:px-6 py-5"
                style={{ background: 'linear-gradient(135deg, #FFE119 0%, #FACC15 55%, #EAB308 100%)' }}>
                <div className="absolute -top-8 -right-8 size-32 rounded-full pointer-events-none"
                  style={{ background: 'rgba(255,255,255,0.35)' }} />
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(15,23,42,0.08)', border: '1px solid rgba(15,23,42,0.12)' }}>
                      <TypeIcon className="size-6 text-slate-900" strokeWidth={2} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-black text-slate-900 tracking-wider">{active.plate}</h2>
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs"
                          style={active.status === 'active'
                            ? { background: '#0F172A', color: '#34D399', border: '1px solid rgba(52,211,153,0.3)' }
                            : { background: 'rgba(15,23,42,0.12)', color: '#0F172A', border: '1px solid rgba(15,23,42,0.2)' }
                          }>
                          {active.status === 'active' && <span className="size-1.5 rounded-full bg-emerald-400" />}
                          {active.status === 'active' ? 'จอดอยู่' : 'เสร็จสิ้น'}
                        </span>
                      </div>
                      <p className="text-slate-800 text-xs font-semibold mt-1">
                        {tm?.label} · {active.status === 'active' ? 'จอดมาแล้ว' : 'จอดไป'} {fmtDur(active.entryTime, active.exitTime)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => printReceipt(active, liveFee)}
                    disabled={active.status !== 'completed'}
                    className="size-9 rounded-lg flex items-center justify-center bg-black/10 hover:bg-black/20 text-slate-900 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ border: '1px solid rgba(15,23,42,0.15)' }}
                    title="พิมพ์ใบเสร็จ">
                    <Printer className="size-4 text-slate-900" />
                  </button>
                </div>
              </div>

              {/* Info strip */}
              <div className="shrink-0 grid grid-cols-3 min-w-0"
                style={{ borderBottom: '1px solid #E8ECF4' }}>
                {[
                  { icon: ArrowDownLeft, label: 'วันที่/เวลาเข้า', value: (() => { const entry = new Date(active.entryTime); return `${entry.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${entry.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}` })(), iconColor: '#A16207', iconBg: 'rgba(161,98,7,0.08)' },
                  { icon: Clock,         label: 'ระยะเวลา',    value: fmtDur(active.entryTime, active.exitTime), iconColor: '#EAB308', iconBg: 'rgba(234,179,8,0.08)' },
                  { icon: Hash,          label: 'ประเภทอัตรา', value: active.cardType === 'overnight' ? 'Overnight' : 'Daytime', iconColor: '#F59E0B', iconBg: 'rgba(245,158,11,0.08)' },
                ].map(({ icon: Icon, label, value, iconColor, iconBg }, i) => (
                  <div key={label} className="flex min-w-0 items-center gap-1 md:gap-3 px-2 md:px-5 py-3"
                    style={i < 2 ? { borderRight: '1px solid #E8ECF4' } : {}}>
                    <div className="size-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: iconBg }}>
                      <Icon className="size-3.5" style={{ color: iconColor }} strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide break-words">{label}</p>
                      <p className="text-sm font-black text-slate-800 break-words">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Fee breakdown */}
              <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">รายละเอียดค่าบริการ</p>
                <div className="space-y-2.5">
                  {active.cardType !== 'overnight' ? (
                    <>
                      <div className="flex items-center justify-between py-2.5 px-4 rounded-lg"
                        style={{ background: '#F8FAFF', border: '1px solid #E8ECF4' }}>
                        <div className="flex items-center gap-3">
                          <div className="size-6 rounded-lg flex items-center justify-center"
                            style={{ background: 'rgba(161,98,7,0.08)' }}>
                            <span className="text-[9px] font-black" style={{ color: '#A16207' }}>1</span>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-700">ชั่วโมงแรก (Base rate)</p>
                            <p className="text-[10px] text-slate-400">อัตราเริ่มต้น</p>
                          </div>
                        </div>
                        <span className="text-sm font-black text-slate-800">฿{baseRate}</span>
                      </div>
                      {extraHrs > 0 && (
                        <div className="flex items-center justify-between py-2.5 px-4 rounded-lg"
                          style={{ background: '#F8FAFF', border: '1px solid #E8ECF4' }}>
                          <div className="flex items-center gap-3">
                            <div className="size-6 rounded-lg flex items-center justify-center"
                              style={{ background: 'rgba(234,179,8,0.08)' }}>
                              <span className="text-[9px] font-black" style={{ color: '#EAB308' }}>+{extraHrs}</span>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-700">{extraHrs} ชั่วโมงถัดไป</p>
                              <p className="text-[10px] text-slate-400">฿{extraRate} / ชั่วโมง</p>
                            </div>
                          </div>
                          <span className="text-sm font-black text-slate-800">฿{extraHrs * extraRate}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-between py-2.5 px-4 rounded-lg"
                      style={{ background: '#F8FAFF', border: '1px solid #E8ECF4' }}>
                      <div className="flex items-center gap-3">
                        <div className="size-6 rounded-lg flex items-center justify-center"
                          style={{ background: 'rgba(245,158,11,0.08)' }}>
                          <Moon className="size-3" style={{ color: '#F59E0B' }} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-700">อัตราค้างคืนเหมาจ่าย</p>
                          <p className="text-[10px] text-slate-400">18:00 – 07:00</p>
                        </div>
                      </div>
                      <span className="text-sm font-black text-slate-800">฿100</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between px-4 py-3.5 rounded-lg"
                  style={{ background: 'rgba(161,98,7,0.05)', border: '1.5px solid rgba(161,98,7,0.15)' }}>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">ยอดชำระทั้งสิ้น</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {isActiveSession ? 'ณ เวลาปัจจุบัน' : 'ยอดที่ชำระแล้ว'}
                    </p>
                  </div>
                  <span className="text-2xl font-black" style={{ color: '#A16207' }}>฿{liveFee}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="sticky bottom-0 z-10 shrink-0 px-4 md:px-6 pb-5 flex flex-wrap items-center gap-3 bg-white/95 backdrop-blur-sm md:static md:bg-transparent md:backdrop-blur-none"
                style={{ borderTop: '1px solid #E8ECF4', paddingTop: '16px' }}>
                <button onClick={openLostCardFromActive}
                  disabled={active?.status !== 'active'}
                  className="h-10 flex-1 min-w-[120px] px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: 'rgba(245,158,11,0.08)', color: '#B45309', border: '1px solid rgba(245,158,11,0.2)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.14)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.08)' }}>
                  <AlertTriangle className="size-3.5" /> บัตรหาย
                </button>
                <button
                  onClick={() => printReceipt(active, liveFee)}
                  disabled={active.status !== 'completed'}
                  className="h-10 flex-1 min-w-[120px] px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: '#F8FAFF', color: '#64748B', border: '1px solid #E8ECF4' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFF' }}>
                  <Printer className="size-3.5" /> พิมพ์ใบเสร็จ
                </button>
                <button
                  onClick={() => active.status === 'active' ? openCheckoutFromList(active) : null}
                  disabled={active.status !== 'active'}
                  className="w-full md:flex-1 h-10 rounded-lg text-sm font-black text-black flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
                  style={{ background: '#EAB308', boxShadow: '0 2px 12px rgba(161,98,7,0.35)' }}>
                  <ArrowUpRight className="size-4" />
                  Process Payment — ฿{liveFee}
                  <ChevronRight className="size-4 opacity-60" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <CheckInDialog
        open={checkInOpen}
        onOpenChange={o => { setCheckInOpen(o); if (!o) resetCI() }}
        step={ciStep} cardType={ciType} plate={ciPlate}
        onSimulateScan={simulateCIScan}
        onSelectType={t => { setCiType(t); setCiStep('confirm') }}
        onPlateChange={setCiPlate}
        onBack={() => setCiStep('scan')}
        onConfirm={handleCheckin}
      />
      <CheckOutDialog
        open={checkOutOpen}
        onOpenChange={o => { setCheckOutOpen(o); if (!o) resetCO() }}
        step={coStep} plate={active?.plate} cardType={coType} hours={coHours} fee={coFee}
        checkoutSource="card"
        entryTime={active ? new Date(active.entryTime) : undefined}
        entrySessionId={coSessionId || undefined}
        lockedLostCard={lockedLostCheckout}
        onSimulateScan={simulateCOScan}
        onBack={() => setCoStep('scan')}
        onConfirm={handleCheckout}
      />
      <LostCardDialog
        open={lostOpen}
        onOpenChange={setLostOpen}
        onConfirm={handleLostCard}
      />
    </>
  )
}
