'use client'

import { useEffect, useState, useCallback } from 'react'
import { History, Search, RefreshCw, Car, Bike, Moon, ArrowDownLeft, ArrowUpRight, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'

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
  car:        { label: 'รถยนต์',       icon: Car,  color: '#1D4ED8', bg: 'rgba(29,78,216,0.07)'  },
  motorcycle: { label: 'มอเตอร์ไซค์', icon: Bike, color: '#3B82F6', bg: 'rgba(59,130,246,0.07)' },
  overnight:  { label: 'ค้างคืน',     icon: Moon, color: '#F59E0B', bg: 'rgba(245,158,11,0.07)' },
}

const STATUS_META: Record<SessionStatus, { label: string; color: string; bg: string }> = {
  active:    { label: 'จอดอยู่', color: '#059669', bg: 'rgba(16,185,129,0.08)'  },
  completed: { label: 'เสร็จสิ้น', color: '#1D4ED8', bg: 'rgba(29,78,216,0.07)' },
  lost:      { label: 'บัตรหาย', color: '#D97706', bg: 'rgba(245,158,11,0.08)'  },
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtDur(min: number) {
  if (!min) return '—'
  const h = Math.floor(min / 60), m = min % 60
  return h > 0 ? `${h}ชม. ${m}น.` : `${m}น.`
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [page,     setPage]     = useState(1)
  const [search,   setSearch]   = useState('')
  const [status,   setStatus]   = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')

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

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <>
      <header className="shrink-0 h-14 bg-white flex items-center justify-between px-6"
        style={{ borderBottom: '1px solid #E8ECF4' }}>
        <div className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded-lg"
            style={{ background: 'rgba(29,78,216,0.08)' }}>
            <History className="size-3.5" style={{ color: '#1D4ED8' }} />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 leading-none">ประวัติการจอด</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">บันทึกรถเข้า-ออกทั้งหมด</p>
          </div>
        </div>
        <button onClick={fetchSessions}
          className="size-8 rounded-lg flex items-center justify-center transition-colors"
          style={{ background: '#F1F5F9' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#E2E8F0' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#F1F5F9' }}>
          <RefreshCw className={`size-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="flex-1 flex flex-col gap-4 p-5 overflow-hidden min-h-0">

        {/* Filters */}
        <div className="shrink-0 flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="size-3 text-slate-400 absolute left-3 top-2.5" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="ค้นหาทะเบียน 4 หลัก..."
              className="h-9 pl-8 pr-3 rounded-xl text-xs text-slate-700 outline-none w-48"
              style={{ background: 'white', border: '1px solid #E8ECF4' }} />
          </div>
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
            className="h-9 px-3 rounded-xl text-xs text-slate-700 outline-none"
            style={{ background: 'white', border: '1px solid #E8ECF4' }}>
            <option value="">ทุกสถานะ</option>
            <option value="active">จอดอยู่</option>
            <option value="completed">เสร็จสิ้น</option>
            <option value="lost">บัตรหาย</option>
          </select>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
            className="h-9 px-3 rounded-xl text-xs text-slate-700 outline-none"
            style={{ background: 'white', border: '1px solid #E8ECF4' }} />
          <span className="text-slate-300 text-xs">–</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
            className="h-9 px-3 rounded-xl text-xs text-slate-700 outline-none"
            style={{ background: 'white', border: '1px solid #E8ECF4' }} />
          {(search || status || dateFrom || dateTo) && (
            <button onClick={() => { setSearch(''); setStatus(''); setDateFrom(''); setDateTo(''); setPage(1) }}
              className="h-9 px-3 rounded-xl text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100">
              ล้างตัวกรอง
            </button>
          )}
          <span className="ml-auto text-xs text-slate-400">{total} รายการ</span>
        </div>

        {/* Table */}
        <div className="flex-1 bg-white rounded-2xl overflow-hidden flex flex-col min-h-0"
          style={{ border: '1px solid #E8ECF4' }}>

          {/* Table header */}
          <div className="shrink-0 grid text-[10px] font-black text-slate-400 uppercase tracking-widest px-5 py-3"
            style={{ gridTemplateColumns: '2fr 1fr 1fr 1.5fr 1.5fr 1fr 1fr', borderBottom: '1px solid #E8ECF4' }}>
            <span>ทะเบียน / UID</span>
            <span>ประเภท</span>
            <span>สถานะ</span>
            <span>เวลาเข้า</span>
            <span>เวลาออก</span>
            <span>ระยะเวลา</span>
            <span className="text-right">ค่าบริการ</span>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <RefreshCw className="size-5 text-slate-300 animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <History className="size-8 text-slate-200" />
              <p className="text-sm text-slate-400">ไม่พบข้อมูลที่ค้นหา</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {sessions.map((s, i) => {
                const tm = TYPE_META[s.cardType]
                const sm = STATUS_META[s.status]
                const TypeIcon = tm.icon
                const EntryIcon = s.status === 'active' ? ArrowDownLeft : ArrowUpRight
                return (
                  <div key={s._id}
                    className="grid items-center px-5 py-3 text-xs"
                    style={{
                      gridTemplateColumns: '2fr 1fr 1fr 1.5fr 1.5fr 1fr 1fr',
                      borderBottom: i < sessions.length - 1 ? '1px solid #F8FAFF' : 'none',
                    }}>
                    {/* Plate */}
                    <div className="flex items-center gap-2.5">
                      <div className="size-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: tm.bg }}>
                        <TypeIcon className="size-3.5" style={{ color: tm.color }} strokeWidth={1.75} />
                      </div>
                      <div>
                        <p className="font-black text-slate-800 text-sm">{s.plate}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{s.cardUid === 'LOST' ? '— บัตรหาย —' : s.cardUid}</p>
                      </div>
                    </div>
                    {/* Type */}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full w-fit"
                      style={{ background: tm.bg, color: tm.color }}>{tm.label}</span>
                    {/* Status */}
                    <div className="flex items-center gap-1">
                      {s.status === 'lost' && <AlertTriangle className="size-3" style={{ color: '#D97706' }} />}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
                    </div>
                    {/* Entry */}
                    <div className="flex items-center gap-1.5">
                      <ArrowDownLeft className="size-3 shrink-0" style={{ color: '#10B981' }} />
                      <span className="text-slate-600">{fmt(s.entryTime)}</span>
                    </div>
                    {/* Exit */}
                    <div className="flex items-center gap-1.5">
                      {s.exitTime
                        ? <><EntryIcon className="size-3 shrink-0" style={{ color: '#64748B' }} /><span className="text-slate-600">{fmt(s.exitTime)}</span></>
                        : <span className="text-slate-300">—</span>
                      }
                    </div>
                    {/* Duration */}
                    <span className="text-slate-600">{fmtDur(s.durationMin)}</span>
                    {/* Fee */}
                    <div className="text-right">
                      <p className="font-black text-slate-800">฿{s.totalFee}</p>
                      {s.lostFine > 0 && <p className="text-[10px]" style={{ color: '#D97706' }}>+฿{s.lostFine} ค่าปรับ</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="shrink-0 flex items-center justify-between px-5 py-3"
              style={{ borderTop: '1px solid #E8ECF4' }}>
              <span className="text-xs text-slate-400">หน้า {page} จาก {totalPages}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="size-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-30 transition-colors">
                  <ChevronLeft className="size-3.5" />
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="size-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-30 transition-colors">
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
