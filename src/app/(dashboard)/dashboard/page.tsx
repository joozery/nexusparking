'use client'

import { useEffect, useState } from 'react'
import { LayoutDashboard, Car, CircleParking, BadgeDollarSign, TrendingUp, RefreshCw, Clock, ArrowDownLeft, ArrowUpRight, AlertTriangle } from 'lucide-react'

interface Stats {
  activeCars: number
  availableSlots: number
  totalCapacity: number
  todayEntries: number
  todayRevenue: number
}

interface Session {
  _id: string
  plate: string
  cardType: 'car' | 'motorcycle' | 'overnight'
  entryTime: string
  status: 'active' | 'completed' | 'lost'
  totalFee: number
}

export default function DashboardPage() {
  const [stats,   setStats]   = useState<Stats | null>(null)
  const [recent,  setRecent]  = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchAll() {
    setLoading(true)
    try {
      const [sRes, rRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/sessions?limit=8'),
      ])
      setStats(await sRes.json())
      const d = await rRes.json()
      setRecent(d.sessions ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const occupancyPct = stats ? Math.round((stats.activeCars / stats.totalCapacity) * 100) : 0

  return (
    <>
      <header className="shrink-0 h-14 bg-white flex items-center justify-between px-6"
        style={{ borderBottom: '1px solid #E8ECF4' }}>
        <div className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded-lg"
            style={{ background: 'rgba(29,78,216,0.08)' }}>
            <LayoutDashboard className="size-3.5" style={{ color: '#1D4ED8' }} />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 leading-none">ภาพรวมระบบ</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        <button onClick={fetchAll}
          className="size-8 rounded-lg flex items-center justify-center transition-colors"
          style={{ background: '#F1F5F9' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#E2E8F0' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#F1F5F9' }}>
          <RefreshCw className={`size-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="flex-1 flex flex-col gap-4 p-5 overflow-auto">

        {/* KPI */}
        <div className="shrink-0 grid grid-cols-4 gap-3">
          {[
            { label: 'รถในลานตอนนี้', value: stats?.activeCars,       sub: `จาก ${stats?.totalCapacity ?? 200} คัน`, icon: Car,            iconBg: 'rgba(29,78,216,0.1)',  iconColor: '#1D4ED8', bar: true  },
            { label: 'ที่จอดว่าง',    value: stats?.availableSlots,   sub: `${100 - occupancyPct}% ว่าง`,          icon: CircleParking,   iconBg: 'rgba(16,185,129,0.1)', iconColor: '#10B981', bar: false },
            { label: 'รายได้วันนี้',  value: stats ? `฿${stats.todayRevenue.toLocaleString()}` : undefined, sub: 'ยอดสะสม', icon: BadgeDollarSign, iconBg: 'rgba(16,185,129,0.1)', iconColor: '#10B981', bar: false },
            { label: 'รถเข้าวันนี้',  value: stats?.todayEntries,     sub: 'รายการทั้งหมด',                        icon: TrendingUp,      iconBg: 'rgba(245,158,11,0.1)', iconColor: '#F59E0B', bar: false },
          ].map(({ label, value, sub, icon: Icon, iconBg, iconColor, bar }) => (
            <div key={label} className="bg-white rounded-2xl px-4 py-4 flex items-center gap-3.5"
              style={{ border: '1px solid #E8ECF4' }}>
              <div className="size-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: iconBg }}>
                <Icon className="size-5" style={{ color: iconColor }} strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-slate-400 truncate">{label}</p>
                <p className="text-2xl font-black text-slate-900 leading-tight">{value ?? '—'}</p>
                {bar ? (
                  <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${occupancyPct}%`, background: iconColor }} />
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400">{sub}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Lower row */}
        <div className="flex gap-4 flex-1 min-h-0">

          {/* Capacity gauge */}
          <div className="w-64 shrink-0 bg-white rounded-2xl p-5 flex flex-col"
            style={{ border: '1px solid #E8ECF4' }}>
            <p className="text-xs font-black text-slate-700 mb-4">ความจุลานจอด</p>
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="relative size-36">
                <svg className="size-36 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" strokeWidth="10" stroke="#F1F5F9" />
                  <circle cx="60" cy="60" r="50" fill="none" strokeWidth="10"
                    stroke="#1D4ED8" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 50}`}
                    strokeDashoffset={`${2 * Math.PI * 50 * (1 - occupancyPct / 100)}`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-slate-900">{occupancyPct}%</span>
                  <span className="text-[10px] text-slate-400 font-semibold">ใช้งาน</span>
                </div>
              </div>
              <div className="w-full grid grid-cols-2 gap-2">
                <div className="text-center py-2.5 rounded-xl" style={{ background: 'rgba(29,78,216,0.06)' }}>
                  <p className="text-xl font-black" style={{ color: '#1D4ED8' }}>{stats?.activeCars ?? '—'}</p>
                  <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">ใช้งาน</p>
                </div>
                <div className="text-center py-2.5 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)' }}>
                  <p className="text-xl font-black" style={{ color: '#10B981' }}>{stats?.availableSlots ?? '—'}</p>
                  <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">ว่าง</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent activity */}
          <div className="flex-1 bg-white rounded-2xl overflow-hidden flex flex-col"
            style={{ border: '1px solid #E8ECF4' }}>
            <div className="shrink-0 px-5 py-3.5 flex items-center justify-between"
              style={{ borderBottom: '1px solid #E8ECF4' }}>
              <p className="text-xs font-black text-slate-700">กิจกรรมล่าสุด</p>
              <a href="/history" className="text-[10px] font-bold hover:underline" style={{ color: '#1D4ED8' }}>
                ดูทั้งหมด →
              </a>
            </div>
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <RefreshCw className="size-4 text-slate-300 animate-spin" />
              </div>
            ) : recent.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-slate-300">ยังไม่มีข้อมูล</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto scrollbar-hide">
                {recent.map((s, i) => {
                  const isActive = s.status === 'active'
                  const isLost   = s.status === 'lost'
                  return (
                    <div key={s._id} className="flex items-center gap-3.5 px-5 py-3"
                      style={i < recent.length - 1 ? { borderBottom: '1px solid #F8FAFF' } : {}}>
                      <div className="size-7 rounded-lg flex items-center justify-center shrink-0"
                        style={isLost ? { background: 'rgba(245,158,11,0.08)' } : isActive ? { background: 'rgba(16,185,129,0.08)' } : { background: 'rgba(29,78,216,0.07)' }}>
                        {isLost
                          ? <AlertTriangle className="size-3.5" style={{ color: '#F59E0B' }} />
                          : isActive
                          ? <ArrowDownLeft className="size-3.5" style={{ color: '#10B981' }} />
                          : <ArrowUpRight className="size-3.5" style={{ color: '#1D4ED8' }} />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-800">{s.plate}</p>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="size-2.5" />
                          {new Date(s.entryTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                          {' · '}
                          {s.cardType === 'car' ? 'รถยนต์' : s.cardType === 'motorcycle' ? 'มอเตอร์ไซค์' : 'ค้างคืน'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-slate-800">฿{s.totalFee}</p>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={isLost ? { background: 'rgba(245,158,11,0.1)', color: '#D97706' } : isActive ? { background: 'rgba(16,185,129,0.08)', color: '#059669' } : { background: 'rgba(29,78,216,0.07)', color: '#1D4ED8' }}>
                          {isLost ? 'บัตรหาย' : isActive ? 'จอดอยู่' : 'เสร็จสิ้น'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
