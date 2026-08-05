'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LogIn, LogOut, AlertTriangle,
  Car, Bike, Moon, RefreshCw, Clock, Search,
  Play, Square, Banknote, Smartphone, X,
  ListOrdered, Plus, CheckCheck, XCircle,
} from 'lucide-react'
import { CheckInDialog } from '@/components/parking/CheckInDialog'
import { CheckOutDialog, type PaymentMethod } from '@/components/parking/CheckOutDialog'
import { LostCardDialog } from '@/components/parking/LostCardDialog'
import { type CardType, calcFee } from '@/components/parking/types'
import { useToast } from '@/components/ui/Toast'

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
}

interface QueueEntry {
  _id: string
  plate: string
  cardType: 'car' | 'motorcycle'
  joinedAt: string
  status: 'waiting'
}

interface Shift {
  _id: string
  operatorName: string
  startTime: string
  status: 'active' | 'closed'
  checkinsCount: number
  checkoutsCount: number
  cashAmount: number
  qrAmount: number
  totalAmount: number
}

const TYPE_META: Record<CardType, { label: string; icon: typeof Car; color: string; bg: string }> = {
  car:        { label: 'รถยนต์',       icon: Car,  color: '#1D4ED8', bg: 'rgba(29,78,216,0.1)'  },
  motorcycle: { label: 'มอเตอร์ไซค์', icon: Bike, color: '#6D28D9', bg: 'rgba(109,40,217,0.1)' },
  overnight:  { label: 'ค้างคืน',     icon: Moon, color: '#B45309', bg: 'rgba(180,83,9,0.1)'   },
}

function LiveClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const update = () =>
      setTime(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }))
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [])
  return <>{time}</>
}

function fmtDuration(entryTime: string) {
  const diff = Date.now() - new Date(entryTime).getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return h > 0 ? `${h} ชม. ${m} น.` : `${m} น.`
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

export default function OperatorPage() {
  const { success, error: toastError, warning } = useToast()

  const [sessions, setSessions] = useState<Session[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [shift, setShift] = useState<Shift | null | undefined>(undefined) // undefined = loading
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [shiftEnding, setShiftEnding] = useState(false)
  const [openingFloat, setOpeningFloat] = useState('')
  const [closingFloat, setClosingFloat] = useState('')

  // Queue
  const [queues, setQueues] = useState<QueueEntry[]>([])
  const [queueOpen, setQueueOpen] = useState(false)  // add-to-queue dialog
  const [qPlate, setQPlate] = useState('')
  const [qType, setQType] = useState<'car' | 'motorcycle'>('car')
  const [qLoading, setQLoading] = useState<string | null>(null) // id of row being actioned

  // Check In
  const [checkInOpen,   setCheckInOpen]   = useState(false)
  const [ciStep,        setCiStep]        = useState<'scan' | 'confirm'>('scan')
  const [ciType,        setCiType]        = useState<CardType>('car')
  const [ciPlate,       setCiPlate]       = useState('')
  const [ciUid,         setCiUid]         = useState('')
  const [ciCustomTime,  setCiCustomTime]  = useState('')

  // Check Out
  const [checkOutOpen, setCheckOutOpen] = useState(false)
  const [coStep, setCoStep] = useState<'scan' | 'payment'>('scan')
  const [coType, setCoType] = useState<CardType>('car')
  const [coHours, setCoHours] = useState(1)
  const [coFee, setCoFee] = useState(0)
  const [coSessionId, setCoSessionId] = useState('')

  // Lost card
  const [lostOpen, setLostOpen] = useState(false)

  function resetCI() { setCiStep('scan'); setCiPlate(''); setCiType('car'); setCiUid(''); setCiCustomTime('') }
  function resetCO() { setCoStep('scan'); setCoSessionId('') }

  const fetchShift = useCallback(async () => {
    const res = await fetch('/api/shifts/current')
    setShift(res.ok ? await res.json() : null)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const [sRes, stRes, qRes] = await Promise.all([
        fetch('/api/sessions?status=active&limit=50'),
        fetch('/api/stats'),
        fetch('/api/queue'),
      ])
      const sData = await sRes.json()
      const stData = await stRes.json()
      const qData = await qRes.json()
      setSessions(sData.sessions ?? [])
      setStats(stData)
      setQueues(Array.isArray(qData) ? qData : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchShift()
    fetchData()
  }, [fetchShift, fetchData])

  useEffect(() => {
    const t = setInterval(fetchData, 15000)
    return () => clearInterval(t)
  }, [fetchData])

  // Queue actions
  async function addToQueue() {
    if (!qPlate || qPlate.length < 2) return
    const res = await fetch('/api/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plate: qPlate, cardType: qType }),
    })
    if (res.ok) {
      setQueueOpen(false); setQPlate(''); setQType('car')
      await fetchData()
      success('เพิ่มคิวแล้ว', `ทะเบียน ${qPlate} อยู่ในคิวลำดับที่ ${queues.length + 1}`)
    } else {
      const err = await res.json()
      toastError('เพิ่มคิวไม่สำเร็จ', err.error)
    }
  }

  async function enterFromQueue(id: string, plate: string) {
    setQLoading(id)
    const res = await fetch(`/api/queue/${id}/enter`, { method: 'POST' })
    setQLoading(null)
    if (res.ok) {
      await Promise.all([fetchData(), fetchShift()])
      success('เข้าลานแล้ว', `ทะเบียน ${plate} Check In สำเร็จ`)
    } else {
      const err = await res.json()
      toastError('ไม่สำเร็จ', err.error)
    }
  }

  async function cancelQueue(id: string, plate: string) {
    setQLoading(id)
    const res = await fetch(`/api/queue/${id}/cancel`, { method: 'POST' })
    setQLoading(null)
    if (res.ok) {
      await fetchData()
      warning('ยกเลิกคิว', `ทะเบียน ${plate} ออกจากคิวแล้ว`)
    } else {
      const err = await res.json()
      toastError('ไม่สำเร็จ', err.error)
    }
  }

  // Shift actions
  async function startShift() {
    const res = await fetch('/api/shifts/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ openingFloat: Number(openingFloat) || 0 }),
    })
    if (res.ok) {
      setOpeningFloat('')
      await fetchShift()
      success('เริ่มกะแล้ว', 'ระบบเริ่มนับยอดเงินและรถสำหรับกะนี้')
    } else {
      const err = await res.json()
      toastError('ไม่สามารถเริ่มกะได้', err.error)
    }
  }

  async function endShift() {
    const res = await fetch('/api/shifts/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closingFloat: Number(closingFloat) || 0 }),
    })
    if (res.ok) {
      setShiftEnding(false)
      setClosingFloat('')
      success('ปิดกะแล้ว', 'บันทึกยอดเรียบร้อย — กำลังออกจากระบบ...')
      setTimeout(handleLogout, 1500)
    } else {
      const err = await res.json()
      toastError('ไม่สามารถปิดกะได้', err.error)
    }
  }

  // Check In
  async function simulateCIScan() {
    const res = await fetch('/api/cards')
    const cards = await res.json()
    if (cards.length > 0) {
      const card = cards[Math.floor(Math.random() * cards.length)]
      setCiUid(card.uid); setCiType(card.type)
    } else {
      const types: CardType[] = ['car', 'motorcycle', 'overnight']
      setCiType(types[Math.floor(Math.random() * types.length)])
      setCiUid('DEMO-' + Math.random().toString(36).slice(2, 8).toUpperCase())
    }
    setCiStep('confirm')
  }

  async function handleCheckin() {
    if (!ciPlate || ciPlate.length !== 4) return
    const body: Record<string, string> = ciUid
      ? { uid: ciUid, plate: ciPlate }
      : { cardType: ciType, plate: ciPlate }
    if (ciCustomTime) body.entryTime = new Date(ciCustomTime).toISOString()
    const res = await fetch('/api/sessions/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setCheckInOpen(false); resetCI()
      await Promise.all([fetchData(), fetchShift()])
      success('Check In สำเร็จ', `ทะเบียน ${ciPlate} เข้าลานเรียบร้อย`)
    } else {
      const err = await res.json()
      toastError('Check In ไม่สำเร็จ', err.error ?? 'เกิดข้อผิดพลาด')
    }
  }

  // Check Out (scan dialog)
  async function simulateCOScan() {
    const active = sessions.find(s => s.status === 'active')
    if (!active) return
    const durationMin = Math.max(1, Math.floor((Date.now() - new Date(active.entryTime).getTime()) / 60000))
    const hours = Math.ceil(durationMin / 60)
    setCoType(active.cardType); setCoHours(hours); setCoFee(calcFee(active.cardType, hours))
    setCoSessionId(active._id); setCoStep('payment')
  }

  function openCheckoutFromCard(s: Session) {
    const durationMin = Math.max(1, Math.floor((Date.now() - new Date(s.entryTime).getTime()) / 60000))
    const hours = Math.ceil(durationMin / 60)
    setCoType(s.cardType); setCoHours(hours); setCoFee(calcFee(s.cardType, hours))
    setCoSessionId(s._id); setCoStep('payment'); setCheckOutOpen(true)
  }

  async function handleCheckout(paymentMethod: PaymentMethod, discountId?: string) {
    const res = await fetch('/api/sessions/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: coSessionId || undefined, paymentMethod, discountId }),
    })
    if (res.ok) {
      setCheckOutOpen(false); resetCO()
      await Promise.all([fetchData(), fetchShift()])
      const label = paymentMethod === 'qr' ? 'โอนเงิน' : 'เงินสด'
      success('Check Out สำเร็จ', `รับ${label} เรียบร้อย`)
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

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  const activeSessions = sessions
    .filter(s => s.status === 'active')
    .filter(s => !search || s.plate.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="h-screen flex flex-col bg-[#F0F4FF]">

      {/* ─── Header ─── */}
      <header
        className="shrink-0 h-14 bg-white flex items-center justify-between px-6"
        style={{ borderBottom: '1px solid #E8ECF4', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}
      >
        <div className="flex items-center gap-3">
          <img src="/logo/logonext.svg" alt="NexusParking" className="h-7 w-auto object-contain" />
          <div className="w-px h-5 bg-slate-200" />
          <p className="text-xs font-semibold text-slate-400 tracking-wide">OPERATOR</p>
        </div>

        <div className="flex items-center gap-3">
          {stats && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)' }}>
              <span className="size-2 rounded-full animate-pulse inline-block" style={{ background: '#10B981' }} />
              <span className="text-xs font-bold" style={{ color: '#065F46' }}>
                ที่ว่าง {stats.availableSlots}/{stats.totalCapacity}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
            style={{ background: '#F8FAFF', border: '1px solid #E8ECF4' }}>
            <Clock className="size-3.5 text-slate-400" />
            <span className="text-sm font-black text-slate-800 tabular-nums"><LiveClock /></span>
          </div>
          <button
            onClick={handleLogout}
            className="h-8 px-3 rounded-lg text-xs font-bold"
            style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid rgba(239,68,68,0.18)' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2' }}
          >
            ออกจากระบบ
          </button>
        </div>
      </header>

      {/* ─── Shift bar (active only) ─── */}
      {shift ? (
        <div className="shrink-0 flex items-center gap-4 px-6 py-2"
          style={{ background: 'rgba(5,150,105,0.06)', borderBottom: '1px solid rgba(5,150,105,0.15)' }}>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full animate-pulse inline-block" style={{ background: '#10B981' }} />
            <span className="text-xs font-bold text-emerald-700">กะเริ่ม {fmtTime(shift.startTime)}</span>
          </div>
          <div className="w-px h-4 bg-emerald-200" />
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span>รถเข้า <strong className="text-slate-800">{shift.checkinsCount}</strong></span>
            <span>รถออก <strong className="text-slate-800">{shift.checkoutsCount}</strong></span>
          </div>
          <div className="w-px h-4 bg-emerald-200" />
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-1">
              <Banknote className="size-3 text-slate-400" />
              เงินสด <strong className="text-slate-800">฿{shift.cashAmount}</strong>
            </span>
            <span className="flex items-center gap-1">
              <Smartphone className="size-3 text-slate-400" />
              โอน <strong className="text-slate-800">฿{shift.qrAmount}</strong>
            </span>
            <span className="font-bold" style={{ color: '#059669' }}>
              รวม ฿{shift.totalAmount}
            </span>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setShiftEnding(true)}
            className="h-7 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#991B1B', border: '1px solid rgba(239,68,68,0.2)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.14)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
          >
            <Square className="size-2.5 fill-red-700" /> ปิดกะ
          </button>
        </div>
      ) : null}

      {/* ─── Body ─── */}
      <div className="flex-1 flex flex-col gap-4 p-5 min-h-0">

        {/* ── 3 Action buttons ── */}
        <div className="shrink-0 grid grid-cols-3 gap-4" style={{ height: '164px' }}>

          <button
            onClick={() => {
              if (stats && stats.availableSlots === 0) {
                setQPlate(''); setQType('car'); setQueueOpen(true)
              } else {
                resetCI(); setCheckInOpen(true)
              }
            }}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl transition-all active:scale-[0.97] hover:brightness-110 relative overflow-hidden"
            style={stats && stats.availableSlots === 0
              ? { background: 'linear-gradient(145deg, #7C3AED 0%, #A855F7 100%)', boxShadow: '0 6px 28px rgba(124,58,237,0.4)' }
              : { background: 'linear-gradient(145deg, #1E3A8A 0%, #2563EB 100%)', boxShadow: '0 6px 28px rgba(29,78,216,0.38)' }}
          >
            {stats && stats.availableSlots === 0 && (
              <span className="absolute top-2.5 right-2.5 text-[9px] font-black px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>ลานเต็ม</span>
            )}
            <div className="size-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.16)' }}>
              {stats && stats.availableSlots === 0
                ? <ListOrdered className="size-7 text-white" strokeWidth={1.75} />
                : <LogIn className="size-7 text-white" strokeWidth={1.75} />}
            </div>
            <div className="text-center">
              <p className="text-lg font-black text-white tracking-widest">
                {stats && stats.availableSlots === 0 ? 'คิวรอ' : 'CHECK IN'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
                {stats && stats.availableSlots === 0 ? 'เพิ่มรถเข้าคิว' : 'รถเข้าลานจอด'}
              </p>
            </div>
          </button>

          <button
            onClick={() => { resetCO(); setCheckOutOpen(true) }}
            className="flex flex-col items-center justify-center gap-3 rounded-2xl transition-all active:scale-[0.97] hover:brightness-110"
            style={{ background: 'linear-gradient(145deg, #064E3B 0%, #059669 100%)', boxShadow: '0 6px 28px rgba(5,150,105,0.38)' }}
          >
            <div className="size-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.16)' }}>
              <LogOut className="size-7 text-white" strokeWidth={1.75} />
            </div>
            <div className="text-center">
              <p className="text-lg font-black text-white tracking-widest">CHECK OUT</p>
              <p className="text-xs text-emerald-200 mt-0.5">สแกนบัตร</p>
            </div>
          </button>

          <button
            onClick={() => setLostOpen(true)}
            className="flex flex-col items-center justify-center gap-3 rounded-2xl transition-all active:scale-[0.97] hover:brightness-110"
            style={{ background: 'linear-gradient(145deg, #78350F 0%, #D97706 100%)', boxShadow: '0 6px 28px rgba(217,119,6,0.35)' }}
          >
            <div className="size-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.16)' }}>
              <AlertTriangle className="size-7 text-white" strokeWidth={1.75} />
            </div>
            <div className="text-center">
              <p className="text-lg font-black text-white tracking-widest">บัตรหาย</p>
              <p className="text-xs text-amber-200 mt-0.5">ค่าปรับ ฿300</p>
            </div>
          </button>
        </div>

        {/* ── Session list ── */}
        <div className="flex-1 min-h-0 flex flex-col gap-3">

          <div className="shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-slate-700">รถในลาน</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(29,78,216,0.1)', color: '#1D4ED8' }}>
                {sessions.filter(s => s.status === 'active').length} คัน
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="size-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="ค้นหาทะเบียน"
                  className="h-8 pl-7 pr-3 rounded-lg text-xs text-slate-700 outline-none w-36"
                  style={{ background: 'white', border: '1px solid #E2E8F0' }}
                />
              </div>
              <button
                onClick={fetchData}
                className="size-8 rounded-lg flex items-center justify-center"
                style={{ background: 'white', border: '1px solid #E2E8F0' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'white' }}
              >
                <RefreshCw className={`size-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pb-1">
            {loading ? (
              <div className="flex items-center justify-center h-24">
                <RefreshCw className="size-5 text-slate-300 animate-spin" />
              </div>
            ) : activeSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 gap-2">
                <Car className="size-8 text-slate-200" />
                <p className="text-sm text-slate-300 font-medium">
                  {search ? `ไม่พบทะเบียน "${search}"` : 'ไม่มีรถในลาน'}
                </p>
              </div>
            ) : activeSessions.map(s => {
              const m = TYPE_META[s.cardType]
              const Icon = m.icon
              const durationMin = Math.max(1, Math.floor((Date.now() - new Date(s.entryTime).getTime()) / 60000))
              const hours = Math.ceil(durationMin / 60)
              const liveFee = calcFee(s.cardType, hours)
              const entryTime = new Date(s.entryTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

              return (
                <div
                  key={s._id}
                  className="bg-white rounded-2xl overflow-hidden flex items-stretch"
                  style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)', border: '1px solid #E8ECF4' }}
                >
                  <div className="w-1.5 shrink-0" style={{ background: m.color }} />

                  <div className="flex items-center gap-4 flex-1 px-5 py-3.5">
                    <div className="size-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: m.bg }}>
                      <Icon className="size-5" style={{ color: m.color }} strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[26px] font-black text-slate-900 tracking-widest leading-none">{s.plate}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold" style={{ color: m.color }}>{m.label}</span>
                        <span className="text-slate-300 text-xs">|</span>
                        <span className="text-xs text-slate-500">เข้า {entryTime}</span>
                        <span className="text-slate-300 text-xs">·</span>
                        <span className="text-xs font-semibold text-slate-600">{fmtDuration(s.entryTime)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="w-px my-3 shrink-0" style={{ background: '#E8ECF4' }} />

                  <div className="flex flex-col items-center justify-center px-7 shrink-0 gap-0.5">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">ค่าบริการ</p>
                    <p className="text-2xl font-black tabular-nums" style={{ color: m.color }}>฿{liveFee}</p>
                  </div>

                  <div className="w-px my-3 shrink-0" style={{ background: '#E8ECF4' }} />

                  <button
                    onClick={() => openCheckoutFromCard(s)}
                    className="flex items-center justify-center px-8 shrink-0 font-black text-white text-sm tracking-wide transition-all active:scale-[0.97]"
                    style={{ background: 'linear-gradient(160deg, #065F46 0%, #059669 100%)', minWidth: '130px' }}
                    onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)' }}
                    onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
                  >
                    CHECK OUT
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Queue section (appears when lot full or has queue) ── */}
        {(queues.length > 0 || (stats && stats.availableSlots === 0)) && (
          <div className="shrink-0 rounded-2xl overflow-hidden"
            style={{ background: 'white', border: '1px solid rgba(124,58,237,0.22)', boxShadow: '0 2px 16px rgba(124,58,237,0.1)' }}>

            {/* Queue header */}
            <div className="flex items-center gap-2.5 px-4 py-2.5"
              style={{ background: 'linear-gradient(90deg,rgba(91,33,182,0.06),rgba(124,58,237,0.02))', borderBottom: '1px solid rgba(124,58,237,0.12)' }}>
              <ListOrdered className="size-4 shrink-0" style={{ color: '#7C3AED' }} />
              <span className="text-sm font-black text-slate-700">คิวรอ</span>
              {queues.length > 0 && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-white"
                  style={{ background: '#DC2626' }}>{queues.length} คัน</span>
              )}
              {stats && stats.availableSlots === 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(220,38,38,0.08)', color: '#991B1B', border: '1px solid rgba(220,38,38,0.2)' }}>
                  ลานเต็ม {stats.totalCapacity}/{stats.totalCapacity}
                </span>
              )}
              <div className="flex-1" />
              <button
                onClick={() => { setQPlate(''); setQType('car'); setQueueOpen(true) }}
                className="h-7 px-3 rounded-lg flex items-center gap-1.5 text-xs font-black text-white transition-all hover:brightness-110 active:scale-[0.97]"
                style={{ background: 'linear-gradient(135deg,#5B21B6,#7C3AED)', boxShadow: '0 2px 8px rgba(124,58,237,0.3)' }}
              >
                <Plus className="size-3" /> เพิ่มคิว
              </button>
            </div>

            {/* Queue cards — horizontal scroll */}
            {queues.length === 0 ? (
              <div className="flex items-center justify-center py-5 gap-2">
                <ListOrdered className="size-4" style={{ color: 'rgba(124,58,237,0.25)' }} />
                <p className="text-xs text-slate-400">ลานเต็ม — ยังไม่มีรถรอคิว กด "เพิ่มคิว" เพื่อจองคิว</p>
              </div>
            ) : (
              <div className="flex gap-2.5 overflow-x-auto p-3" style={{ scrollbarWidth: 'none' }}>
                {queues.map((q, idx) => (
                  <div key={q._id}
                    className="shrink-0 rounded-xl overflow-hidden flex items-stretch"
                    style={{ width: '200px', border: idx === 0 ? '1.5px solid rgba(124,58,237,0.4)' : '1px solid #E8ECF4', boxShadow: idx === 0 ? '0 2px 10px rgba(124,58,237,0.15)' : '0 1px 4px rgba(0,0,0,0.04)' }}>

                    {/* Q number */}
                    <div className="w-10 shrink-0 flex flex-col items-center justify-center gap-0.5"
                      style={{ background: idx === 0 ? 'linear-gradient(160deg,#7C3AED,#A855F7)' : '#F8FAFF' }}>
                      <span className="text-[8px] font-black" style={{ color: idx === 0 ? 'rgba(255,255,255,0.7)' : '#94A3B8' }}>Q</span>
                      <span className="text-base font-black leading-none" style={{ color: idx === 0 ? 'white' : '#475569' }}>{idx + 1}</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 px-3 py-2.5 min-w-0">
                      <p className="text-base font-black text-slate-900 tracking-widest leading-tight truncate">{q.plate}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {q.cardType === 'car'
                          ? <Car className="size-3 text-slate-400" />
                          : <Bike className="size-3 text-slate-400" />}
                        <span className="text-[10px] text-slate-400">
                          {Math.floor((Date.now() - new Date(q.joinedAt).getTime()) / 60000)} น.
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col shrink-0">
                      <button
                        onClick={() => enterFromQueue(q._id, q.plate)}
                        disabled={!!qLoading}
                        className="flex-1 flex items-center justify-center px-3 transition-all hover:brightness-110 disabled:opacity-40"
                        style={{ background: 'rgba(5,150,105,0.08)', borderBottom: '1px solid #E8ECF4' }}
                        title="เข้าลาน"
                      >
                        {qLoading === q._id
                          ? <RefreshCw className="size-3.5 text-emerald-600 animate-spin" />
                          : <CheckCheck className="size-3.5" style={{ color: '#059669' }} />}
                      </button>
                      <button
                        onClick={() => cancelQueue(q._id, q.plate)}
                        disabled={!!qLoading}
                        className="flex-1 flex items-center justify-center px-3 transition-all hover:brightness-110 disabled:opacity-40"
                        style={{ background: 'rgba(239,68,68,0.05)' }}
                        title="ยกเลิกคิว"
                      >
                        <XCircle className="size-3.5" style={{ color: '#DC2626' }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div> {/* end body */}

      {/* ─── Add Queue Dialog ─── */}
      {queueOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-3xl w-full max-w-xs mx-4 overflow-hidden shadow-2xl">
            <div className="px-6 py-5 flex items-center justify-between"
              style={{ background: 'linear-gradient(135deg,#5B21B6,#7C3AED)' }}>
              <div>
                <p className="text-white font-black">เพิ่มรถเข้าคิว</p>
                <p className="text-violet-200 text-xs mt-0.5">คิวที่ {queues.length + 1}</p>
              </div>
              <button onClick={() => setQueueOpen(false)}
                className="size-8 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.15)' }}>
                <X className="size-4 text-white" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* ประเภท */}
              <div className="grid grid-cols-2 gap-2">
                {(['car', 'motorcycle'] as const).map(t => (
                  <button key={t} onClick={() => setQType(t)}
                    className="flex items-center justify-center gap-2 h-11 rounded-xl font-bold text-sm transition-all"
                    style={qType === t
                      ? { background: 'rgba(124,58,237,0.1)', border: '2px solid #7C3AED', color: '#7C3AED' }
                      : { background: '#F8FAFF', border: '2px solid #E2E8F0', color: '#64748B' }}>
                    {t === 'car' ? <Car className="size-4" /> : <Bike className="size-4" />}
                    {t === 'car' ? 'รถยนต์' : 'มอเตอร์ไซค์'}
                  </button>
                ))}
              </div>

              {/* เลขทะเบียน */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">เลขทะเบียน</label>
                <input
                  autoFocus
                  value={qPlate}
                  onChange={e => setQPlate(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && addToQueue()}
                  placeholder="กก 1234"
                  className="w-full h-12 rounded-xl px-4 text-xl font-black text-slate-800 text-center outline-none tracking-widest"
                  style={{ border: '2px solid #E2E8F0', background: '#FAFBFF', letterSpacing: '0.15em' }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#7C3AED' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0' }}
                />
              </div>

              <div className="flex gap-2">
                <button onClick={() => setQueueOpen(false)}
                  className="flex-1 h-11 rounded-xl text-sm font-bold text-slate-600"
                  style={{ background: '#F1F5F9', border: '1px solid #E2E8F0' }}>
                  ยกเลิก
                </button>
                <button onClick={addToQueue}
                  disabled={qPlate.length < 2}
                  className="flex-1 h-11 rounded-xl text-sm font-black text-white disabled:opacity-40 transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg,#5B21B6,#7C3AED)' }}>
                  เพิ่มคิว
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Force Start Shift Overlay (ปิดไม่ได้) ─── */}
      {shift === null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(15,23,42,0.88)', backdropFilter: 'blur(8px)' }}>
          <div className="bg-white rounded-3xl w-full max-w-sm mx-4 overflow-hidden shadow-2xl">

            {/* Header */}
            <div className="px-8 pt-8 pb-5 text-center">
              <div className="size-20 rounded-3xl mx-auto mb-5 flex items-center justify-center"
                style={{ background: 'linear-gradient(145deg, #1E3A8A 0%, #2563EB 100%)', boxShadow: '0 8px 32px rgba(29,78,216,0.4)' }}>
                <Play className="size-10 text-white fill-white" />
              </div>
              <h2 className="text-2xl font-black text-slate-900">เริ่มกะทำงาน</h2>
              <p className="text-xs text-slate-400 mt-1">กรุณากรอกข้อมูลก่อนเริ่มกะ</p>
            </div>

            {/* Info cards */}
            <div className="px-6 pb-4 flex gap-3">
              <div className="flex-1 rounded-2xl p-3.5 text-center" style={{ background: '#F0F7FF', border: '1px solid rgba(29,78,216,0.12)' }}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">รถในลานขณะนี้</p>
                <p className="text-3xl font-black mt-1" style={{ color: '#1D4ED8' }}>
                  {stats?.activeCars ?? 0}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">คัน (รถค้างจากกะก่อน)</p>
              </div>
            </div>

            {/* Opening float input */}
            <div className="px-6 pb-6 space-y-3">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  เงินต้นกะ (รับจาก till)
                  <span className="text-slate-400 font-normal ml-1">— ไม่บังคับ</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">฿</span>
                  <input
                    type="number" min="0" placeholder="0"
                    value={openingFloat}
                    onChange={e => setOpeningFloat(e.target.value)}
                    className="w-full h-12 rounded-xl pl-8 pr-4 text-lg font-black text-slate-800 outline-none"
                    style={{ border: '2px solid #E2E8F0', background: '#FAFBFF' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#1D4ED8' }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0' }}
                  />
                </div>
              </div>

              <button
                onClick={startShift}
                className="w-full h-14 rounded-2xl text-white font-black text-lg tracking-wide transition-all active:scale-[0.97]"
                style={{ background: 'linear-gradient(145deg, #1E3A8A 0%, #2563EB 100%)', boxShadow: '0 4px 20px rgba(29,78,216,0.45)' }}
              >
                เริ่มกะ
              </button>
              <button
                onClick={handleLogout}
                className="w-full h-10 rounded-xl text-sm font-bold"
                style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── End Shift Modal ─── */}
      {shiftEnding && shift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
          <div className="bg-white rounded-3xl w-full max-w-sm mx-4 overflow-hidden shadow-2xl">

            {/* Header */}
            <div className="px-6 py-5 flex items-center justify-between"
              style={{ background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)' }}>
              <div>
                <p className="text-white font-black text-lg">ปิดกะทำงาน</p>
                <p className="text-slate-400 text-xs mt-0.5">กะเริ่ม {fmtTime(shift.startTime)}</p>
              </div>
              <button onClick={() => { setShiftEnding(false); setClosingFloat('') }}
                className="size-8 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.1)' }}>
                <X className="size-4 text-white" />
              </button>
            </div>

            {/* Stats */}
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'รถเข้ากะนี้',   value: shift.checkinsCount,  color: '#1D4ED8', icon: LogIn },
                  { label: 'รถออกกะนี้',    value: shift.checkoutsCount, color: '#059669', icon: LogOut },
                  { label: 'รถค้างในลาน',   value: stats?.activeCars ?? 0, color: '#D97706', icon: Car },
                ].map(({ label, value, color, icon: Icon }) => (
                  <div key={label} className="rounded-2xl px-3 py-3.5 text-center"
                    style={{ background: '#F8FAFF', border: '1px solid #E8ECF4' }}>
                    <Icon className="size-4 mx-auto mb-1" style={{ color }} />
                    <p className="text-[9px] text-slate-400 font-semibold leading-tight">{label}</p>
                    <p className="text-xl font-black mt-1" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Closing float input */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  เงินส่ง till
                  <span className="text-slate-400 font-normal ml-1">— จำนวนที่จะส่งคืน</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">฿</span>
                  <input
                    type="number" min="0" placeholder="0"
                    value={closingFloat}
                    onChange={e => setClosingFloat(e.target.value)}
                    className="w-full h-12 rounded-xl pl-8 pr-4 text-lg font-black text-slate-800 outline-none"
                    style={{ border: '2px solid #E2E8F0', background: '#FAFBFF' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#DC2626' }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0' }}
                  />
                </div>
              </div>

              <p className="text-[10px] text-slate-400 text-center">
                ยอดรายได้ทั้งหมดจะแสดงในรายงาน Admin เท่านั้น
              </p>
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => { setShiftEnding(false); setClosingFloat('') }}
                className="flex-1 h-11 rounded-xl text-sm font-bold text-slate-600"
                style={{ background: '#F1F5F9', border: '1px solid #E2E8F0' }}>
                ยังไม่ปิด
              </button>
              <button onClick={endShift}
                className="flex-1 h-11 rounded-xl text-sm font-black text-white transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #991B1B 0%, #DC2626 100%)', boxShadow: '0 2px 12px rgba(220,38,38,0.35)' }}>
                ยืนยันปิดกะ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Dialogs ─── */}
      <CheckInDialog
        open={checkInOpen}
        onOpenChange={o => { setCheckInOpen(o); if (!o) resetCI() }}
        step={ciStep} cardType={ciType} plate={ciPlate}
        customEntryTime={ciCustomTime}
        onCustomEntryTimeChange={setCiCustomTime}
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
    </div>
  )
}
