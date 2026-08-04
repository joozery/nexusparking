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
  status: 'active' | 'completed' | 'lost'
}

interface Stats {
  activeCars: number
  availableSlots: number
  totalCapacity: number
  todayEntries: number
  todayRevenue: number
}

const TYPE_META: Record<CardType, { label: string; icon: typeof Car; color: string; bg: string }> = {
  car:        { label: 'รถยนต์',       icon: Car,  color: '#1D4ED8', bg: 'rgba(29,78,216,0.08)'  },
  motorcycle: { label: 'มอเตอร์ไซค์', icon: Bike, color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
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

  function resetCI() { setCiStep('scan'); setCiPlate(''); setCiType('car'); setCiUid('') }
  function resetCO() { setCoStep('scan'); setCoSessionId('') }

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
      const t: CardType[] = ['car', 'motorcycle', 'overnight']
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
        warning('Check In สำเร็จ (นอกเวลาทำการ)', `ทะเบียน ${ciPlate} — เวลาทำการ ${data.businessHours}`)
      } else {
        success('Check In สำเร็จ', `ทะเบียน ${ciPlate} เข้าลานเรียบร้อย`)
      }
    } else {
      const err = await res.json()
      toastError('Check In ไม่สำเร็จ', err.error ?? 'เกิดข้อผิดพลาด')
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
      const t: CardType[] = ['car', 'motorcycle', 'overnight']
      const type = t[Math.floor(Math.random() * t.length)]
      const h = Math.ceil(Math.random() * 5) + 1
      setCoType(type); setCoHours(h); setCoFee(calcFee(type, h))
      setCoStep('payment')
    }
  }

  async function handleCheckout() {
    const res = await fetch('/api/sessions/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: coSessionId || undefined }),
    })
    if (res.ok) {
      setCheckOutOpen(false); resetCO(); fetchData()
      success('Check Out สำเร็จ', `ชำระค่าบริการ ฿${coFee} เรียบร้อย`)
    } else {
      const err = await res.json()
      toastError('Check Out ไม่สำเร็จ', err.error ?? 'เกิดข้อผิดพลาด')
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

  function printReceipt(s: Session, currentFee?: number) {
    const fee      = currentFee ?? s.totalFee ?? s.fee ?? 0
    const lostFine = (s as Session & { lostFine?: number }).lostFine ?? 0
    const parkFee  = lostFine > 0 ? fee - lostFine : fee
    const entry    = new Date(s.entryTime)
    const exit     = s.status !== 'active' ? new Date((s as Session & { exitTime?: string }).exitTime ?? Date.now()) : new Date()
    const durMin   = Math.max(1, Math.round((exit.getTime() - entry.getTime()) / 60000))
    const durHr    = Math.floor(durMin / 60)
    const durMn    = durMin % 60
    const fmt      = (d: Date) => d.toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: '2-digit', hour12: false })
    const now      = new Date()
    const typeLabel: Record<CardType, string> = { car: 'รถยนต์', motorcycle: 'มอเตอร์ไซค์', overnight: 'ค้างคืน' }

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
  .sm { font-size: 10px; }
  .dash { border-top: 1px dashed #000; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; padding: 2px 0; }
  .row.total { font-weight: 700; font-size: 15px; border-top: 2px solid #000; padding-top: 4px; margin-top: 2px; }
  .badge { display: inline-block; border: 1px solid #000; border-radius: 3px; padding: 0 4px; font-size: 10px; }
  .lost-row { color: #c00; font-weight: 700; }
</style>
</head>
<body>
<div class="center bold lg" style="letter-spacing:1px">NEXUS PARKING</div>
<div class="center sm" style="margin-top:2px">ระบบจัดการลานจอดรถ</div>
<div class="dash"></div>

<div class="row"><span class="sm">วันที่พิมพ์</span><span class="sm">${fmt(now)}</span></div>
<div class="row"><span class="sm">เลขที่</span><span class="sm bold">${s._id.slice(-8).toUpperCase()}</span></div>

<div class="dash"></div>

<div class="center xl bold" style="letter-spacing:4px;margin:4px 0">${s.plate}</div>
<div class="center sm">${typeLabel[s.cardType]} &nbsp;|&nbsp; UID: ${s.cardUid.slice(0, 10)}</div>

<div class="dash"></div>

<div class="row"><span>เวลาเข้า</span><span class="bold">${fmt(entry)}</span></div>
<div class="row"><span>เวลาออก</span><span class="bold">${s.status === 'active' ? '(ยังจอดอยู่)' : fmt(exit)}</span></div>
<div class="row"><span>ระยะเวลา</span><span class="bold">${durHr > 0 ? durHr + ' ชม. ' : ''}${durMn} นาที</span></div>

<div class="dash"></div>

${s.cardType !== 'overnight' ? `
<div class="row"><span>ชั่วโมงแรก</span><span>฿${s.cardType === 'car' ? 30 : 20}</span></div>
${Math.ceil(durMin / 60) > 1 ? `<div class="row"><span>ชั่วโมงถัดไป ×${Math.ceil(durMin/60)-1}</span><span>฿${(s.cardType === 'car' ? 20 : 10) * (Math.ceil(durMin/60)-1)}</span></div>` : ''}
` : `<div class="row"><span>อัตราค้างคืนเหมาจ่าย</span><span>฿100</span></div>`}

${lostFine > 0 ? `<div class="row lost-row"><span>ค่าปรับบัตรหาย</span><span>฿${lostFine}</span></div>` : ''}

<div class="row total"><span>${s.status === 'lost' ? 'ยอดรวม (บัตรหาย)' : 'ยอดรวมทั้งสิ้น'}</span><span>฿${fee}</span></div>

<div class="dash"></div>
<div class="center sm" style="margin:6px 0">ขอบคุณที่ใช้บริการ<br>Thank you for your visit</div>
<div class="dash"></div>
<div class="center sm" style="opacity:0.5">** กรุณาเก็บใบเสร็จไว้เป็นหลักฐาน **</div>
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
            style={{ background: 'rgba(29,78,216,0.08)' }}>
            <ArrowDownLeft className="size-3.5" style={{ color: '#1D4ED8' }} />
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
          <button onClick={() => setLostOpen(true)}
            className="h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
            style={{ background: 'rgba(245,158,11,0.08)', color: '#B45309', border: '1px solid rgba(245,158,11,0.2)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.14)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.08)' }}>
            <AlertTriangle className="size-3" /> บัตรหาย
          </button>
          <button onClick={() => { resetCI(); setCheckInOpen(true) }}
            className="h-8 px-4 rounded-lg text-white text-xs font-bold flex items-center gap-1.5 transition-opacity hover:opacity-90"
            style={{ background: '#1D4ED8', boxShadow: '0 1px 8px rgba(29,78,216,0.35)' }}>
            <LogIn className="size-3.5" /> Check In
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex flex-col gap-4 p-5 overflow-hidden min-h-0">

        {/* Stats */}
        <div className="shrink-0 grid grid-cols-4 gap-3">
          {[
            { label: 'รถในลาน',      value: stats?.activeCars,     sub: `จาก ${stats?.totalCapacity ?? 200} คัน`, icon: CircleParking,   iconBg: 'rgba(29,78,216,0.1)',  iconColor: '#1D4ED8', bar: true },
            { label: 'ที่จอดว่าง',   value: stats?.availableSlots, sub: 'ที่ว่าง',                               icon: Car,             iconBg: 'rgba(16,185,129,0.1)', iconColor: '#10B981', bar: false },
            { label: 'รายได้วันนี้', value: stats ? `฿${stats.todayRevenue.toLocaleString()}` : undefined, sub: 'วันนี้', icon: BadgeDollarSign, iconBg: 'rgba(16,185,129,0.1)', iconColor: '#10B981', bar: false },
            { label: 'แจ้งเตือน',   value: sessions.filter(s => s.status === 'lost' || !s.status).length || undefined, sub: 'รายการผิดปกติ', icon: ShieldAlert, iconBg: 'rgba(245,158,11,0.1)', iconColor: '#F59E0B', bar: false },
          ].map(({ label, value, sub, icon: Icon, iconBg, iconColor, bar }) => (
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
        <div className="flex gap-4 flex-1 min-h-0">

          {/* Vehicle list */}
          <div className="w-[280px] shrink-0 flex flex-col bg-white rounded-xl overflow-hidden"
            style={{ border: '1px solid #E8ECF4' }}>
            <div className="shrink-0 px-4 pt-3.5 pb-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-black text-slate-900">รถในลาน</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(29,78,216,0.08)', color: '#1D4ED8' }}>
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
                    ? { background: '#1D4ED8', color: 'white' }
                    : { background: '#F8FAFF', color: '#94A3B8' }
                  }>
                  {label}<span className="opacity-60">({count})</span>
                </button>
              ))}
            </div>

            <div style={{ borderTop: '1px solid #F1F5F9' }} />

            <div className="flex-1 overflow-y-auto scrollbar-hide">
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
                    style={on ? { background: 'rgba(29,78,216,0.05)' } : {}}
                    onMouseEnter={e => { if (!on) e.currentTarget.style.background = '#F8FAFF' }}
                    onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent' }}>
                    {on && <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full" style={{ background: '#1D4ED8' }} />}
                    <div className="size-8 rounded-lg flex items-center justify-center shrink-0"
                      style={on ? { background: '#1D4ED8' } : { background: m.bg }}>
                      <VIcon className="size-3.5" style={{ color: on ? 'white' : m.color }} strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black tracking-wide" style={{ color: on ? '#1D4ED8' : '#1E293B' }}>
                          {s.plate}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={s.status === 'active'
                            ? { background: 'rgba(16,185,129,0.08)', color: '#059669' }
                            : { background: 'rgba(29,78,216,0.07)', color: '#1D4ED8' }
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
                      <p className="text-sm font-black" style={{ color: on ? '#1D4ED8' : '#334155' }}>
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
            <div className="flex-1 flex flex-col bg-white rounded-xl overflow-hidden"
              style={{ border: '1px solid #E8ECF4' }}>

              {/* Blue header */}
              <div className="shrink-0 relative overflow-hidden px-6 py-5"
                style={{ background: 'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 60%, #2563EB 100%)' }}>
                <div className="absolute -top-8 -right-8 size-32 rounded-full pointer-events-none"
                  style={{ background: 'rgba(255,255,255,0.06)' }} />
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(255,255,255,0.18)' }}>
                      <TypeIcon className="size-6 text-white" strokeWidth={1.75} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-black text-white tracking-wider">{active.plate}</h2>
                        <span className="text-[10px] font-black px-2 py-1 rounded-full"
                          style={active.status === 'active'
                            ? { background: 'rgba(16,185,129,0.22)', color: '#6EE7B7' }
                            : { background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }
                          }>
                          {active.status === 'active' ? 'จอดอยู่' : 'เสร็จสิ้น'}
                        </span>
                      </div>
                      <p className="text-white/60 text-xs mt-1">
                        {tm?.label} · {active.status === 'active' ? 'จอดมาแล้ว' : 'จอดไป'} {fmtDur(active.entryTime, active.exitTime)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => printReceipt(active, liveFee)}
                    className="size-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                    style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
                    <Printer className="size-3.5 text-white/60" />
                  </button>
                </div>
              </div>

              {/* Info strip */}
              <div className="shrink-0 grid grid-cols-3"
                style={{ borderBottom: '1px solid #E8ECF4' }}>
                {[
                  { icon: ArrowDownLeft, label: 'เวลาเข้า',    value: new Date(active.entryTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }), iconColor: '#1D4ED8', iconBg: 'rgba(29,78,216,0.08)' },
                  { icon: Clock,         label: 'ระยะเวลา',    value: fmtDur(active.entryTime, active.exitTime), iconColor: '#3B82F6', iconBg: 'rgba(59,130,246,0.08)' },
                  { icon: Hash,          label: 'ประเภทอัตรา', value: active.cardType === 'overnight' ? 'Overnight' : 'Daytime', iconColor: '#F59E0B', iconBg: 'rgba(245,158,11,0.08)' },
                ].map(({ icon: Icon, label, value, iconColor, iconBg }, i) => (
                  <div key={label} className="flex items-center gap-3 px-5 py-3"
                    style={i < 2 ? { borderRight: '1px solid #E8ECF4' } : {}}>
                    <div className="size-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: iconBg }}>
                      <Icon className="size-3.5" style={{ color: iconColor }} strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
                      <p className="text-sm font-black text-slate-800">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Fee breakdown */}
              <div className="flex-1 px-6 py-5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">รายละเอียดค่าบริการ</p>
                <div className="space-y-2.5">
                  {active.cardType !== 'overnight' ? (
                    <>
                      <div className="flex items-center justify-between py-2.5 px-4 rounded-lg"
                        style={{ background: '#F8FAFF', border: '1px solid #E8ECF4' }}>
                        <div className="flex items-center gap-3">
                          <div className="size-6 rounded-lg flex items-center justify-center"
                            style={{ background: 'rgba(29,78,216,0.08)' }}>
                            <span className="text-[9px] font-black" style={{ color: '#1D4ED8' }}>1</span>
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
                              style={{ background: 'rgba(59,130,246,0.08)' }}>
                              <span className="text-[9px] font-black" style={{ color: '#3B82F6' }}>+{extraHrs}</span>
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
                  style={{ background: 'rgba(29,78,216,0.05)', border: '1.5px solid rgba(29,78,216,0.15)' }}>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">ยอดชำระทั้งสิ้น</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {isActiveSession ? 'ณ เวลาปัจจุบัน' : 'ยอดที่ชำระแล้ว'}
                    </p>
                  </div>
                  <span className="text-2xl font-black" style={{ color: '#1D4ED8' }}>฿{liveFee}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="shrink-0 px-6 pb-5 flex items-center gap-3"
                style={{ borderTop: '1px solid #E8ECF4', paddingTop: '16px' }}>
                <button onClick={() => setLostOpen(true)}
                  className="h-10 px-4 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors"
                  style={{ background: 'rgba(245,158,11,0.08)', color: '#B45309', border: '1px solid rgba(245,158,11,0.2)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.14)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.08)' }}>
                  <AlertTriangle className="size-3.5" /> บัตรหาย
                </button>
                <button
                  onClick={() => printReceipt(active, liveFee)}
                  className="h-10 px-4 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors"
                  style={{ background: '#F8FAFF', color: '#64748B', border: '1px solid #E8ECF4' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFF' }}>
                  <Printer className="size-3.5" /> พิมพ์ใบเสร็จ
                </button>
                <button
                  onClick={() => active.status === 'active' ? openCheckoutFromList(active) : null}
                  disabled={active.status !== 'active'}
                  className="flex-1 h-10 rounded-lg text-sm font-black text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
                  style={{ background: '#1D4ED8', boxShadow: '0 2px 12px rgba(29,78,216,0.35)' }}>
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
        step={coStep} cardType={coType} hours={coHours} fee={coFee}
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
