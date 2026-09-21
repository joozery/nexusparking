'use client'
import { ShiftVehicleSummary } from '@/components/parking/ShiftVehicleSummary'
import type { VehicleCounts } from '@/lib/shiftVehicleCounts'

import { useState, useEffect, useCallback, useRef } from 'react'

import {
  LogIn, LogOut,
  Car, Bike, RefreshCw, Clock,
  Play, X,
  XCircle, Nfc, Scan,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody } from '@/components/ui/dialog'
import { CheckInDialog } from '@/components/parking/CheckInDialog'
import { ShiftReportDialog } from '@/components/parking/ShiftReportDialog'
import { ClosedShiftDialog, type ClosedShift } from '@/components/parking/ClosedShiftDialog'
import { CheckOutDialog, type PaymentMethod } from '@/components/parking/CheckOutDialog'
import { LostCardDialog } from '@/components/parking/LostCardDialog'
import { CctvStrip } from '@/components/parking/CctvStrip'
import { FleetStatusBar, type FleetStats } from '@/components/parking/FleetStatusBar'
import { CarsInLotDialog } from '@/components/parking/CarsInLotDialog'
import { type CardType } from '@/components/parking/types'
import { calcFeeFromMinutes, type OvernightConfig } from '@/lib/calcFee'
import { useToast } from '@/components/ui/Toast'
import { triggerBarrierClient } from '@/lib/barrierClient'
import { createHidScan, hidKey } from '@/lib/hidScan'
import { convertThaiToEn, normalizeUid, toAsciiNumber, toAsciiPlate } from '@/lib/thaiInput'
import {
  isSerialSupported, connectSerialReader, getReaderBaud, setReaderBaud,
  COMMON_BAUD_RATES, type SerialReaderHandle,
} from '@/lib/serialReader'

interface Session {
  queueId?: string
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

interface LotStats {
  active:    number
  capacity:  number
  available: number
}

interface Stats {
  activeCars: number
  availableSlots: number
  totalCapacity: number
  car: LotStats
  motorcycle: LotStats
}

interface QueueEntry {
  _id: string
  cardUid?: string
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
  checkinsByType?: VehicleCounts
  checkoutsByType?: VehicleCounts
  checkinsCount: number
  checkoutsCount: number
  cashAmount: number
  qrAmount: number
  totalAmount: number
}

function EntryPhoto({ sessionId, face = false, exit = false }: { sessionId: string; face?: boolean; exit?: boolean }) {
  const [sourceIndex, setSourceIndex] = useState(0)
  const sources = exit ? ['exit'] : face ? ['cam-face'] : ['cam-plate', 'entry', 'cam-rear']
  const label = exit ? 'ภาพรถตอนออก' : face ? 'ภาพผู้ขับตอนเข้า' : 'ภาพรถตอนเข้า'
  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      {sourceIndex < sources.length ? (
        <img
          src={`/api/sessions/${sessionId}/photo?type=${sources[sourceIndex]}`}
          alt={label}
          className="h-40 w-full rounded-lg bg-slate-100 object-contain"
          onError={() => setSourceIndex(i => i + 1)}
        />
      ) : (
        <span className="flex h-40 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-500">
          ไม่มีภาพที่บันทึกไว้ หรือโหลดภาพไม่ได้
        </span>
      )}
    </span>
  )
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

const DENOMINATIONS = [1000, 500, 100, 50, 20, 10, 5, 2, 1] as const
type DenomCounts = Partial<Record<typeof DENOMINATIONS[number], string>>

function denomTotal(counts: DenomCounts): number {
  return DENOMINATIONS.reduce((sum, d) => sum + d * (Number(counts[d]) || 0), 0)
}

// จำนวนแบงก์/เหรียญที่นับได้จริง (ตัด denomination ที่ไม่ได้กรอก/เป็น 0 ทิ้ง) — ไว้ส่งเก็บเป็นประวัติ
function denomBreakdown(counts: DenomCounts): Record<string, number> {
  const out: Record<string, number> = {}
  for (const d of DENOMINATIONS) {
    const n = Number(counts[d]) || 0
    if (n > 0) out[d] = n
  }
  return out
}

function DenomCounter({ counts, onChange, accent }: {
  counts: DenomCounts
  onChange: (counts: DenomCounts) => void
  accent: string
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5">
        {DENOMINATIONS.map(d => (
          <div key={d} className="flex flex-col items-center gap-1 rounded-lg px-1.5 py-1.5"
            style={{ background: '#FAFBFF', border: '1px solid #E2E8F0' }}>
            <span className="text-[10px] font-black text-slate-500">฿{d.toLocaleString()}</span>
            <input
              type="text" inputMode="numeric" placeholder="0"
              value={counts[d] ?? ''}
              onChange={e => onChange({ ...counts, [d]: toAsciiNumber(e.target.value).replace(/[^0-9]/g, '') })}
              className="w-full h-7 rounded-md px-1 text-xs font-bold text-slate-800 outline-none text-center"
              style={{ border: '1px solid #E2E8F0', background: 'white' }}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-lg px-3 py-2"
        style={{ background: `${accent}12` }}>
        <span className="text-[11px] font-bold" style={{ color: accent }}>รวมทั้งหมด</span>
        <span className="text-base font-black" style={{ color: accent }}>฿{denomTotal(counts).toLocaleString()}</span>
      </div>
    </div>
  )
}

export default function OperatorPage() {
  const { success, error: toastError, warning } = useToast()

  const [overnightCfg,   setOvernightCfg]   = useState<OvernightConfig | undefined>(undefined)
  const [lostCardFine,   setLostCardFine]   = useState(300)
  const [sessions, setSessions] = useState<Session[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [fleetStats, setFleetStats] = useState<FleetStats | null>(null)
  const [shift, setShift] = useState<Shift | null | undefined>(undefined) // undefined = loading
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [shiftEnding, setShiftEnding] = useState(false)
  const [openedShift, setOpenedShift] = useState<ClosedShift | null>(null)
  const [closedShift, setClosedShift] = useState<ClosedShift | null>(null)
  const [openingCounts, setOpeningCounts] = useState<DenomCounts>({})
  const [closingCounts, setClosingCounts] = useState<DenomCounts>({})
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
  const [coPdfLoading, setCoPdfLoading] = useState(false)
  const [coType,        setCoType]        = useState<CardType>('car')
  const [coHours,       setCoHours]       = useState(1)
  const [coFee,         setCoFee]         = useState(0)
  const [coSessionId,   setCoSessionId]   = useState('')
  const [coQueueId, setCoQueueId] = useState('')
  const [coPlate,       setCoPlate]       = useState('')
  const [coCustomTime,  setCoCustomTime]  = useState('')
  const [coScannedTime, setCoScannedTime] = useState('')
  const [coEntryTime,   setCoEntryTime]   = useState<Date | null>(null)
  const [coSource,      setCoSource]      = useState<'card' | 'plate'>('card')

  // Entry-capture replay (CctvStrip exit view) — deliberately NOT cleared by resetCO/finishCheckout,
  // so the last car's entry photos stay on screen until the next car starts checking out.
  const [lastExitSessionId, setLastExitSessionId] = useState('')
  const [lastExitPlate,     setLastExitPlate]     = useState('')

  // Sidebar quick plate lookup (checkin/checkout auto-route by typed plate)
  const [plateMatches, setPlateMatches] = useState<Session[] | null>(null)
  const [returnCard, setReturnCard] = useState<{ _id: string; cardUid: string; plate: string; cardType: string; exitTime?: string; lostFine: number } | null>(null)
  const [refundMethod, setRefundMethod] = useState<'cash' | 'qr'>('cash')
  const [refunding, setRefunding] = useState(false)

  async function confirmCardReturn() {
    if (!returnCard || refunding) return
    setRefunding(true)
    try {
      const res = await fetch('/api/sessions/return-card', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: returnCard._id, paymentMethod: refundMethod }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ')
      setReturnCard(null)
      success('คืนบัตรและคืนค่าปรับแล้ว', `ยอดคืน ฿${data.amount.toLocaleString()} บันทึกในกะปัจจุบัน`)
      await Promise.all([fetchData(), fetchShift()])
    } catch (error) { toastError('คืนบัตรไม่สำเร็จ', error instanceof Error ? error.message : 'กรุณาลองใหม่') }
    finally { setRefunding(false) }
  }
  const [matchSource, setMatchSource] = useState<'card' | 'plate'>('plate')
  const [plateBusy, setPlateBusy] = useState(false)
  const [plateQuick, setPlateQuick] = useState('')
  const [isExitView, setIsExitView] = useState(false) // mirrors CctvStrip's F12 entry/exit toggle
  const plateInputRef = useRef<HTMLInputElement>(null)
  const plateIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Lost card
  const [lostOpen,  setLostOpen]  = useState(false)
  const [lostPlate, setLostPlate] = useState('')

  const [carsListOpen, setCarsListOpen] = useState(false)
  const [shiftReportOpen, setShiftReportOpen] = useState(false)

  const onCardScanRef = useRef<(uid: string) => void>(() => {})
  const cardScanBusy = useRef(false)
  const scanInputRef = useRef<HTMLInputElement>(null)
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [scanBuf, setScanBuf] = useState('')
  const physicalScanBuf = useRef('')

  // Serial (COM port) reader — fallback path for readers that aren't HID keyboard-wedge
  const serialHandleRef = useRef<SerialReaderHandle | null>(null)
  const [serialSupported, setSerialSupported] = useState(false) // starts false to match SSR; set after mount
  const [serialConnected, setSerialConnected] = useState(false)
  const [serialConnecting, setSerialConnecting] = useState(false)
  const [serialBaud, setSerialBaudState] = useState(9600)

  function resetCI() { setCiStep('scan'); setCiPlate(''); setCiType('car'); setCiUid(''); setCiCustomTime('') }
  function resetCO() { setCoQueueId(''); setCoStep('scan'); setCoSessionId(''); setCoPlate(''); setCoCustomTime(''); setCoEntryTime(null); setCoPaidAmount(0); setCoSource('card') }

  const fetchShift = useCallback(async () => {
    try {
      const res = await fetch('/api/shifts/current', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setShift(data)
    } catch {
      // Keep the last known shift; an unavailable server does not mean no active shift.
    }
  }, [])

  const [dataUnavailable, setDataUnavailable] = useState(false)
  const dataRequest = useRef<Promise<void> | null>(null)
  const fetchData = useCallback(() => {
    if (dataRequest.current) return dataRequest.current
    dataRequest.current = (async () => {
      const results = await Promise.allSettled([
        '/api/sessions?status=active&allActive=1', '/api/stats', '/api/queue', '/api/stats/fleet',
      ].map(async url => {
        const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12000) })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      }))
      const [sessionsResult, statsResult, queueResult, fleetResult] = results
      // Keep the last known values when an endpoint is unavailable, never show a false empty lot.
      if (sessionsResult.status === 'fulfilled' && Array.isArray(sessionsResult.value?.sessions)) setSessions(sessionsResult.value.sessions)
      if (statsResult.status === 'fulfilled' && statsResult.value?.car && statsResult.value?.motorcycle) setStats(statsResult.value)
      if (queueResult.status === 'fulfilled' && Array.isArray(queueResult.value)) setQueues(queueResult.value)
      if (fleetResult.status === 'fulfilled' && fleetResult.value?.car && fleetResult.value?.motorcycle) setFleetStats(fleetResult.value)
      setDataUnavailable(results.some(result => result.status === 'rejected'))
    })().finally(() => { setLoading(false); dataRequest.current = null })
    return dataRequest.current
  }, [])

  const fetchSettings = useCallback(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(s => {
        if (s?.rates?.overnight) setOvernightCfg(s.rates.overnight)
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
  const noDialogOpen = !openedShift && !closedShift && !checkInOpen && !checkOutOpen && !lostOpen && !shiftEnding && !plateMatches && !returnCard && !carsListOpen && !shiftReportOpen && !!shift
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
  // Preview only: the queue remains waiting until payment is confirmed.
  async function checkoutFromQueue(q: QueueEntry) {
    openCheckout({ _id: '', cardUid: q.cardUid ?? '', cardType: q.cardType, plate: q.plate,
      entryTime: q.joinedAt, durationMin: 0, fee: 0, totalFee: 0, status: 'active' }, 'card')
    setCoQueueId(q._id)
  }

  // รถคันหน้าคิวเข้าลานจริง — operator ต้องกดยืนยันเอง (ไม่ auto) เพราะแค่มีที่ว่างไม่ได้แปลว่ารถคันนั้นขับเข้ามาจริงแล้ว
  async function handleEnterFromQueue(q: QueueEntry) {
    setQLoading(q._id)
    try {
      const res = await fetch(`/api/queue/${q._id}/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        void triggerBarrierClient('checkin')
        await Promise.all([fetchData(), fetchShift()])
        success('เข้าลานแล้ว', `ทะเบียน ${q.plate} เข้าลานเรียบร้อย`)
      } else {
        const err = await res.json()
        toastError('เข้าลานไม่สำเร็จ', err.error ?? 'เกิดข้อผิดพลาด')
      }
    } catch {
      toastError('ตรวจสอบการเข้าลานไม่สำเร็จ', 'กรุณารีเฟรชรายการเพื่อตรวจสถานะรถก่อนลองใหม่')
    } finally {
      setQLoading(null)
      // The clicked queue button disappears after entry; explicitly restore HID capture.
      setScanBuf('')
      physicalScanBuf.current = ''
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current)
      requestAnimationFrame(() => scanInputRef.current?.focus())
    }
  }

  // Shift actions
  async function startShift() {
    try {
    const res = await fetch('/api/shifts/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ openingFloat: denomTotal(openingCounts), openingBreakdown: denomBreakdown(openingCounts) }),
    })
    const data = await res.json().catch(() => null)
    if (res.ok && data?._id) {
      setOpeningCounts({})
      setShift(data)
      setOpenedShift(data)
      success('เริ่มกะแล้ว', 'ระบบเริ่มนับยอดเงินและรถสำหรับกะนี้')
    } else {
      toastError('ไม่สามารถเริ่มกะได้', data?.error ?? `เซิร์ฟเวอร์ตอบกลับไม่สมบูรณ์ (HTTP ${res.status}) กรุณาตรวจสถานะกะแล้วลองใหม่`)
    }
    } catch {
      toastError('ไม่สามารถติดต่อเซิร์ฟเวอร์', 'กรุณาตรวจการเชื่อมต่อและสถานะกะก่อนลองใหม่')
    }
  }

  async function endShift() {
    const res = await fetch('/api/shifts/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closingFloat: denomTotal(closingCounts), closingBreakdown: denomBreakdown(closingCounts) }),
    })
    if (res.ok) {
      const result = await res.json()
      setClosedShift(result)
      setShiftEnding(false)
      setClosingCounts({})
      success('ปิดกะแล้ว', 'บันทึกยอดเรียบร้อย สามารถรับใบปิดกะได้')
    } else {
      const err = await res.json()
      toastError('ไม่สามารถปิดกะได้', err.error)
    }
  }

  // Check In
  async function handleCheckin() {
    if (!ciUid) {
      warning('กรุณาแตะบัตรก่อนกรอกทะเบียน')
      return
    }
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
      void triggerBarrierClient('checkin')
      // Wait for the sessions list to refresh BEFORE closing the dialog and re-arming the
      // card-reader listener — otherwise an immediate re-tap of the same card still sees the
      // stale (pre-checkin) sessions list, doesn't find the new active session, and gets
      // routed back into check-in instead of check-out.
      await Promise.all([fetchData(), fetchShift()])
      setCheckInOpen(false)
      success('ขาเข้าสำเร็จ', `ทะเบียน ${ciPlate} เข้าลานเรียบร้อย`)
      resetCI()
      return
    }

    const err = await res.json()

    // Lot full (car or motorcycle lot, checked separately server-side) → same popup, but fall back to the queue instead of failing outright
    if (res.status === 409 && typeof err.error === 'string' && err.error.includes('เต็มแล้ว')) {
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
    setCoFee(calcFeeFromMinutes(coType, durationMin, coEntryTime, exit, overnightCfg))
  }

  // Check Out (scan dialog)
  // Keep card taps and plate lookups as explicit, separate checkout paths.
  // Only the plate path is allowed to add the lost-card fine.
  function openCheckout(s: Session, source: 'card' | 'plate') {
    setCoQueueId(s.queueId ?? '')
    fetchSettings()
    const entry = new Date(s.entryTime)
    const now = new Date()
    setCoScannedTime(now.toISOString())
    const durationMin = Math.max(1, Math.floor((now.getTime() - entry.getTime()) / 60000))
    const hours = Math.ceil(durationMin / 60)
    setCoType(s.cardType)
    setCoHours(hours)
    setCoFee(calcFeeFromMinutes(s.cardType, durationMin, entry, now, overnightCfg))
    setCoSessionId(s._id); setCoPlate(s.plate); setCoEntryTime(entry); setCoStep('payment'); setCheckOutOpen(true)
    setLastExitSessionId(s._id); setLastExitPlate(s.plate)
    setCoSource(source)
  }

  // Sidebar plate input → auto-route:
  //  - active session with this plate           → checkout
  //  - no session, but exit camera view is on    → lost card (car is at the exit gate with no record)
  //  - no session, otherwise                     → checkin (handleCheckin falls back to queue itself if the lot is full)
  async function loadActiveSessions(): Promise<Session[]> {
    const res = await fetch('/api/sessions?status=active&allActive=1', { cache: 'no-store' })
    if (!res.ok) throw new Error('โหลดรายการรถไม่สำเร็จ')
    const data = await res.json()
    setSessions(data.sessions)
    return data.sessions
  }

  async function handlePlateQuickSubmit() {
    const plate = toAsciiPlate(convertThaiToEn(plateQuick))
    if (plate.length !== 4 || plateBusy || !shift) return
    if (!isExitView) {
      warning('กรุณาแตะบัตรก่อนกรอกทะเบียน')
      return
    }
    setPlateBusy(true)
    try {
      const [current, queueResponse] = await Promise.all([
        loadActiveSessions(),
        fetch('/api/queue', { cache: 'no-store' }),
      ])
      if (!queueResponse.ok) throw new Error('โหลดคิวรอไม่สำเร็จ')
      const waiting: QueueEntry[] = await queueResponse.json()
      if (!Array.isArray(waiting)) throw new Error('ข้อมูลคิวรอไม่ถูกต้อง')
      setMatchSource('plate')
      const matches: Session[] = [
        ...current.filter(s => s.plate === plate),
        ...waiting.filter(q => q.status === 'waiting' && q.plate === plate).map(q => ({
          _id: q._id, queueId: q._id, cardUid: q.cardUid ?? '', cardType: q.cardType,
          plate: q.plate, entryTime: q.joinedAt, durationMin: 0, fee: 0, totalFee: 0,
          status: 'active' as const,
        })),
      ]
      if (matches.length === 0) {
        setPlateMatches(null)
        warning('ไม่พบข้อมูล')
      } else if (matches.length === 1) {
        setPlateMatches(null)
        setPlateQuick('')
        openCheckout(matches[0], 'plate')
      } else {
        setPlateMatches(matches)
      }
    } catch {
      toastError('ค้นหาไม่สำเร็จ', 'กรุณาลองใหม่')
    } finally { setPlateBusy(false) }
  }

  async function handleCheckout(paymentMethod: PaymentMethod, discountId?: string, dailyDiscountId?: string, isLostCard?: boolean, fineId?: string) {
    const body: Record<string, unknown> = {
      sessionId: coSessionId || undefined,
      queueId: coQueueId || undefined,
      paymentMethod,
      discountId,
      dailyDiscountId,
      lostCard: isLostCard === true,
      fineId,
    }
    if (coCustomTime || coScannedTime) body.exitTime = new Date(coCustomTime || coScannedTime).toISOString()
    const res = await fetch('/api/sessions/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const data = await res.json()
      setCoSessionId(data._id)
      setCoQueueId('')
      setCoPaidAmount(data.totalFee ?? coFee)
      setCoStep('done')
      void triggerBarrierClient('checkout')
      await Promise.all([fetchData(), fetchShift()])
      const label = paymentMethod === 'qr' ? 'โอนเงิน' : 'เงินสด'
      success('ขาออกสำเร็จ', `รับ${label} เรียบร้อย`)
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

  async function handleDownloadReceiptPdf() {
    if (!coSessionId || coPdfLoading) return
    setCoPdfLoading(true)
    try {
      const { downloadReceiptPdf } = await import('@/lib/receiptPdf')
      await downloadReceiptPdf(coSessionId)
    } catch (error) {
      toastError('สร้าง PDF ไม่สำเร็จ', error instanceof Error ? error.message : 'กรุณาลองใหม่')
    } finally { setCoPdfLoading(false) }
  }

  function finishCheckout() {
    setCheckOutOpen(false); resetCO()
  }

  // ── Card-reader auto-route: checkin or checkout based on active sessions ──
  useEffect(() => {
    if (!carsListOpen) return
    const read = createHidScan()
    const listener = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey || event.repeat) return
      const raw = read(hidKey(event) ?? event.key, performance.now())
      if (raw) {
        event.preventDefault()
        event.stopPropagation()
        onCardScanRef.current(normalizeUid(raw))
      }
    }
    window.addEventListener('keydown', listener, true)
    return () => window.removeEventListener('keydown', listener, true)
  }, [carsListOpen])
  // Updated every render via ref so the keydown useEffect (deps=[]) is never stale
  useEffect(() => {
    onCardScanRef.current = async (uid: string) => {
      // Ignore scan when any dialog is already open — prevents resetting in-progress forms
      if (openedShift || closedShift || checkInOpen || checkOutOpen || lostOpen || shiftEnding || plateMatches || returnCard || shiftReportOpen || !shift || cardScanBusy.current) return
      cardScanBusy.current = true
      try {
      setCarsListOpen(false)
      setSearch('')

      // Cards/sessions registered before Thai→ASCII conversion have Thai chars stored as UID.
      // Match by the converted uid OR by converting the stored uid (backward-compat).
      const matchUid = (stored: string) => convertThaiToEn(stored).trim().toUpperCase() === convertThaiToEn(uid).trim().toUpperCase()

      let current: Session[]
      try { current = await loadActiveSessions() } catch { toastError('ค้นหาบัตรไม่สำเร็จ', 'กรุณาลองใหม่'); return }
      const matchingSessions = current.filter(s => matchUid(s.cardUid))
      if (matchingSessions.length > 1) {
        setMatchSource('card')
        setPlateMatches(matchingSessions)
        warning('พบข้อมูลบัตรซ้ำในลาน', 'กรุณาตรวจภาพและเวลาเข้าเพื่อเลือกรายการให้ตรงกับรถจริง')
        return
      }
      const activeSession = matchingSessions[0]
      if (activeSession) {
        // Card already inside → checkout
        openCheckout(activeSession, 'card')
      } else {
        // A waiting card must use its existing queue entry, not a new check-in.
        try {
          const queueRes = await fetch('/api/queue', { cache: 'no-store' })
          if (!queueRes.ok) throw new Error('Queue lookup failed')
          const waiting: QueueEntry[] = await queueRes.json()
          if (!Array.isArray(waiting)) throw new Error('Invalid queue response')
          setQueues(waiting)
          const queued = waiting.find(q => q.cardUid && matchUid(q.cardUid))
          if (queued) {
            await checkoutFromQueue(queued)
            return
          }
        } catch {
          toastError('ตรวจสอบคิวไม่สำเร็จ', 'กรุณาลองแตะบัตรใหม่')
          return
        }
        // Card not inside → checkin: resolve card type + plate from registration
        try {
          const res = await fetch('/api/cards')
          if (res.ok) {
            const cards: Array<{ uid: string; type: CardType; plate: string }> = await res.json()
            const found = cards.find(c => matchUid(c.uid))
            if (found) {
              const refundRes = await fetch(`/api/sessions/return-card?uid=${encodeURIComponent(found.uid)}`, { cache: 'no-store' })
              if (!refundRes.ok) { toastError('ตรวจสอบบัตรหายไม่สำเร็จ', 'กรุณาลองแตะบัตรใหม่'); return }
              const lostVisit = await refundRes.json()
              if (lostVisit) { setRefundMethod('cash'); setReturnCard(lostVisit); return }
              setCiType(found.type)
              setCiPlate('')
              setCiUid(found.uid)
              setCiStep('confirm')
              setCheckInOpen(true)
              return
            }
          }
        } catch { /* ignore */ }
        // ไม่พบบัตรในระบบ → แจ้งเตือนเฉยๆ (ลงทะเบียนบัตรทำที่หน้าจัดการบัตรแทน)
        warning('บัตรนี้ไม่ได้ลงทะเบียน', `UID: ${uid} — กรุณาลงทะเบียนบัตรก่อนใช้งาน`)
      }
      } finally { cardScanBusy.current = false }
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
      if (openedShift || closedShift) return
      // ป้องกันการทำงานซ้อนถ้ามี modal เปิดอยู่แล้ว (ยกเว้น carsListOpen เอง — F2 ต้องสลับปิดได้)
      if (e.key === 'F3' || e.code === 'F3') {
        e.preventDefault()
        e.stopPropagation()
        if (e.repeat) return
        if (checkInOpen || checkOutOpen || lostOpen || shiftEnding || plateMatches || returnCard) {
          warning('กรุณาปิดหน้ารายการที่กำลังทำก่อนเปิดรายงาน F3')
          return
        }
        if (shift === null) {
          warning('กรุณาเริ่มกะก่อนเปิดรายงาน F3')
          return
        }
        setCarsListOpen(false)
        setShiftReportOpen(o => !o)
        return
      }
      if (checkInOpen || checkOutOpen || lostOpen || shiftEnding || plateMatches || returnCard) return
      if (shiftReportOpen) return

      if (e.key === 'F2') {
        e.preventDefault()
        setCarsListOpen(o => !o)
      }

      if (e.key === 'F7' && shift) {
        e.preventDefault()
        setShiftEnding(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [checkInOpen, checkOutOpen, lostOpen, shiftEnding, shift, plateMatches, returnCard, shiftReportOpen, warning, closedShift, openedShift])

  return (
    <div className="h-screen flex flex-col bg-[#F0F4FF]">
      {/* Hidden input — always focused when no dialog is open, captures card-reader keystrokes */}
      <input
        ref={scanInputRef}
        value={scanBuf}
        onChange={e => {
          const val = e.target.value
          physicalScanBuf.current = val
          setScanBuf(val)
          if (scanTimerRef.current) clearTimeout(scanTimerRef.current)
          scanTimerRef.current = setTimeout(() => {
            const uid = normalizeUid(val)
            setScanBuf('')
            physicalScanBuf.current = ''
            if (uid.length >= 4) onCardScanRef.current(uid)
          }, 300)
        }}
        onKeyDown={e => {
          const key = hidKey(e)
          if (!key || e.repeat) return
          e.preventDefault()
          if (key === 'Enter') {
            if (scanTimerRef.current) clearTimeout(scanTimerRef.current)
            const uid = normalizeUid(physicalScanBuf.current)
            physicalScanBuf.current = ''
            setScanBuf('')
            if (uid.length >= 4) onCardScanRef.current(uid)
          } else {
            physicalScanBuf.current += key
            setScanBuf(physicalScanBuf.current)
            if (scanTimerRef.current) clearTimeout(scanTimerRef.current)
            scanTimerRef.current = setTimeout(() => {
              const uid = normalizeUid(physicalScanBuf.current)
              physicalScanBuf.current = ''
              setScanBuf('')
              if (uid.length >= 4) onCardScanRef.current(uid)
            }, 300)
          }
        }}
        onBlur={e => {
          // Don't steal focus from a real input the operator clicked (e.g. search box)
          const target = e.relatedTarget as HTMLElement | null
          if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return
          if (!openedShift && !closedShift && !checkInOpen && !checkOutOpen && !lostOpen && !shiftEnding && !plateMatches && !returnCard && !carsListOpen && !shiftReportOpen && !!shift) {
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
          <img src="/logo/logoa20.png" alt="A20 Park" className="h-7 w-auto object-contain rounded-md" />
          <div className="w-px h-5 bg-slate-200" />
          <p className="text-xs font-semibold text-slate-400 tracking-wide">OPERATOR</p>
        </div>

        <div className="flex items-center gap-3">
          {stats && (
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)' }}>
              <span className="size-2 rounded-full animate-pulse inline-block" style={{ background: '#10B981' }} />
              <span className="text-xs font-bold flex items-center gap-1" style={{ color: '#065F46' }}>
                <Car className="size-3.5" /> {stats.car.available}/{stats.car.capacity}
              </span>
              <span className="text-xs font-bold flex items-center gap-1" style={{ color: '#065F46' }}>
                <Bike className="size-3.5" /> {stats.motorcycle.available}/{stats.motorcycle.capacity}
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
            onClick={() => shift ? setShiftEnding(true) : handleLogout()}
            className="h-8 px-3 rounded-lg text-xs font-bold"
            style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid rgba(239,68,68,0.18)' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2' }}
          >
            ออกจากระบบ
          </button>
        </div>
      </header>

      {dataUnavailable && <div role="status" className="shrink-0 bg-amber-100 px-4 py-2 text-xs text-amber-900">
        โหลดข้อมูลบางส่วนไม่ได้ ข้อมูลที่เห็นอาจยังไม่อัปเดต — ระบบจะลองใหม่อัตโนมัติ
        <button className="ml-3 underline font-bold" onClick={() => { void fetchData() }}>ลองใหม่</button>
      </div>}
      {/* ─── Body ─── */}
      <div className="flex-1 min-h-0 p-3 flex gap-3">

        {/* ── Camera strip + fleet status bar — main area, fills all available space ── */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-2">
          <div className="flex-1 min-h-0 flex flex-col rounded-2xl overflow-hidden">
            <CctvStrip
              isExit={isExitView}
              onToggleExit={() => setIsExitView(v => !v)}
              entrySessionId={lastExitSessionId || undefined}
              entryPlate={lastExitPlate || undefined}
            />
          </div>
          <FleetStatusBar stats={fleetStats} />
        </div>

        {/* ── Right sidebar: check-in / check-out / queue ── */}
        <div className="w-75 shrink-0 flex flex-col gap-2 min-h-0">

          {/* Quick plate lookup — auto-route: active session found = checkout,
              no session + exit camera view = lost card, no session + lot full = queue, else = checkin */}
          <div className="shrink-0 flex flex-col gap-1.5 p-3 rounded-xl"
            style={{ background: 'white', border: '1px solid #E8ECF4', boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
            <div className="flex gap-2" role="group" aria-label="ทิศทางรถ">
              <button type="button" onClick={() => setIsExitView(false)} aria-pressed={!isExitView} className={`flex-1 rounded-lg p-2 font-bold ${!isExitView ? 'bg-yellow-400' : 'bg-slate-100'}`}>รับรถเข้า</button>
              <button type="button" onClick={() => setIsExitView(true)} aria-pressed={isExitView} className={`flex-1 rounded-lg p-2 font-bold ${isExitView ? 'bg-emerald-300' : 'bg-slate-100'}`}>รับรถออก</button>
            </div>
            <label className="text-[10px] font-bold text-slate-400 px-0.5">{isExitView ? 'เลขทะเบียนขาออก (4 หลัก) — Enter เพื่อยืนยัน' : 'ขาเข้า — กรุณาแตะบัตรก่อนกรอกทะเบียน'}</label>
            {isExitView && <form
              onSubmit={e => { e.preventDefault(); handlePlateQuickSubmit() }}
              className="flex items-center gap-2"
            >
              <input
                ref={plateInputRef}
                disabled={!isExitView}
                value={plateQuick}
                onChange={e => {
                  setPlateQuick(toAsciiPlate(convertThaiToEn(e.target.value)).slice(0, 4))
                  // Keep resetting the idle timer while the operator is actively typing digits.
                  if (plateIdleTimerRef.current) clearTimeout(plateIdleTimerRef.current)
                  plateIdleTimerRef.current = setTimeout(() => { plateInputRef.current?.blur(); scanInputRef.current?.focus() }, 2000)
                }}
                onFocus={() => {
                  // A real card tap can land its keystrokes here if this box was merely
                  // clicked/focused earlier and never blurred — auto-release it after a short
                  // idle period so the hidden reader-capture input reclaims focus.
                  if (plateIdleTimerRef.current) clearTimeout(plateIdleTimerRef.current)
                  plateIdleTimerRef.current = setTimeout(() => { plateInputRef.current?.blur(); scanInputRef.current?.focus() }, 2000)
                }}
                onBlur={() => {
                  if (plateIdleTimerRef.current) { clearTimeout(plateIdleTimerRef.current); plateIdleTimerRef.current = null }
                }}
                inputMode="numeric"
                enterKeyHint="done"
                placeholder="0000"
                className="flex-1 min-w-0 h-11 rounded-lg text-center text-xl font-black tracking-[0.2em] text-slate-800 outline-none"
                style={{ background: '#F8FAFF', border: '1px solid #E2E8F0' }}
              />
              <button
                type="submit"
                disabled={!isExitView || plateQuick.length !== 4 || plateBusy || !shift}
                className="shrink-0 h-11 px-4 rounded-lg text-sm font-black text-black transition-all active:scale-[0.97] hover:brightness-110 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#713F12,#EAB308)', boxShadow: '0 4px 16px rgba(161,98,7,0.38)' }}
              >
                ยืนยัน
              </button>
            </form>}
            {isExitView ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full self-start"
                style={{ background: 'rgba(217,119,6,0.1)', color: '#92400E' }}>
                ขาออก — ค้นหาแล้วเลือกรถก่อนรับเงิน
              </span>
            ) : stats && stats.availableSlots === 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full self-start"
                style={{ background: 'rgba(124,58,237,0.08)', color: '#7C3AED' }}>
                ลานเต็ม — ทะเบียนใหม่จะเข้าคิวรอแทน
              </span>
            )}
          </div>

          {shiftReportOpen && <ShiftReportDialog onClose={() => setShiftReportOpen(false)} />}
          <CarsInLotDialog
            open={carsListOpen}
            onOpenChange={setCarsListOpen}
            sessions={activeSessions}
            stats={stats}
            loading={loading}
            search={search}
            onSearchChange={setSearch}
            onRefresh={fetchData}
            onCheckout={s => { setCarsListOpen(false); openCheckout(s, 'card') }}
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
                          {idx === 0 && stats && stats[col.type].available > 0 && (
                            <button
                              onClick={() => handleEnterFromQueue(q)}
                              disabled={!!qLoading}
                              className="flex items-center justify-center size-4 rounded transition-all disabled:opacity-40 shrink-0"
                              style={{ background: 'rgba(22,163,74,0.1)' }}
                              title="มีที่ว่าง — กดยืนยันรถเข้าจอด"
                            >
                              {qLoading === q._id
                                ? <RefreshCw className="size-2.5 text-green-700 animate-spin" />
                                : <LogIn className="size-2.5" style={{ color: '#16A34A' }} />}
                            </button>
                          )}
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
                style={{ background: 'linear-gradient(145deg, #713F12 0%, #EAB308 100%)', boxShadow: '0 8px 32px rgba(161,98,7,0.4)' }}>
                <Play className="size-10 text-black fill-black" />
              </div>
              <h2 className="text-2xl font-black text-slate-900">เริ่มกะทำงาน</h2>
              <p className="text-xs text-slate-400 mt-1">กรุณากรอกข้อมูลก่อนเริ่มกะ</p>
            </div>

            {/* Info cards */}
            <div className="px-6 pb-4 flex gap-3">
              <div className="flex-1 rounded-2xl p-3.5 text-center" style={{ background: '#F0F7FF', border: '1px solid rgba(161,98,7,0.12)' }}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">รถในลานขณะนี้</p>
                <p className="text-3xl font-black mt-1" style={{ color: '#A16207' }}>
                  {stats?.activeCars ?? '—'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">คัน (รถค้างจากกะก่อน)</p>
              </div>
            </div>

            <div className="px-6 pb-4">
              <ShiftVehicleSummary opening remaining={stats ? { car: stats.car.active, motorcycle: stats.motorcycle.active } : undefined} />
            </div>

            {/* Opening float input */}
            <div className="px-6 pb-6 space-y-3">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  เงินต้นกะ (รับจาก till)
                  <span className="text-slate-400 font-normal ml-1">— ไม่บังคับ</span>
                </label>
                <DenomCounter counts={openingCounts} onChange={setOpeningCounts} accent="#A16207" />
              </div>

              <button
                onClick={startShift}
                className="w-full h-14 rounded-2xl text-black font-black text-lg tracking-wide transition-all active:scale-[0.97]"
                style={{ background: 'linear-gradient(145deg, #713F12 0%, #EAB308 100%)', boxShadow: '0 4px 20px rgba(161,98,7,0.45)' }}
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
              style={{ background: 'linear-gradient(135deg, #171717 0%, #262626 100%)' }}>
              <div>
                <p className="text-white font-black text-lg">ปิดกะทำงาน</p>
                <p className="text-slate-400 text-xs mt-0.5">กะเริ่ม {fmtTime(shift.startTime)}</p>
              </div>
              <button onClick={() => { setShiftEnding(false); setClosingCounts({}) }}
                className="size-8 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.1)' }}>
                <X className="size-4 text-white" />
              </button>
            </div>

            {/* Stats */}
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'รถเข้ากะนี้',   value: shift.checkinsCount,  color: '#A16207', icon: LogIn },
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

              <ShiftVehicleSummary incoming={shift.checkinsByType} outgoing={shift.checkoutsByType} remaining={stats ? { car: stats.car.active, motorcycle: stats.motorcycle.active } : undefined} />

              {/* Closing float input */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  เงินส่ง till
                  <span className="text-slate-400 font-normal ml-1">— จำนวนที่จะส่งคืน</span>
                </label>
                <DenomCounter counts={closingCounts} onChange={setClosingCounts} accent="#DC2626" />
              </div>

              <p className="text-[10px] text-slate-400 text-center">
                ยอดรายได้ทั้งหมดจะแสดงในรายงาน Admin เท่านั้น
              </p>
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => { setShiftEnding(false); setClosingCounts({}) }}
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

      <Dialog open={returnCard !== null} onOpenChange={o => { if (!o && !refunding) setReturnCard(null) }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>พบบัตรที่แจ้งหาย — คืนบัตรและคืนค่าปรับ</DialogTitle>
            <DialogDescription>ตรวจสอบรถและส่งคืนเงินให้ลูกค้าก่อนยืนยัน รายการจอดเดิมสิ้นสุดแล้ว</DialogDescription></DialogHeader>
          <DialogBody className="space-y-5 text-lg">
            {returnCard && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <EntryPhoto key={`${returnCard._id}-entry`} sessionId={returnCard._id} />
              <EntryPhoto key={`${returnCard._id}-exit`} sessionId={returnCard._id} exit />
            </div>}
            <dl className="grid grid-cols-2 gap-3">
              <dt>ทะเบียน</dt><dd className="font-bold">{returnCard?.plate}</dd>
              <dt>ประเภทรถ</dt><dd>{returnCard?.cardType === 'motorcycle' ? 'รถจักรยานยนต์' : 'รถยนต์'}</dd>
              <dt>เลขบัตร</dt><dd>{returnCard?.cardUid}</dd>
              <dt>ออกเวลา</dt><dd>{returnCard?.exitTime ? new Date(returnCard.exitTime).toLocaleString('th-TH') : '—'}</dd>
              <dt>ค่าปรับบัตรหายที่คืน</dt><dd className="font-bold">฿{(returnCard?.lostFine ?? 0).toLocaleString()}</dd>
            </dl>
            <label className="block">คืนเงินโดย
              <select className="ml-4 rounded-lg border p-2" value={refundMethod} disabled={refunding} onChange={e => setRefundMethod(e.target.value as 'cash' | 'qr')}><option value="cash">เงินสด</option><option value="qr">โอน / QR</option></select>
            </label>
            <div className="flex gap-3"><button disabled={refunding} className="rounded-xl border px-5 py-3" onClick={() => setReturnCard(null)}>ยกเลิก</button>
              <button disabled={refunding} className="flex-1 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-50" onClick={confirmCardReturn}>{refunding ? 'กำลังบันทึก…' : 'ยืนยันคืนบัตรและคืนค่าปรับ'}</button></div>
          </DialogBody>
        </DialogContent>
      </Dialog>
      <Dialog open={plateMatches !== null} onOpenChange={o => { if (!o) setPlateMatches(null) }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader><DialogTitle>{matchSource === 'card' ? 'ตรวจรายการซ้ำของบัตร — เลือกรถขาออก' : `เลือกรถขาออก — ${plateQuick}`}</DialogTitle>
            <DialogDescription>ตรวจภาพ เวลาเข้า และเลขบัตรให้ตรงกับรถจริงก่อนเลือก</DialogDescription></DialogHeader>
          <DialogBody className="max-h-[65vh] overflow-y-auto space-y-3">
            {plateMatches?.map(s => <button key={s._id} className="w-full rounded-xl border p-3 text-left flex flex-col gap-3 hover:border-emerald-500 focus-visible:outline-2 focus-visible:outline-emerald-600" onClick={() => { setPlateMatches(null); setPlateQuick(''); openCheckout(s, matchSource) }}>
              <span className="text-sm font-semibold text-slate-600">{s.queueId ? 'อยู่ในคิวรอ' : 'อยู่ในลานจอด'}</span>
              {!s.queueId && <span className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                <EntryPhoto sessionId={s._id} />
                <EntryPhoto sessionId={s._id} face />
              </span>}
              <span><strong>{s.plate} · {s.cardType === 'motorcycle' ? 'จักรยานยนต์' : 'รถยนต์'}</strong><br />
                เข้า {new Date(s.entryTime).toLocaleString('th-TH')}<br />บัตร {s.cardUid}<br /><span className="text-xs text-slate-500">รายการ {s._id}</span></span>
              <span className="self-end rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">เลือกรถคันนี้</span>
            </button>)}
          </DialogBody>
        </DialogContent>
      </Dialog>
      {openedShift && <ClosedShiftDialog opening shift={openedShift} onLogout={() => setOpenedShift(null)} />}
      {closedShift && <ClosedShiftDialog shift={closedShift} onLogout={handleLogout} />}
      {/* ─── Dialogs ─── */}
      <CheckInDialog
        open={checkInOpen}
        onOpenChange={o => { setCheckInOpen(o); if (!o) resetCI() }}
        step={ciStep} cardType={ciType} plate={ciPlate}
        duplicateSessions={sessions.filter(s => s.plate === ciPlate)}
        customEntryTime={ciCustomTime}
        onCustomEntryTimeChange={setCiCustomTime}
        onSelectType={t => { if (ciUid) { setCiType(t); setCiStep('confirm') } }}
        onPlateChange={setCiPlate}
        onBack={() => { setCheckInOpen(false); resetCI() }}
        onConfirm={handleCheckin}
      />
      <CheckOutDialog
        open={checkOutOpen}
        onOpenChange={o => { setCheckOutOpen(o); if (!o) resetCO() }}
        step={coStep} plate={coPlate} cardType={coType} hours={coHours} fee={coFee}
        paidAmount={coPaidAmount}
        printing={coPrinting}
        lostCardFine={lostCardFine}
        checkoutSource={coSource}
        entryTime={coEntryTime}
        scannedExitTime={coScannedTime}
        overnightCfg={overnightCfg}
        onBack={() => setCoStep('scan')}
        onConfirm={handleCheckout}
        onPrintReceipt={handlePrintReceipt}
        onDownloadPdf={handleDownloadReceiptPdf}
        downloadingPdf={coPdfLoading}
        onDone={finishCheckout}
      />
      <LostCardDialog
        open={lostOpen}
        onOpenChange={setLostOpen}
        onConfirm={handleLostCard}
        defaultPlate={lostPlate}
      />

    </div>
  )
}
