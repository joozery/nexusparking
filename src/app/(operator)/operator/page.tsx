'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

import {
  LogIn, LogOut,
  Car, Bike, RefreshCw, Clock,
  Play, X,
  XCircle, Nfc, Scan,
} from 'lucide-react'
import { CheckInDialog } from '@/components/parking/CheckInDialog'
import { CheckOutDialog, type PaymentMethod } from '@/components/parking/CheckOutDialog'
import { LostCardDialog } from '@/components/parking/LostCardDialog'
import { CardRegisterDialog } from '@/components/parking/CardRegisterDialog'
import { CctvStrip } from '@/components/parking/CctvStrip'
import { FleetStatusBar, type FleetStats } from '@/components/parking/FleetStatusBar'
import { CarsInLotDialog } from '@/components/parking/CarsInLotDialog'
import { type CardType } from '@/components/parking/types'
import { calcFeeFromMinutes, type OvernightConfig, type AfterHoursConfig } from '@/lib/calcFee'
import { useToast } from '@/components/ui/Toast'
import { triggerBarrierClient } from '@/lib/barrierClient'
import { convertThaiToEn, toAsciiNumber, toAsciiPlate, sanitizeUid } from '@/lib/thaiInput'
import {
  isSerialSupported, connectSerialReader, getReaderBaud, setReaderBaud,
  COMMON_BAUD_RATES, type SerialReaderHandle,
} from '@/lib/serialReader'

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

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

export default function OperatorPage() {
  const { success, error: toastError, warning } = useToast()

  const [overnightCfg,   setOvernightCfg]   = useState<OvernightConfig | undefined>(undefined)
  const [afterHoursCfg,  setAfterHoursCfg]  = useState<AfterHoursConfig | undefined>(undefined)
  const [monthlyDeposit, setMonthlyDeposit] = useState(500)
  const [monthlyFee,     setMonthlyFee]     = useState(300)
  const [lostCardFine,   setLostCardFine]   = useState(300)
  const [sessions, setSessions] = useState<Session[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [fleetStats, setFleetStats] = useState<FleetStats | null>(null)
  const [shift, setShift] = useState<Shift | null | undefined>(undefined) // undefined = loading
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [shiftEnding, setShiftEnding] = useState(false)
  const [openingFloat, setOpeningFloat] = useState('')
  const [closingFloat, setClosingFloat] = useState('')
  const [nowTick, setNowTick] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  // Queue
  const [queues,      setQueues]      = useState<QueueEntry[]>([])
  const [qLoading,    setQLoading]    = useState<string | null>(null)

  // Check In
  const [checkInOpen,   setCheckInOpen]   = useState(false)
  const [ciStep,        setCiStep]        = useState<'scan' | 'confirm'>('scan')
  const [ciType,        setCiType]        = useState<CardType>('car')
  const [ciPlate,       setCiPlate]       = useState('')
  const [ciUid,         setCiUid]         = useState('')
  const [ciCustomTime,  setCiCustomTime]  = useState('')

  // Check Out
  const [checkOutOpen,  setCheckOutOpen]  = useState(false)
  const [coStep,        setCoStep]        = useState<'scan' | 'payment' | 'done'>('scan')
  const [coPaidAmount,  setCoPaidAmount]  = useState(0)
  const [coPrinting,    setCoPrinting]    = useState(false)
  const [coType,        setCoType]        = useState<CardType>('car')
  const [coHours,       setCoHours]       = useState(1)
  const [coFee,         setCoFee]         = useState(0)
  const [coSessionId,   setCoSessionId]   = useState('')
  const [coCustomTime,  setCoCustomTime]  = useState('')
  const [coEntryTime,   setCoEntryTime]   = useState<Date | null>(null)
  const [coAssumeLostCard, setCoAssumeLostCard] = useState(false)

  // Sidebar quick plate lookup (checkin/checkout auto-route by typed plate)
  const [plateQuick, setPlateQuick] = useState('')
  const [isExitView, setIsExitView] = useState(false) // mirrors CctvStrip's F12 entry/exit toggle

  // Lost card
  const [lostOpen,  setLostOpen]  = useState(false)
  const [lostPlate, setLostPlate] = useState('')

  const [carsListOpen, setCarsListOpen] = useState(false)

  const [regOpen, setRegOpen] = useState(false)
  const [regUid,  setRegUid]  = useState('')
  const onCardScanRef = useRef<(uid: string) => void>(() => {})
  const scanInputRef = useRef<HTMLInputElement>(null)
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [scanBuf, setScanBuf] = useState('')

  // Serial (COM port) reader — fallback path for readers that aren't HID keyboard-wedge
  const serialHandleRef = useRef<SerialReaderHandle | null>(null)
  const [serialSupported, setSerialSupported] = useState(false) // starts false to match SSR; set after mount
  const [serialConnected, setSerialConnected] = useState(false)
  const [serialConnecting, setSerialConnecting] = useState(false)
  const [serialBaud, setSerialBaudState] = useState(9600)

  function resetCI() { setCiStep('scan'); setCiPlate(''); setCiType('car'); setCiUid(''); setCiCustomTime('') }
  function resetCO() { setCoStep('scan'); setCoSessionId(''); setCoCustomTime(''); setCoEntryTime(null); setCoPaidAmount(0); setCoAssumeLostCard(false) }

  const fetchShift = useCallback(async () => {
    const res = await fetch('/api/shifts/current')
    setShift(res.ok ? await res.json() : null)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const [sRes, stRes, qRes, fRes] = await Promise.all([
        fetch('/api/sessions?status=active&limit=50'),
        fetch('/api/stats'),
        fetch('/api/queue'),
        fetch('/api/stats/fleet'),
      ])
      const safeJson = async (r: Response, fallback: unknown) => {
        if (!r.ok) return fallback
        try { return await r.json() } catch { return fallback }
      }
      const [sData, stData, qData, fData] = await Promise.all([
        safeJson(sRes, {}),
        safeJson(stRes, null),
        safeJson(qRes, []),
        safeJson(fRes, null),
      ])
      setSessions((sData as { sessions?: Session[] }).sessions ?? [])
      setStats(stData as Stats | null)
      setQueues(Array.isArray(qData) ? qData as QueueEntry[] : [])
      setFleetStats(fData as FleetStats | null)
    } catch (e) {
      console.error('[fetchData]', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSettings = useCallback(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(s => {
        if (s?.rates?.overnight) setOvernightCfg(s.rates.overnight)
        if (s?.businessHours) {
          setAfterHoursCfg({
            start: s.businessHours.close ?? '22:00',
            end:   s.businessHours.open  ?? '06:30',
            fine:  s.afterHoursFine      ?? 300,
          })
        }
        if (s?.monthlyDeposit !== undefined) setMonthlyDeposit(s.monthlyDeposit)
        if (s?.monthlyFee     !== undefined) setMonthlyFee(s.monthlyFee)
        if (s?.lostCardFine   !== undefined) setLostCardFine(s.lostCardFine)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchShift()
    fetchData()
    fetchSettings()
  }, [fetchShift, fetchData, fetchSettings])

  useEffect(() => {
    const t = setInterval(() => { fetchData(); fetchSettings() }, 15000)
    return () => clearInterval(t)
  }, [fetchData, fetchSettings])

  // ── Scan input focus management ─────────────────────────────────────────
  const noDialogOpen = !checkInOpen && !checkOutOpen && !lostOpen && !shiftEnding && !regOpen && shift !== null
  useEffect(() => {
    if (noDialogOpen) {
      setTimeout(() => scanInputRef.current?.focus(), 50)
    }
  }, [noDialogOpen])

  // ── Serial card reader — silently reuse a previously-granted COM port on load ──
  useEffect(() => {
    if (!isSerialSupported()) return
    setSerialSupported(true)
    setSerialBaudState(getReaderBaud())
    let cancelled = false
    connectSerialReader(uid => onCardScanRef.current(uid), () => setSerialConnected(false), false)
      .then(handle => {
        if (cancelled) { handle?.disconnect(); return }
        if (handle) { serialHandleRef.current = handle; setSerialConnected(true) }
      })
      .catch(() => {})
    return () => {
      cancelled = true
      serialHandleRef.current?.disconnect()
      serialHandleRef.current = null
    }
  }, [])

  async function handleConnectSerialReader() {
    setSerialConnecting(true)
    try {
      setReaderBaud(serialBaud)
      const handle = await connectSerialReader(uid => onCardScanRef.current(uid), () => setSerialConnected(false), true)
      if (handle) {
        serialHandleRef.current = handle
        setSerialConnected(true)
        success('เชื่อมต่อเครื่องอ่านบัตร (Serial) สำเร็จ')
      }
    } catch (e) {
      toastError('เชื่อมต่อเครื่องอ่านไม่สำเร็จ', e instanceof Error ? e.message : 'กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSerialConnecting(false)
    }
  }

  async function handleDisconnectSerialReader() {
    await serialHandleRef.current?.disconnect()
    serialHandleRef.current = null
    setSerialConnected(false)
  }

  // ยกเลิกรอคิว + เก็บเงินเลย — รถที่รอในคิวไม่อยากรอแล้ว แต่ยังต้องจ่ายค่าเวลาที่รอไปแล้ว (นับจาก joinedAt)
  // ทำโดยโปรโมทเข้า session ปกติก่อน (entryTime = joinedAt) แล้วเปิด popup checkout ทันที
  async function checkoutFromQueue(q: QueueEntry) {
    setQLoading(q._id)
    const res = await fetch(`/api/queue/${q._id}/enter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    setQLoading(null)
    if (res.ok) {
      const data = await res.json()
      await fetchData()
      openCheckoutFromCard(data.session)
    } else {
      const err = await res.json()
      toastError('ไม่สำเร็จ', err.error)
    }
  }

  // Auto-promote the first waiting queue entry into an active session as soon as a slot frees up
  // (called right after a checkout — fetches fresh stats/queue instead of relying on possibly-stale state)
  async function autoPromoteQueue() {
    try {
      const [stRes, qRes] = await Promise.all([fetch('/api/stats'), fetch('/api/queue')])
      if (!stRes.ok || !qRes.ok) return
      const st = await stRes.json() as Stats | null
      const qs = await qRes.json() as QueueEntry[]
      const next = Array.isArray(qs) ? qs[0] : undefined
      if (!st || st.availableSlots <= 0 || !next) return
      const res = await fetch(`/api/queue/${next._id}/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        await Promise.all([fetchData(), fetchShift()])
        success('เข้าลานอัตโนมัติ', `มีที่ว่าง — ทะเบียน ${next.plate} จากคิวเข้าลานแล้ว`)
      }
    } catch (e) {
      console.error('[autoPromoteQueue]', e)
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
      void triggerBarrierClient('checkin')
      await Promise.all([fetchData(), fetchShift()])
      success('ขาเข้าสำเร็จ', `ทะเบียน ${ciPlate} เข้าลานเรียบร้อย`)
      return
    }

    const err = await res.json()

    // Lot full → same popup, but fall back to the queue instead of failing outright
    if (res.status === 409 && err.error === 'ลานจอดเต็มแล้ว กรุณาใช้ระบบคิวรอ') {
      if (ciType === 'overnight') {
        toastError('เข้าคิวไม่ได้', 'ลานเต็ม และบัตรค้างคืนไม่รองรับระบบคิวรอ')
        return
      }
      const qRes = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plate: ciPlate, cardType: ciType, cardUid: ciUid || undefined }),
      })
      if (qRes.ok) {
        setCheckInOpen(false); resetCI()
        await fetchData()
        success('ลานเต็ม — เข้าคิวรอแล้ว', `ทะเบียน ${ciPlate} อยู่ในคิวรอ`)
      } else {
        const qErr = await qRes.json()
        toastError('เข้าคิวไม่สำเร็จ', qErr.error ?? 'เกิดข้อผิดพลาด')
      }
      return
    }

    toastError('ขาเข้าไม่สำเร็จ', err.error ?? 'เกิดข้อผิดพลาด')
  }

  function handleCoCustomTimeChange(v: string) {
    setCoCustomTime(v)
    if (!v || !coEntryTime) {
      setCoHours(0); setCoFee(0); return
    }
    const exit = new Date(v)
    const durationMin = Math.max(1, Math.floor((exit.getTime() - coEntryTime.getTime()) / 60000))
    const hours = Math.ceil(durationMin / 60)
    setCoHours(hours)
    setCoFee(calcFeeFromMinutes(coType, durationMin, coEntryTime, exit, overnightCfg, afterHoursCfg))
  }

  // Check Out (scan dialog)
  async function simulateCOScan() {
    const active = sessions.find(s => s.status === 'active')
    if (!active) {
      toastError('ไม่มีรถในลาน', 'ยังไม่มีรถที่ Check-in เข้ามา')
      return
    }
    const entry = new Date(active.entryTime)
    setCoType(active.cardType)
    setCoSessionId(active._id)
    setCoEntryTime(entry)
    setCoCustomTime('')
    setCoHours(0)
    setCoFee(0)
    setCoStep('payment')
  }

  // assumeLostCard: true when checkout was triggered without an actual card tap
  // (e.g. typed straight into the sidebar) — pre-ticks the "บัตรหาย" checkbox in the popup
  function openCheckoutFromCard(s: Session, assumeLostCard = false) {
    fetchSettings()
    const entry = new Date(s.entryTime)
    const now = new Date()
    const durationMin = Math.max(1, Math.floor((now.getTime() - entry.getTime()) / 60000))
    const hours = Math.ceil(durationMin / 60)
    setCoType(s.cardType)
    setCoHours(hours)
    setCoFee(calcFeeFromMinutes(s.cardType, durationMin, entry, now, overnightCfg, afterHoursCfg))
    setCoSessionId(s._id); setCoEntryTime(entry); setCoStep('payment'); setCheckOutOpen(true)
    setCoAssumeLostCard(assumeLostCard)
  }

  // Sidebar plate input → auto-route:
  //  - active session with this plate           → checkout
  //  - no session, but exit camera view is on    → lost card (car is at the exit gate with no record)
  //  - no session, otherwise                     → checkin (handleCheckin falls back to queue itself if the lot is full)
  function handlePlateQuickSubmit() {
    const plate = toAsciiPlate(convertThaiToEn(plateQuick))
    if (plate.length !== 4) return
    const activeSession = sessions.find(s => s.status === 'active' && s.plate === plate)
    if (activeSession) {
      openCheckoutFromCard(activeSession, true) // typed manually, no card tap → assume lost card
    } else if (isExitView) {
      setLostPlate(plate)
      setLostOpen(true)
    } else {
      resetCI()
      setCiPlate(plate)
      setCiStep('confirm') // skip the card-tap screen — plate is already known, show it right away
      setCheckInOpen(true)
    }
    setPlateQuick('')
  }

  async function handleCheckout(paymentMethod: PaymentMethod, discountId?: string, dailyDiscountId?: string, isLostCard?: boolean) {
    const body: Record<string, unknown> = { sessionId: coSessionId || undefined, paymentMethod, discountId, dailyDiscountId, lostCard: isLostCard }
    if (coCustomTime) body.exitTime = new Date(coCustomTime).toISOString()
    const res = await fetch('/api/sessions/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const data = await res.json()
      setCoPaidAmount(data.totalFee ?? coFee)
      setCoStep('done')
      void triggerBarrierClient('checkout')
      await Promise.all([fetchData(), fetchShift()])
      const label = paymentMethod === 'qr' ? 'โอนเงิน' : 'เงินสด'
      success('ขาออกสำเร็จ', `รับ${label} เรียบร้อย`)
      void autoPromoteQueue()
    } else {
      const err = await res.json()
      toastError('ขาออกไม่สำเร็จ', err.error ?? 'เกิดข้อผิดพลาด')
    }
  }

  async function handlePrintReceipt() {
    if (!coSessionId) return
    setCoPrinting(true)
    try {
      const res = await fetch(`/api/sessions/${coSessionId}/print`, { method: 'POST' })
      const data = await res.json()
      data.success ? success('พิมพ์ใบเสร็จแล้ว') : toastError('พิมพ์ไม่สำเร็จ', 'เช็คเครื่องพิมพ์')
    } finally {
      setCoPrinting(false)
    }
  }

  function finishCheckout() {
    setCheckOutOpen(false); resetCO()
  }

  // ── Card-reader auto-route: checkin or checkout based on active sessions ──
  // Updated every render via ref so the keydown useEffect (deps=[]) is never stale
  useEffect(() => {
    onCardScanRef.current = async (uid: string) => {
      // Ignore scan when any dialog is already open — prevents resetting in-progress forms
      if (checkInOpen || checkOutOpen || lostOpen || shiftEnding || regOpen) return

      // Cards/sessions registered before Thai→ASCII conversion have Thai chars stored as UID.
      // Match by the converted uid OR by converting the stored uid (backward-compat).
      const matchUid = (stored: string) => stored === uid || convertThaiToEn(stored) === uid

      const activeSession = sessions.find(s => s.status === 'active' && matchUid(s.cardUid))
      if (activeSession) {
        // Card already inside → checkout
        openCheckoutFromCard(activeSession)
      } else {
        // Card not inside → checkin: resolve card type + plate from registration
        try {
          const res = await fetch('/api/cards')
          if (res.ok) {
            const cards: Array<{ uid: string; type: CardType; plate: string }> = await res.json()
            const found = cards.find(c => matchUid(c.uid))
            if (found) {
              setCiType(found.type)
              if (found.plate) setCiPlate(found.plate)
              setCiUid(uid)
              setCiStep('confirm')
              setCheckInOpen(true)
              return
            }
          }
        } catch { /* ignore */ }
        // ไม่พบบัตรในระบบ → เปิดฟอร์มลงทะเบียน
        setRegUid(uid)
        setRegOpen(true)
      }
    }
  })

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ป้องกันการทำงานซ้อนถ้ามี modal เปิดอยู่แล้ว (ยกเว้น carsListOpen เอง — F2 ต้องสลับปิดได้)
      if (checkInOpen || checkOutOpen || lostOpen || shiftEnding || regOpen) return

      if (e.key === 'F2') {
        e.preventDefault()
        setCarsListOpen(o => !o)
      }

      if (e.key === 'F7' && shift) {
        e.preventDefault()
        setShiftEnding(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [checkInOpen, checkOutOpen, lostOpen, shiftEnding, regOpen, shift])

  return (
    <div className="h-screen flex flex-col bg-[#F0F4FF]">
      {/* Hidden input — always focused when no dialog is open, captures card-reader keystrokes */}
      <input
        ref={scanInputRef}
        value={scanBuf}
        onChange={e => {
          const val = e.target.value
          setScanBuf(val)
          if (scanTimerRef.current) clearTimeout(scanTimerRef.current)
          scanTimerRef.current = setTimeout(() => {
            const uid = sanitizeUid(convertThaiToEn(val))
            setScanBuf('')
            if (uid.length >= 4) onCardScanRef.current(uid)
          }, 300)
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            if (scanTimerRef.current) clearTimeout(scanTimerRef.current)
            const uid = sanitizeUid(convertThaiToEn(scanBuf))
            setScanBuf('')
            if (uid.length >= 4) onCardScanRef.current(uid)
          }
        }}
        onBlur={e => {
          // Don't steal focus from a real input the operator clicked (e.g. search box)
          const target = e.relatedTarget as HTMLElement | null
          if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return
          if (!checkInOpen && !checkOutOpen && !lostOpen && !shiftEnding && shift !== null) {
            setTimeout(() => scanInputRef.current?.focus(), 50)
          }
        }}
        style={{ position: 'fixed', opacity: 0, pointerEvents: 'none', width: 1, height: 1, top: 0, left: 0, zIndex: -1 }}
        readOnly={false}
        aria-hidden="true"
        tabIndex={-1}
      />

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
          {serialSupported && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
              style={{ background: serialConnected ? 'rgba(16,185,129,0.08)' : '#F8FAFF', border: `1px solid ${serialConnected ? 'rgba(16,185,129,0.2)' : '#E8ECF4'}` }}>
              <Nfc className="size-3.5" style={{ color: serialConnected ? '#059669' : '#94A3B8' }} />
              {!serialConnected && (
                <select
                  value={serialBaud}
                  onChange={e => setSerialBaudState(Number(e.target.value))}
                  className="text-[10px] font-bold text-slate-500 bg-transparent outline-none"
                  title="Baud rate ของเครื่องอ่านบัตร (Serial)"
                >
                  {COMMON_BAUD_RATES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              )}
              <button
                onClick={serialConnected ? handleDisconnectSerialReader : handleConnectSerialReader}
                disabled={serialConnecting}
                className="text-[10px] font-bold disabled:opacity-50"
                style={{ color: serialConnected ? '#059669' : '#6366F1' }}
                title="เครื่องอ่านบัตรแบบ Serial (COM port) — ใช้เมื่อเครื่องอ่านไม่ใช่ USB-HID keyboard-wedge"
              >
                {serialConnecting ? '...' : serialConnected ? 'Reader: OK' : 'เชื่อมต่อ Reader'}
              </button>
            </div>
          )}
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

      {/* ─── Body ─── */}
      <div className="flex-1 min-h-0 p-3 flex gap-3">

        {/* ── Camera strip + fleet status bar — main area, fills all available space ── */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-2">
          <div className="flex-1 min-h-0 flex flex-col rounded-2xl overflow-hidden">
            <CctvStrip isExit={isExitView} onToggleExit={() => setIsExitView(v => !v)} />
          </div>
          <FleetStatusBar stats={fleetStats} />
        </div>

        {/* ── Right sidebar: check-in / check-out / queue ── */}
        <div className="w-75 shrink-0 flex flex-col gap-2 min-h-0">

          {/* Quick plate lookup — auto-route: active session found = checkout,
              no session + exit camera view = lost card, no session + lot full = queue, else = checkin */}
          <div className="shrink-0 flex flex-col gap-1.5 p-3 rounded-xl"
            style={{ background: 'white', border: '1px solid #E8ECF4', boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
            <label className="text-[10px] font-bold text-slate-400 px-0.5">เลขทะเบียน (4 หลัก) — Enter เพื่อยืนยัน</label>
            <form
              onSubmit={e => { e.preventDefault(); handlePlateQuickSubmit() }}
              className="flex items-center gap-2"
            >
              <input
                value={plateQuick}
                onChange={e => setPlateQuick(toAsciiPlate(convertThaiToEn(e.target.value)).slice(0, 4))}
                inputMode="numeric"
                enterKeyHint="done"
                placeholder="0000"
                className="flex-1 min-w-0 h-11 rounded-lg text-center text-xl font-black tracking-[0.2em] text-slate-800 outline-none"
                style={{ background: '#F8FAFF', border: '1px solid #E2E8F0' }}
              />
              <button
                type="submit"
                disabled={plateQuick.length !== 4}
                className="shrink-0 h-11 px-4 rounded-lg text-sm font-black text-white transition-all active:scale-[0.97] hover:brightness-110 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#1E3A8A,#2563EB)', boxShadow: '0 4px 16px rgba(29,78,216,0.38)' }}
              >
                ยืนยัน
              </button>
            </form>
            {isExitView ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full self-start"
                style={{ background: 'rgba(217,119,6,0.1)', color: '#92400E' }}>
                กล้องขาออก — ไม่พบทะเบียนจะถือว่าบัตรหาย
              </span>
            ) : stats && stats.availableSlots === 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full self-start"
                style={{ background: 'rgba(124,58,237,0.08)', color: '#7C3AED' }}>
                ลานเต็ม — ทะเบียนใหม่จะเข้าคิวรอแทน
              </span>
            )}
          </div>

          {/* ── Cars-in-lot trigger — full table lives in the F2 popup (CarsInLotDialog) ── */}
          <button
            onClick={() => setCarsListOpen(true)}
            className="shrink-0 flex items-center gap-2 px-4 rounded-xl transition-colors"
            style={{ height: '38px', background: 'white', border: '1px solid #E8ECF4', boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFF' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white' }}
          >
            <Car className="size-3.5 text-slate-400 shrink-0" />
            <span className="text-xs font-black text-slate-700">รถในลาน</span>
            <span className="text-[10px] font-bold px-1.5 py-px rounded-full"
              style={{ background: 'rgba(29,78,216,0.1)', color: '#1D4ED8' }}>
              {activeSessions.length} คัน
            </span>
            {stats && <span className="text-[10px] text-slate-400">/ {stats.totalCapacity} ที่จอด</span>}
            <div className="flex-1" />
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-slate-400" style={{ border: '1px solid #E2E8F0' }}>F2</span>
          </button>

          <CarsInLotDialog
            open={carsListOpen}
            onOpenChange={setCarsListOpen}
            sessions={activeSessions}
            stats={stats}
            loading={loading}
            search={search}
            onSearchChange={setSearch}
            onRefresh={fetchData}
            onCheckout={s => { setCarsListOpen(false); openCheckoutFromCard(s) }}
          />

          {/* ── Queue panel — vertical list, fills remaining sidebar height ── */}
          <div className="flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden"
            style={{ background: 'white', border: '1px solid rgba(124,58,237,0.2)', boxShadow: '0 1px 8px rgba(124,58,237,0.08)' }}>

            <div className="flex-1 min-h-0 flex">
              {([
                { type: 'car' as const, label: 'รถยนต์', icon: Car, list: queues.filter(q => q.cardType === 'car') },
                { type: 'motorcycle' as const, label: 'รถจักรยานยนต์', icon: Bike, list: queues.filter(q => q.cardType === 'motorcycle') },
              ]).map((col, colIdx) => (
                <div key={col.type}
                  className="flex-1 min-w-0 flex flex-col"
                  style={colIdx === 0 ? { borderRight: '1px solid #F1F5F9' } : undefined}>
                  <div className="shrink-0 flex items-center gap-1 px-2 py-1" style={{ background: '#FAFBFF', borderBottom: '1px solid #F1F5F9' }}>
                    <col.icon className="size-3 shrink-0" style={{ color: '#7C3AED' }} />
                    <span className="text-[9px] font-black text-slate-500 truncate">{col.label}</span>
                    <span className="text-[9px] font-bold text-slate-400 shrink-0">{col.list.length}</span>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto p-1.5 flex flex-col gap-1">
                    {col.list.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center">
                        <span className="text-[10px] text-slate-400">ไม่มี</span>
                      </div>
                    ) : col.list.map((q, idx) => (
                      <div key={q._id}
                        className="shrink-0 flex flex-col gap-0.5 px-1.5 py-1 rounded-lg"
                        style={{
                          background: idx === 0 ? 'rgba(124,58,237,0.08)' : '#F8FAFF',
                          border: idx === 0 ? '1px solid rgba(124,58,237,0.3)' : '1px solid #E8ECF4',
                        }}>
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] font-black shrink-0" style={{ color: '#7C3AED' }}>{idx + 1}</span>
                          <span className="text-[11px] font-black text-slate-800 tracking-wider truncate">{q.plate}</span>
                          <div className="flex-1" />
                          <button
                            onClick={() => checkoutFromQueue(q)}
                            disabled={!!qLoading}
                            className="flex items-center justify-center size-4 rounded transition-all disabled:opacity-40 shrink-0"
                            style={{ background: 'rgba(29,78,216,0.1)' }}
                            title="ไม่รอแล้ว — เช็คเอาต์เลย"
                          >
                            {qLoading === q._id
                              ? <RefreshCw className="size-2.5 text-blue-600 animate-spin" />
                              : <LogOut className="size-2.5" style={{ color: '#1D4ED8' }} />}
                          </button>
                        </div>
                        <span className="text-[8px] text-slate-400">{Math.floor((nowTick - new Date(q.joinedAt).getTime()) / 60000)}น.</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div> {/* end body */}

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
                    type="text" inputMode="numeric" placeholder="0"
                    value={openingFloat}
                    onChange={e => setOpeningFloat(toAsciiNumber(e.target.value))}
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
                    type="text" inputMode="numeric" placeholder="0"
                    value={closingFloat}
                    onChange={e => setClosingFloat(toAsciiNumber(e.target.value))}
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
        paidAmount={coPaidAmount}
        printing={coPrinting}
        lostCardFine={lostCardFine}
        defaultLostCard={coAssumeLostCard}
        entryTime={coEntryTime}
        overnightCfg={overnightCfg}
        afterHoursCfg={afterHoursCfg}
        onSimulateScan={simulateCOScan}
        onBack={() => setCoStep('scan')}
        onConfirm={handleCheckout}
        onPrintReceipt={handlePrintReceipt}
        onDone={finishCheckout}
      />
      <LostCardDialog
        open={lostOpen}
        onOpenChange={setLostOpen}
        onConfirm={handleLostCard}
        defaultPlate={lostPlate}
      />
      <CardRegisterDialog
        open={regOpen}
        onOpenChange={setRegOpen}
        uid={regUid}
        monthlyDeposit={monthlyDeposit}
        monthlyFee={monthlyFee}
        onRegistered={card => {
          success('ลงทะเบียนสำเร็จ', `UID: ${card.uid}`)
          setCiUid(card.uid)
          setCiType(card.type)
          setCiPlate(card.plate)
          setCiStep('confirm')
          setCheckInOpen(true)
        }}
      />

    </div>
  )
}
