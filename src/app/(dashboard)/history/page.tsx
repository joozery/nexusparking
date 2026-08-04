'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  History, Search, RefreshCw, Car, Bike, Moon,
  ArrowDownLeft, ArrowUpRight, AlertTriangle,
  ChevronLeft, ChevronRight, Trash2, X, Check,
  Clock, BadgeDollarSign, CircleParking, Filter,
} from 'lucide-react'

type CardType = 'car' | 'motorcycle' | 'overnight'
type SessionStatus = 'active' | 'completed' | 'lost'

interface Session {
  _id: string
  cardUid: string
  cardType: CardType
  plate: string
  entryTime: string
  exitTime?: string
  durationMin: number
  fee: number
  lostFine: number
  totalFee: number
  status: SessionStatus
}

const TYPE_META: Record<CardType, { label: string; icon: typeof Car; color: string; bg: string }> = {
  car:        { label: 'รถยนต์',       icon: Car,  color: '#1D4ED8', bg: 'rgba(29,78,216,0.08)'  },
  motorcycle: { label: 'มอเตอร์ไซค์', icon: Bike, color: '#0891B2', bg: 'rgba(8,145,178,0.08)'  },
  overnight:  { label: 'ค้างคืน',     icon: Moon, color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
}

const STATUS_META: Record<SessionStatus, { label: string; color: string; bg: string; dot: string }> = {
  active:    { label: 'จอดอยู่',   color: '#059669', bg: 'rgba(5,150,105,0.08)',   dot: '#22C55E' },
  completed: { label: 'เสร็จสิ้น', color: '#1D4ED8', bg: 'rgba(29,78,216,0.07)',   dot: '#3B82F6' },
  lost:      { label: 'บัตรหาย',   color: '#D97706', bg: 'rgba(245,158,11,0.08)',  dot: '#F59E0B' },
}

const STATUS_TABS = [
  { key: '',          label: 'ทั้งหมด'  },
  { key: 'active',    label: 'จอดอยู่'  },
  { key: 'completed', label: 'เสร็จสิ้น' },
  { key: 'lost',      label: 'บัตรหาย'  },
] as const

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}
function fmtDur(min: number) {
  if (!min) return '—'
  const h = Math.floor(min / 60), m = min % 60
  return h > 0 ? `${h}ชม. ${m}น.` : `${m}น.`
}

export default function HistoryPage() {
  const [sessions,  setSessions]  = useState<Session[]>([])
  const [total,     setTotal]     = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [page,      setPage]      = useState(1)
  const [search,    setSearch]    = useState('')
  const [status,    setStatus]    = useState('')
  const [dateFrom,  setDateFrom]  = useState('')
  const [dateTo,    setDateTo]    = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleting,  setDeleting]  = useState<string | null>(null)
  const [showDate,  setShowDate]  = useState(false)

  const LIMIT = 20

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), page: String(page) })
      if (status)   params.set('status',   status)
      if (search)   params.set('plate',    search)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo)   params.set('dateTo',   dateTo)
      const res  = await fetch(`/api/sessions?${params}`)
      const data = await res.json()
      setSessions(data.sessions ?? [])
      setTotal(data.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page, status, search, dateFrom, dateTo])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
      setSessions(prev => prev.filter(s => s._id !== id))
      setTotal(t => t - 1)
    } finally {
      setDeleting(null)
      setConfirmId(null)
    }
  }

  const totalPages = Math.ceil(total / LIMIT)
  const hasFilter  = !!(search || status || dateFrom || dateTo)

  const countActive    = sessions.filter(s => s.status === 'active').length
  const countCompleted = sessions.filter(s => s.status === 'completed').length
  const countLost      = sessions.filter(s => s.status === 'lost').length
  const totalRevenue   = sessions.filter(s => s.status !== 'active').reduce((a, s) => a + s.totalFee, 0)

  return (
    <>
      {/* ── HEADER ── */}
      <header className="shrink-0 bg-white" style={{ borderBottom: '1px solid #E8ECF4' }}>
        <div className="flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-3">
            <div className="flex size-7 items-center justify-center rounded-lg"
              style={{ background: 'rgba(29,78,216,0.08)' }}>
              <History className="size-3.5" style={{ color: '#1D4ED8' }} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-none">ประวัติการจอด</h1>
              <p className="text-[10px] text-slate-400 mt-0.5">{total} รายการทั้งหมด</p>
            </div>
          </div>
          <button onClick={fetchSessions}
            className="size-8 rounded-lg flex items-center justify-center transition-colors hover:bg-slate-100">
            <RefreshCw className={`size-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* ── FILTER BAR ── */}
        <div className="px-6 pb-3 flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="size-3 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="ค้นหาทะเบียน..."
              className="h-8 pl-8 pr-3 rounded-lg text-xs text-slate-700 outline-none w-44"
              style={{ background: '#F8FAFF', border: '1px solid #E8ECF4' }}
              onFocus={e => e.currentTarget.style.borderColor = '#1D4ED8'}
              onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'}
            />
          </div>

          {/* Status tabs */}
          <div className="flex items-center rounded-lg p-0.5 gap-0.5" style={{ background: '#F1F5F9' }}>
            {STATUS_TABS.map(t => (
              <button key={t.key}
                onClick={() => { setStatus(t.key); setPage(1) }}
                className="h-7 px-3 rounded-md text-[11px] font-semibold transition-all"
                style={status === t.key
                  ? { background: 'white', color: '#1D4ED8', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
                  : { color: '#94A3B8' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Date range toggle */}
          <button
            onClick={() => setShowDate(v => !v)}
            className="h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            style={showDate || dateFrom || dateTo
              ? { background: 'rgba(29,78,216,0.08)', color: '#1D4ED8', border: '1px solid rgba(29,78,216,0.2)' }
              : { background: '#F8FAFF', color: '#94A3B8', border: '1px solid #E8ECF4' }}>
            <Filter className="size-3" />
            {dateFrom && dateTo ? `${dateFrom} – ${dateTo}` : 'ช่วงวันที่'}
          </button>

          {showDate && (
            <>
              <input type="date" value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(1) }}
                className="h-8 px-3 rounded-lg text-xs text-slate-700 outline-none"
                style={{ background: '#F8FAFF', border: '1px solid #E8ECF4' }} />
              <span className="text-slate-300 text-xs">–</span>
              <input type="date" value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPage(1) }}
                className="h-8 px-3 rounded-lg text-xs text-slate-700 outline-none"
                style={{ background: '#F8FAFF', border: '1px solid #E8ECF4' }} />
            </>
          )}

          {hasFilter && (
            <button
              onClick={() => { setSearch(''); setStatus(''); setDateFrom(''); setDateTo(''); setPage(1); setShowDate(false) }}
              className="h-8 px-2.5 rounded-lg text-xs font-semibold text-slate-400 flex items-center gap-1 hover:bg-slate-100 transition-colors">
              <X className="size-3" /> ล้าง
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-slate-50/60">

        {/* ── SUMMARY STRIP ── */}
        <div className="shrink-0 grid grid-cols-4 gap-3 px-5 pt-4 pb-3">
          {[
            { label: 'ในลานตอนนี้', value: countActive,    icon: CircleParking,   color: '#059669', bg: 'rgba(5,150,105,0.08)'  },
            { label: 'เสร็จสิ้น',   value: countCompleted, icon: ArrowUpRight,    color: '#1D4ED8', bg: 'rgba(29,78,216,0.08)'  },
            { label: 'บัตรหาย',     value: countLost,      icon: AlertTriangle,   color: '#D97706', bg: 'rgba(245,158,11,0.08)' },
            { label: 'รายได้ (หน้านี้)', value: `฿${totalRevenue.toLocaleString('th-TH')}`, icon: BadgeDollarSign, color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ border: '1px solid #E8ECF4' }}>
              <div className="size-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: bg }}>
                <Icon className="size-4" style={{ color }} strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-[10px] text-slate-400">{label}</p>
                <p className="text-base font-bold text-slate-900 leading-tight">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── LIST ── */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 scrollbar-hide">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw className="size-5 text-slate-300 animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 bg-white rounded-xl"
              style={{ border: '1px solid #E8ECF4' }}>
              <History className="size-8 text-slate-200" />
              <p className="text-sm text-slate-400">ไม่พบข้อมูลที่ค้นหา</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => {
                const tm = TYPE_META[s.cardType]
                const sm = STATUS_META[s.status]
                const TypeIcon = tm.icon
                const isConfirm = confirmId === s._id

                return (
                  <div key={s._id}
                    className="bg-white rounded-xl overflow-hidden flex group transition-shadow hover:shadow-sm"
                    style={{
                      border: `1px solid ${isConfirm ? 'rgba(220,38,38,0.25)' : '#E8ECF4'}`,
                      background: isConfirm ? 'rgba(220,38,38,0.02)' : 'white',
                    }}>

                    {/* Left status stripe */}
                    <div className="w-1 shrink-0" style={{ background: sm.dot }} />

                    <div className="flex-1 flex items-center gap-4 px-4 py-3 min-w-0">

                      {/* Icon + Plate */}
                      <div className="flex items-center gap-3 w-36 shrink-0">
                        <div className="size-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: tm.bg }}>
                          <TypeIcon className="size-4" style={{ color: tm.color }} strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{s.plate}</p>
                          <p className="text-[10px] text-slate-400 font-mono truncate">
                            {s.cardUid.startsWith('WALKIN') ? 'Walk-in' : s.cardUid.slice(0, 10)}
                          </p>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5 w-40 shrink-0">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: tm.bg, color: tm.color }}>{tm.label}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
                          style={{ background: sm.bg, color: sm.color }}>
                          {s.status === 'lost' && <AlertTriangle className="size-2.5" />}
                          {sm.label}
                        </span>
                      </div>

                      {/* Timeline: entry → exit */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="text-center">
                          <p className="text-[10px] text-slate-400">เข้า</p>
                          <p className="text-xs font-semibold text-slate-700">{fmtTime(s.entryTime)}</p>
                          <p className="text-[10px] text-slate-400">{fmtDate(s.entryTime)}</p>
                        </div>
                        <div className="flex-1 flex items-center gap-1 min-w-0">
                          <div className="size-1.5 rounded-full shrink-0" style={{ background: '#10B981' }} />
                          <div className="flex-1 border-t border-dashed" style={{ borderColor: '#E2E8F0' }} />
                          {s.durationMin > 0 && (
                            <span className="text-[9px] text-slate-400 shrink-0 flex items-center gap-0.5">
                              <Clock className="size-2.5" />{fmtDur(s.durationMin)}
                            </span>
                          )}
                          <div className="flex-1 border-t border-dashed" style={{ borderColor: '#E2E8F0' }} />
                          <div className="size-1.5 rounded-full shrink-0"
                            style={{ background: s.exitTime ? '#64748B' : '#E2E8F0' }} />
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-slate-400">ออก</p>
                          {s.exitTime ? (
                            <>
                              <p className="text-xs font-semibold text-slate-700">{fmtTime(s.exitTime)}</p>
                              <p className="text-[10px] text-slate-400">{fmtDate(s.exitTime)}</p>
                            </>
                          ) : (
                            <p className="text-xs text-slate-300">—</p>
                          )}
                        </div>
                      </div>

                      {/* Fee */}
                      <div className="text-right w-20 shrink-0">
                        <p className="text-sm font-bold text-slate-900">฿{s.totalFee.toLocaleString('th-TH')}</p>
                        {s.lostFine > 0 && (
                          <p className="text-[10px]" style={{ color: '#D97706' }}>+฿{s.lostFine} ค่าปรับ</p>
                        )}
                        {s.status === 'active' && (
                          <p className="text-[10px] text-slate-400">กำลังจอด</p>
                        )}
                      </div>

                      {/* Delete */}
                      <div className="w-14 shrink-0 flex items-center justify-end">
                        {isConfirm ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(s._id)}
                              disabled={deleting === s._id}
                              className="size-7 rounded-md flex items-center justify-center transition-colors"
                              style={{ background: '#DC2626', color: 'white' }}>
                              {deleting === s._id
                                ? <RefreshCw className="size-3 animate-spin" />
                                : <Check className="size-3" />}
                            </button>
                            <button
                              onClick={() => setConfirmId(null)}
                              className="size-7 rounded-md flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-400">
                              <X className="size-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmId(s._id)}
                            className="size-7 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50"
                            style={{ color: '#DC2626' }}>
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── PAGINATION ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-slate-400">หน้า {page} จาก {totalPages} · {total} รายการ</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="size-8 rounded-lg flex items-center justify-center text-slate-500 transition-colors disabled:opacity-30"
                  style={{ background: 'white', border: '1px solid #E8ECF4' }}>
                  <ChevronLeft className="size-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className="size-8 rounded-lg flex items-center justify-center text-xs font-semibold transition-all"
                      style={p === page
                        ? { background: '#1D4ED8', color: 'white', border: '1px solid #1D4ED8' }
                        : { background: 'white', color: '#64748B', border: '1px solid #E8ECF4' }}>
                      {p}
                    </button>
                  )
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="size-8 rounded-lg flex items-center justify-center text-slate-500 transition-colors disabled:opacity-30"
                  style={{ background: 'white', border: '1px solid #E8ECF4' }}>
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
