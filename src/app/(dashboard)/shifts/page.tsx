'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Clock, LogIn, LogOut, Banknote, Smartphone,
  ChevronDown, ChevronUp, Car, Bike, Moon,
  RefreshCw, CalendarDays, User, Tag,
} from 'lucide-react'

interface Shift {
  _id: string
  operatorId: string
  operatorName: string
  startTime: string
  endTime?: string
  status: 'active' | 'closed'
  checkinsCount:   number
  checkoutsCount:  number
  cashAmount:      number
  qrAmount:        number
  totalAmount:     number
  openingFloat:    number
  closingFloat:    number
  carryoverCars:   number
  closingCarCount: number
}

interface Session {
  _id: string
  plate: string
  cardType: 'car' | 'motorcycle' | 'overnight'
  entryTime: string
  exitTime?: string
  durationMin: number
  fee: number
  discountAmount: number
  discountName?: string
  totalFee: number
  paymentMethod: 'cash' | 'qr'
  status: 'active' | 'completed' | 'lost'
}

interface OperatorGroup {
  operatorId: string
  operatorName: string
  shifts: Shift[]
  totalCheckins: number
  totalCheckouts: number
  totalCash: number
  totalQr: number
  totalAmount: number
  hasActive: boolean
}

const TYPE_META = {
  car:        { label: 'รถยนต์',       icon: Car,  color: '#1D4ED8' },
  motorcycle: { label: 'มอเตอร์ไซค์', icon: Bike, color: '#6D28D9' },
  overnight:  { label: 'ค้างคืน',     icon: Moon, color: '#B45309' },
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('th-TH', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    day: '2-digit', month: 'short', year: '2-digit',
  })
}
function shiftDuration(start: string, end?: string) {
  const diff = (end ? new Date(end) : new Date()).getTime() - new Date(start).getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return `${h} ชม. ${m} น.`
}

/* ── รายละเอียดรถในแต่ละกะ ── */
function ShiftSessionTable({ shift }: { shift: Shift }) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // query แบบ shiftId ก่อน ถ้าไม่เจอ fallback เป็น time range
    const fromISO = shift.startTime
    const toISO   = shift.endTime ?? new Date().toISOString()

    const byShift = `/api/sessions?shiftId=${shift._id}&limit=200`
    const byTime  = `/api/sessions?dateFrom=${encodeURIComponent(fromISO)}&dateTo=${encodeURIComponent(toISO)}&limit=200`

    const safeJson = async (res: Response) => {
      try { return await res.json() } catch { return { sessions: [] } }
    }

    fetch(byShift)
      .then(safeJson)
      .then(async (d) => {
        if ((d.sessions ?? []).length > 0) return d.sessions as Session[]
        // ไม่เจอ shiftId → ใช้ช่วงเวลาแทน
        const d2 = await fetch(byTime).then(safeJson)
        return (d2.sessions ?? []) as Session[]
      })
      .then(s => setSessions(s))
      .finally(() => setLoading(false))
  }, [shift._id, shift.startTime, shift.endTime])

  if (loading) return (
    <div className="flex items-center justify-center py-6">
      <RefreshCw className="size-4 text-slate-300 animate-spin" />
    </div>
  )
  if (sessions.length === 0) return (
    <div className="py-6 text-center text-xs text-slate-300">ไม่มีรายการในกะนี้</div>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr style={{ background: '#F8FAFF' }}>
            {['ทะเบียน', 'ประเภท', 'เวลาเข้า', 'เวลาออก', 'ระยะเวลา', 'ราคาเต็ม', 'ส่วนลด', 'ยอดชำระ', 'สถานะ'].map(h => (
              <th key={h} className="px-4 py-2 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sessions.map((s, i) => {
            const m = TYPE_META[s.cardType]
            const Icon = m.icon
            const storedDiscount = s.discountAmount ?? 0
            const rawFee = s.fee ?? s.totalFee
            const inferredDiscount = rawFee > s.totalFee ? rawFee - s.totalFee : 0
            const displayDiscount = storedDiscount > 0 ? storedDiscount : inferredDiscount
            const hasDiscount = displayDiscount > 0
            return (
              <tr key={s._id} className="transition-colors hover:bg-slate-50/60"
                style={{ borderTop: i > 0 ? '1px solid #F1F5F9' : undefined }}>
                <td className="px-4 py-2.5 font-black text-slate-900 tracking-wider">{s.plate}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1">
                    <Icon className="size-3" style={{ color: m.color }} />
                    <span className="font-semibold" style={{ color: m.color }}>{m.label}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-slate-500 tabular-nums whitespace-nowrap">{fmtDateTime(s.entryTime)}</td>
                <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">
                  {s.exitTime
                    ? <span className="text-slate-500">{fmtDateTime(s.exitTime)}</span>
                    : <span className="font-semibold" style={{ color: '#059669' }}>จอดอยู่</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                  {s.durationMin > 0 ? `${Math.floor(s.durationMin / 60)}ชม. ${s.durationMin % 60}น.` : '—'}
                </td>

                {/* ราคาเต็ม */}
                <td className="px-4 py-2.5 tabular-nums">
                  {s.status !== 'active'
                    ? <span className={`font-semibold ${hasDiscount ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                        ฿{rawFee}
                      </span>
                    : <span className="text-slate-300">—</span>}
                </td>

                {/* ส่วนลด */}
                <td className="px-4 py-2.5">
                  {s.status !== 'active' && hasDiscount ? (
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1">
                        <Tag className="size-2.5 shrink-0" style={{ color: '#EA580C' }} />
                        <span className="font-black tabular-nums" style={{ color: '#EA580C' }}>-฿{displayDiscount}</span>
                      </div>
                      <span className="text-[9px] text-slate-400 truncate max-w-[100px]">
                        {s.discountName ?? 'ส่วนลด'}
                      </span>
                    </div>
                  ) : <span className="text-slate-300">—</span>}
                </td>

                {/* ยอดชำระ + วิธีชำระ */}
                <td className="px-4 py-2.5">
                  {s.status !== 'active' ? (
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-slate-800 tabular-nums">฿{s.totalFee}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={s.paymentMethod === 'qr'
                          ? { background: 'rgba(109,40,217,0.1)', color: '#6D28D9' }
                          : { background: 'rgba(5,150,105,0.1)', color: '#059669' }}>
                        {s.paymentMethod === 'qr' ? 'โอน' : 'สด'}
                      </span>
                    </div>
                  ) : <span className="text-slate-300">—</span>}
                </td>

                <td className="px-4 py-2.5">
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                    style={s.status === 'active'
                      ? { background: 'rgba(16,185,129,0.1)', color: '#065F46' }
                      : s.status === 'lost'
                      ? { background: 'rgba(245,158,11,0.1)', color: '#92400E' }
                      : { background: 'rgba(29,78,216,0.08)', color: '#1D4ED8' }}>
                    {s.status === 'active' ? 'จอดอยู่' : s.status === 'lost' ? 'บัตรหาย' : 'เสร็จแล้ว'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ── แถวกะแต่ละกะ ── */
function ShiftItem({ shift }: { shift: Shift }) {
  const [open, setOpen] = useState(false)
  const isActive = shift.status === 'active'

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors">

        <div className="shrink-0 size-2 rounded-full"
          style={{ background: isActive ? '#10B981' : '#CBD5E1' }} />

        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-800">
            {fmtDate(shift.startTime)}
            <span className="font-normal text-slate-400 ml-1">
              {fmtTime(shift.startTime)} – {shift.endTime ? fmtTime(shift.endTime) : 'ปัจจุบัน'}
            </span>
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {shiftDuration(shift.startTime, shift.endTime)}
            {isActive && <span className="ml-2 font-bold" style={{ color: '#059669' }}>● กำลังทำงาน</span>}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 text-center">
          {/* รถค้างเริ่มกะ */}
          <div>
            <p className="text-[9px] text-slate-400">รถค้างต้นกะ</p>
            <p className="text-sm font-black text-amber-600">{shift.carryoverCars}</p>
          </div>
          <div>
            <p className="text-[9px] text-slate-400">รถเข้า</p>
            <p className="text-sm font-black" style={{ color: '#1D4ED8' }}>{shift.checkinsCount}</p>
          </div>
          <div>
            <p className="text-[9px] text-slate-400">รถออก</p>
            <p className="text-sm font-black" style={{ color: '#059669' }}>{shift.checkoutsCount}</p>
          </div>
          {!isActive && (
            <div>
              <p className="text-[9px] text-slate-400">รถค้างปลายกะ</p>
              <p className="text-sm font-black text-amber-600">{shift.closingCarCount}</p>
            </div>
          )}

          <div className="w-px h-6 bg-slate-100" />

          {/* เงิน */}
          {shift.openingFloat > 0 && (
            <div>
              <p className="text-[9px] text-slate-400">ต้นกะ</p>
              <p className="text-xs font-black text-slate-500">฿{shift.openingFloat}</p>
            </div>
          )}
          <div>
            <p className="text-[9px] text-slate-400 flex items-center gap-0.5"><Banknote className="size-2.5" />เงินสด</p>
            <p className="text-xs font-black text-slate-700">฿{shift.cashAmount}</p>
          </div>
          <div>
            <p className="text-[9px] text-slate-400 flex items-center gap-0.5"><Smartphone className="size-2.5" />โอน</p>
            <p className="text-xs font-black text-slate-700">฿{shift.qrAmount}</p>
          </div>
          <div className="px-2.5 py-1 rounded-lg" style={{ background: 'rgba(5,150,105,0.08)' }}>
            <p className="text-[9px] font-semibold text-emerald-600">รวม</p>
            <p className="text-sm font-black" style={{ color: '#059669' }}>฿{shift.totalAmount}</p>
          </div>
          {shift.closingFloat > 0 && (
            <div className="px-2.5 py-1 rounded-lg" style={{ background: 'rgba(109,40,217,0.07)' }}>
              <p className="text-[9px] font-semibold" style={{ color: '#6D28D9' }}>ส่ง till</p>
              <p className="text-sm font-black" style={{ color: '#6D28D9' }}>฿{shift.closingFloat}</p>
            </div>
          )}
        </div>

        {open ? <ChevronUp className="size-3.5 text-slate-400 shrink-0" /> : <ChevronDown className="size-3.5 text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div style={{ borderTop: '1px solid #F1F5F9' }}>
          <ShiftSessionTable shift={shift} />
        </div>
      )}
    </div>
  )
}

/* ── การ์ด operator ── */
function OperatorCard({ group }: { group: OperatorGroup }) {
  const [open, setOpen] = useState(false)
  const initials = group.operatorName
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // สีประจำตัว hash จาก operatorId
  const hue = Array.from(group.operatorId).reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  const avatarBg = `hsl(${hue},60%,48%)`

  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E8ECF4', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>

      {/* Operator header */}
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50/60 transition-colors">

        {/* Avatar */}
        <div className="size-10 rounded-xl flex items-center justify-center text-white text-sm font-black shrink-0"
          style={{ background: avatarBg }}>
          {initials || <User className="size-4" />}
        </div>

        {/* Name + shift count */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-base font-black text-slate-900">{group.operatorName}</p>
            {group.hasActive && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(16,185,129,0.1)', color: '#065F46' }}>
                <span className="size-1.5 rounded-full animate-pulse inline-block" style={{ background: '#10B981' }} />
                กำลังทำงาน
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {group.shifts.length} กะ · รถเข้า {group.totalCheckins} คัน · รถออก {group.totalCheckouts} คัน
          </p>
        </div>

        {/* Revenue summary */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 justify-end">
              <Banknote className="size-3" /> เงินสด
            </p>
            <p className="text-sm font-black text-slate-700">฿{group.totalCash}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 justify-end">
              <Smartphone className="size-3" /> โอน
            </p>
            <p className="text-sm font-black text-slate-700">฿{group.totalQr}</p>
          </div>
          <div className="px-4 py-2 rounded-xl text-right" style={{ background: 'rgba(5,150,105,0.08)' }}>
            <p className="text-[10px] font-semibold text-emerald-600">รวมทั้งสิ้น</p>
            <p className="text-lg font-black" style={{ color: '#059669' }}>฿{group.totalAmount}</p>
          </div>
        </div>

        {open
          ? <ChevronUp className="size-4 text-slate-400 shrink-0" />
          : <ChevronDown className="size-4 text-slate-400 shrink-0" />}
      </button>

      {/* Shift list + day summary */}
      {open && (
        <div className="px-5 pb-5 flex flex-col gap-4" style={{ borderTop: '1px solid #F1F5F9' }}>

          {Object.entries(
            group.shifts.reduce<Record<string, Shift[]>>((acc, s) => {
              const day = new Date(s.startTime).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })
              if (!acc[day]) acc[day] = []
              acc[day].push(s)
              return acc
            }, {})
          ).map(([day, dayShifts]) => {
            const slotOf = (iso: string) => {
              const h = new Date(iso).getHours()
              if (h >= 6  && h < 14) return 'กะเช้า'
              if (h >= 14 && h < 22) return 'กะบ่าย'
              return 'กะดึก'
            }
            type Slot = 'กะเช้า' | 'กะบ่าย' | 'กะดึก'
            const slots: Slot[] = ['กะเช้า', 'กะบ่าย', 'กะดึก']
            const grouped = dayShifts.reduce<Record<Slot, Shift[]>>((a, s) => {
              const sl = slotOf(s.startTime) as Slot
              if (!a[sl]) a[sl] = []
              a[sl].push(s)
              return a
            }, {} as Record<Slot, Shift[]>)

            const dayTotal = dayShifts.reduce((a, s) => ({
              ins: a.ins + s.checkinsCount, outs: a.outs + s.checkoutsCount,
              cash: a.cash + s.cashAmount,  qr: a.qr + s.qrAmount, total: a.total + s.totalAmount,
            }), { ins: 0, outs: 0, cash: 0, qr: 0, total: 0 })

            const slotStyle: Record<Slot, { bg: string; color: string; pillBg: string }> = {
              'กะเช้า': { bg: 'rgba(251,191,36,0.07)', color: '#92400E', pillBg: 'rgba(251,191,36,0.15)' },
              'กะบ่าย': { bg: 'rgba(59,130,246,0.07)', color: '#1D4ED8', pillBg: 'rgba(59,130,246,0.14)' },
              'กะดึก':  { bg: 'rgba(109,40,217,0.07)', color: '#6D28D9', pillBg: 'rgba(109,40,217,0.14)' },
            }

            return (
              <div key={day}>
                <div className="flex items-center gap-2 pt-3 pb-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{day}</p>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>

                {slots.filter(sl => grouped[sl]?.length > 0).map(sl => {
                  const ss = slotStyle[sl]
                  const slShifts = grouped[sl]
                  const slTotal = slShifts.reduce((a, s) => ({
                    ins: a.ins + s.checkinsCount, outs: a.outs + s.checkoutsCount,
                    cash: a.cash + s.cashAmount, qr: a.qr + s.qrAmount, total: a.total + s.totalAmount,
                  }), { ins: 0, outs: 0, cash: 0, qr: 0, total: 0 })

                  return (
                    <div key={sl} className="mb-2">
                      <div className="flex items-center gap-3 px-3 py-2 rounded-t-xl mb-0.5"
                        style={{ background: ss.bg }}>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                          style={{ background: ss.pillBg, color: ss.color }}>{sl}</span>
                        <span className="text-[10px] text-slate-400">{slShifts.length} กะ · รถเข้า {slTotal.ins} · ออก {slTotal.outs}</span>
                        <div className="ml-auto flex items-center gap-3">
                          <span className="text-[10px] text-slate-500">สด ฿{slTotal.cash}</span>
                          <span className="text-[10px] text-slate-500">โอน ฿{slTotal.qr}</span>
                          <span className="text-xs font-black" style={{ color: '#059669' }}>รวม ฿{slTotal.total}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        {slShifts.map(s => <ShiftItem key={s._id} shift={s} />)}
                      </div>
                    </div>
                  )
                })}

                {/* Day total bar */}
                <div className="mt-2 px-4 py-3 rounded-xl flex items-center gap-4"
                  style={{ background: 'rgba(5,150,105,0.07)', border: '1px solid rgba(5,150,105,0.18)' }}>
                  <p className="text-xs font-black text-emerald-700 shrink-0">รวมทั้งวัน</p>
                  <div className="flex-1 flex items-center gap-4 text-xs text-slate-600">
                    <span>รถเข้า <strong className="text-slate-800">{dayTotal.ins}</strong></span>
                    <span>รถออก <strong className="text-slate-800">{dayTotal.outs}</strong></span>
                    <span>สด <strong>฿{dayTotal.cash}</strong></span>
                    <span>โอน <strong>฿{dayTotal.qr}</strong></span>
                  </div>
                  <p className="text-base font-black shrink-0" style={{ color: '#059669' }}>฿{dayTotal.total}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════ */
export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchShifts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo)   params.set('dateTo', dateTo)
      const res = await fetch(`/api/shifts?${params}`)
      const data = await res.json()
      setShifts(data.shifts ?? [])
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => { fetchShifts() }, [fetchShifts])

  /* จัดกลุ่มรายคน */
  const groups = Object.values(
    shifts.reduce<Record<string, OperatorGroup>>((acc, s) => {
      if (!acc[s.operatorId]) {
        acc[s.operatorId] = {
          operatorId:     s.operatorId,
          operatorName:   s.operatorName,
          shifts:         [],
          totalCheckins:  0,
          totalCheckouts: 0,
          totalCash:      0,
          totalQr:        0,
          totalAmount:    0,
          hasActive:      false,
        }
      }
      const g = acc[s.operatorId]
      g.shifts.push(s)
      g.totalCheckins  += s.checkinsCount
      g.totalCheckouts += s.checkoutsCount
      g.totalCash      += s.cashAmount
      g.totalQr        += s.qrAmount
      g.totalAmount    += s.totalAmount
      if (s.status === 'active') g.hasActive = true
      return acc
    }, {})
  ).sort((a, b) => {
    // คนที่ทำงานอยู่ขึ้นก่อน ตามด้วย sort ตามชื่อ
    if (a.hasActive !== b.hasActive) return a.hasActive ? -1 : 1
    return a.operatorName.localeCompare(b.operatorName, 'th')
  })

  /* Summary ทั้งหมด */
  const grand = shifts.reduce((acc, s) => ({
    ins:          acc.ins          + s.checkinsCount,
    outs:         acc.outs         + s.checkoutsCount,
    cash:         acc.cash         + s.cashAmount,
    qr:           acc.qr           + s.qrAmount,
    total:        acc.total        + s.totalAmount,
    opening:      acc.opening      + (s.openingFloat    ?? 0),
    closing:      acc.closing      + (s.closingFloat    ?? 0),
    carryover:    acc.carryover    + (s.carryoverCars   ?? 0),
    closingCars:  acc.closingCars  + (s.closingCarCount ?? 0),
  }), { ins: 0, outs: 0, cash: 0, qr: 0, total: 0, opening: 0, closing: 0, carryover: 0, closingCars: 0 })

  return (
    <>
      {/* Header */}
      <header className="shrink-0 h-14 bg-white flex items-center justify-between px-6"
        style={{ borderBottom: '1px solid #E8ECF4' }}>
        <div className="flex items-center gap-3">
          <div className="size-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(29,78,216,0.08)' }}>
            <Clock className="size-3.5" style={{ color: '#1D4ED8' }} />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900">รายงานกะ</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">สรุปยอดรายคน · แต่ละกะ · รายรถ</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="size-3.5 text-slate-400" />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="h-8 px-2 text-xs rounded-lg outline-none text-slate-700"
            style={{ border: '1px solid #E2E8F0', background: '#F8FAFF' }} />
          <span className="text-slate-400 text-xs">—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="h-8 px-2 text-xs rounded-lg outline-none text-slate-700"
            style={{ border: '1px solid #E2E8F0', background: '#F8FAFF' }} />
          <button onClick={fetchShifts}
            className="size-8 rounded-lg flex items-center justify-center"
            style={{ background: '#F1F5F9', border: '1px solid #E2E8F0' }}>
            <RefreshCw className={`size-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">

        {/* ══ Grand Total Panel ══ */}
        <div className="shrink-0 rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 60%, #1D4ED8 100%)', boxShadow: '0 4px 24px rgba(29,78,216,0.25)' }}>

          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div>
              <p className="text-white font-black text-base">สรุปรวมทุกกะ</p>
              <p className="text-blue-300 text-xs mt-0.5">
                {groups.length} operator · {shifts.length} กะ
                {(dateFrom || dateTo) && ` · ช่วงวันที่เลือก`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-blue-300 text-[10px] font-semibold uppercase tracking-widest">รายได้รวมทั้งสิ้น</p>
              <p className="text-white font-black text-3xl tabular-nums">฿{grand.total.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-6 divide-x divide-white/10">
            {[
              { label: 'รถเข้า',      value: grand.ins,                       unit: 'คัน', icon: LogIn,    dim: false },
              { label: 'รถออก',       value: grand.outs,                      unit: 'คัน', icon: LogOut,   dim: false },
              { label: 'เงินสด',      value: `฿${grand.cash.toLocaleString()}`, unit: '',   icon: Banknote, dim: false },
              { label: 'โอนเงิน',    value: `฿${grand.qr.toLocaleString()}`,   unit: '',   icon: Smartphone, dim: false },
              { label: 'ต้นกะรวม',   value: `฿${grand.opening.toLocaleString()}`, unit: '', icon: Banknote, dim: true },
              { label: 'ส่ง till รวม', value: `฿${grand.closing.toLocaleString()}`, unit: '', icon: Banknote, dim: true },
            ].map(({ label, value, unit, icon: Icon, dim }) => (
              <div key={label} className="px-4 py-3 text-center">
                <p className={`text-[10px] font-semibold ${dim ? 'text-blue-400/60' : 'text-blue-300'}`}>{label}</p>
                <p className={`text-base font-black mt-0.5 tabular-nums ${dim ? 'text-white/50' : 'text-white'}`}>
                  {value}{unit && <span className="text-xs ml-0.5">{unit}</span>}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Grouped by operator */}
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <RefreshCw className="size-5 text-slate-300 animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-slate-300">ไม่พบข้อมูลกะ</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map(g => <OperatorCard key={g.operatorId} group={g} />)}
          </div>
        )}
      </div>
    </>
  )
}
