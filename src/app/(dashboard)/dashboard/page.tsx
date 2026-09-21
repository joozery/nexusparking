'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Pie, PieChart, Cell } from 'recharts'
import {
  LayoutDashboard, Car, Bike, Moon, BadgeDollarSign, TrendingUp,
  RefreshCw, Clock, ArrowDownLeft, ArrowUpRight, AlertTriangle,
  CircleParking, CreditCard, History, BarChart2, DoorOpen, Settings,
  Banknote, Smartphone, Wallet,
} from 'lucide-react'
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

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
  todayRevenueByMethod: { cash: number; qr: number; other: number }
  todayEntriesByType: { car: number; motorcycle: number; overnightCar: number; overnightMotorcycle: number }
}

interface Session {
  _id: string
  plate: string
  cardType: 'car' | 'motorcycle' | 'overnight'
  entryTime: string
  status: 'active' | 'completed' | 'lost'
  totalFee: number
}

const TYPE_ICON: Record<string, typeof Car> = { car: Car, motorcycle: Bike, overnight: Moon }
const TYPE_LABEL: Record<string, string>   = { car: 'รถยนต์', motorcycle: 'รถจักรยานยนต์', overnight: 'ค้างคืน' }

const QUICK_LINKS = [
  { href: '/gate',    icon: DoorOpen,       label: 'เกท / เช็คอิน',  sub: 'รับรถเข้า-ออก',    color: '#A16207', bg: 'rgba(161,98,7,0.08)'  },
  { href: '/cards',   icon: CreditCard,     label: 'จัดการบัตร',     sub: 'เพิ่ม / ปิดใช้งาน', color: '#0891B2', bg: 'rgba(8,145,178,0.08)'  },
  { href: '/history', icon: History,        label: 'ประวัติ',         sub: 'ค้นหา-ลบ session',  color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
  { href: '/reports', icon: BarChart2,      label: 'รายงาน',          sub: 'รายได้รายวัน/เดือน', color: '#059669', bg: 'rgba(5,150,105,0.08)'  },
  { href: '/settings',icon: Settings,       label: 'ตั้งค่า',         sub: 'ฮาร์ดแวร์ / ระบบ',  color: '#D97706', bg: 'rgba(217,119,6,0.08)'  },
]

const REVENUE_METHOD_META = {
  cash:  { label: 'เงินสด',  icon: Banknote,    color: '#A16207' },
  qr:    { label: 'เงินโอน', icon: Smartphone,  color: '#0891B2' },
  other: { label: 'อื่นๆ',   icon: Wallet,      color: '#94A3B8' },
} as const

const entryTypeChartConfig = {
  car:                 { label: 'รถยนต์',            color: '#A16207' },
  motorcycle:          { label: 'รถจักรยานยนต์',        color: '#0891B2' },
  overnightCar:        { label: 'ค้างคืนรถยนต์',      color: '#CA8A04' },
  overnightMotorcycle: { label: 'ค้างคืนรถจักรยานยนต์', color: '#7C3AED' },
} satisfies ChartConfig

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

export default function DashboardPage() {
  const [stats,   setStats]   = useState<Stats | null>(null)
  const [recent,  setRecent]  = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [tick,    setTick]    = useState(new Date())

  async function fetchAll() {
    setLoading(true)
    try {
      const [sRes, rRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/sessions?limit=10'),
      ])
      setStats(await sRes.json())
      const d = await rRes.json()
      setRecent(d.sessions ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
    // auto-refresh every 30 s
    const id = setInterval(() => { fetchAll(); setTick(new Date()) }, 30000)
    return () => clearInterval(id)
  }, [])

  const occupancyPct = stats
    ? Math.min(100, Math.round((stats.activeCars / stats.totalCapacity) * 100))
    : 0

  const occupancyColor =
    occupancyPct >= 85 ? '#DC2626' :
    occupancyPct >= 60 ? '#D97706' :
    '#059669'

  const occupancyGrad =
    occupancyPct >= 85 ? 'linear-gradient(135deg,#7F1D1D,#DC2626)' :
    occupancyPct >= 60 ? 'linear-gradient(135deg,#78350F,#D97706)' :
    'linear-gradient(135deg,#064E3B,#059669)'

  const todayDate = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const entryTypeData = (Object.keys(entryTypeChartConfig) as (keyof typeof entryTypeChartConfig)[])
    .map(key => ({ key, value: stats?.todayEntriesByType[key] ?? 0 }))
    .filter(d => d.value > 0)
  const totalEntriesToday = entryTypeData.reduce((sum, d) => sum + d.value, 0)

  return (
    <>
      {/* ── HEADER ── */}
      <header className="shrink-0 bg-white" style={{ borderBottom: '1px solid #E8ECF4' }}>
        <div className="flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-3">
            <div className="size-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(161,98,7,0.08)' }}>
              <LayoutDashboard className="size-3.5" style={{ color: '#A16207' }} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-none">ภาพรวมระบบ</h1>
              <p className="text-[10px] text-slate-400 mt-0.5">{todayDate}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="size-1.5 rounded-full bg-green-400 animate-pulse" />
              {tick.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <button onClick={fetchAll}
              className="size-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors">
              <RefreshCw className={`size-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto bg-slate-50/60">
        <div className="p-5 space-y-4">

          {/* ── OCCUPANCY HERO ── */}
          <div className="rounded-xl p-5 text-white relative overflow-hidden"
            style={{ backgroundImage: 'url(/coverbgda.png)', backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
            {/* overlay gradient for readability */}
            <div className="absolute inset-0 pointer-events-none rounded-xl"
              style={{ background: `${occupancyGrad.replace('linear-gradient', 'linear-gradient').replace(')', ', rgba(0,0,0,0.35))')}`, opacity: 0.75 }} />
            {/* bg blobs */}
            <div className="absolute -top-8 -right-8 size-40 rounded-full pointer-events-none"
              style={{ background: 'rgba(255,255,255,0.06)' }} />
            <div className="absolute -bottom-6 right-24 size-24 rounded-full pointer-events-none"
              style={{ background: 'rgba(255,255,255,0.04)' }} />

            <div className="relative z-10 flex items-center gap-8">
              {/* ring gauge */}
              <div className="relative size-28 shrink-0">
                <svg className="size-28 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8"
                    stroke="rgba(255,255,255,0.15)" />
                  <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8"
                    stroke="white" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - occupancyPct / 100)}`}
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold leading-none">{occupancyPct}%</span>
                  <span className="text-[10px] opacity-70 mt-0.5">ใช้งาน</span>
                </div>
              </div>

              {/* text info */}
              <div className="flex-1">
                <p className="text-xs font-semibold opacity-60 uppercase tracking-widest mb-1">สถานะลานจอด</p>
                <p className="text-4xl font-bold leading-none">
                  {stats?.activeCars ?? '—'}
                  <span className="text-xl opacity-50 font-normal ml-2">/ {stats?.totalCapacity ?? '—'} คัน</span>
                </p>
                <p className="text-sm opacity-70 mt-2">
                  ที่จอดว่างเหลือ <strong className="text-white font-bold">{stats?.availableSlots ?? '—'} ช่อง</strong>
                </p>
                {stats && (
                  <p className="text-xs opacity-60 mt-1">
                    รถยนต์ {stats.car.available}/{stats.car.capacity} · รถจักรยานยนต์ {stats.motorcycle.available}/{stats.motorcycle.capacity}
                  </p>
                )}

                {/* progress bar */}
                <div className="mt-3 h-2 rounded-full overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.2)' }}>
                  <div className="h-full rounded-full"
                    style={{
                      width: `${occupancyPct}%`,
                      background: 'rgba(255,255,255,0.8)',
                      transition: 'width 0.6s ease',
                    }} />
                </div>

                <div className="flex items-center gap-4 mt-2 text-[10px] opacity-60">
                  <span>0%</span>
                  <span className="flex-1 text-center">ความจุ {occupancyPct}%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── KPI STRIP ── */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: 'รายได้วันนี้',
                value: stats ? `฿${stats.todayRevenue.toLocaleString('th-TH')}` : '—',
                sub:   'บาท ยอดสะสม',
                icon:  BadgeDollarSign,
                grad:  'linear-gradient(135deg,#713F12,#A16207)',
                glow:  'rgba(161,98,7,0.2)',
              },
              {
                label: 'รถเข้าวันนี้',
                value: stats?.todayEntries ?? '—',
                sub:   'คัน รวมทุกประเภท',
                icon:  TrendingUp,
                grad:  'linear-gradient(135deg,#164E63,#0891B2)',
                glow:  'rgba(8,145,178,0.2)',
              },
              {
                label: 'ที่จอดว่าง',
                value: stats?.availableSlots ?? '—',
                sub:   stats ? `รถ ${stats.car.available} · รถจักรยานยนต์ ${stats.motorcycle.available}` : '—',
                icon:  CircleParking,
                grad:  occupancyPct >= 85
                  ? 'linear-gradient(135deg,#7F1D1D,#DC2626)'
                  : occupancyPct >= 60
                  ? 'linear-gradient(135deg,#78350F,#D97706)'
                  : 'linear-gradient(135deg,#064E3B,#059669)',
                glow: occupancyPct >= 85
                  ? 'rgba(220,38,38,0.2)'
                  : occupancyPct >= 60
                  ? 'rgba(217,119,6,0.2)'
                  : 'rgba(5,150,105,0.2)',
              },
            ].map(k => {
              const Icon = k.icon
              return (
                <div key={k.label} className="rounded-xl p-4 text-white relative overflow-hidden"
                  style={{ background: k.grad, boxShadow: `0 4px 16px ${k.glow}` }}>
                  <div className="absolute -top-2 -right-2 size-14 rounded-full pointer-events-none"
                    style={{ background: 'rgba(255,255,255,0.07)' }} />
                  <Icon className="size-4 opacity-75 mb-3" strokeWidth={1.75} />
                  <p className="text-3xl font-bold leading-none">{k.value}</p>
                  <p className="text-[10px] font-semibold opacity-60 mt-1">{k.label}</p>
                  <p className="text-[9px] opacity-40 mt-0.5">{k.sub}</p>
                </div>
              )
            })}
          </div>

          {/* ── BREAKDOWN ROW ── */}
          <div className="grid grid-cols-2 gap-4">

            {/* Revenue by payment method */}
            <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid #E8ECF4', background: '#FAFBFF' }}>
                <p className="text-xs font-bold text-slate-700">สัดส่วนรายได้วันนี้</p>
              </div>
              <div className="p-4 space-y-3">
                {(Object.keys(REVENUE_METHOD_META) as (keyof typeof REVENUE_METHOD_META)[]).map(key => {
                  const meta   = REVENUE_METHOD_META[key]
                  const Icon   = meta.icon
                  const amount = stats?.todayRevenueByMethod[key] ?? 0
                  const total  = stats?.todayRevenue ?? 0
                  const pct    = total > 0 ? Math.round((amount / total) * 100) : 0
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                          <Icon className="size-3.5" style={{ color: meta.color }} /> {meta.label}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          ฿{amount.toLocaleString('th-TH')} <span className="text-slate-400 font-normal">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                        <div className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: meta.color, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Today's entries by type */}
            <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid #E8ECF4', background: '#FAFBFF' }}>
                <p className="text-xs font-bold text-slate-700">รถเข้าวันนี้แยกประเภท</p>
              </div>
              {totalEntriesToday === 0 ? (
                <div className="flex items-center justify-center py-10">
                  <p className="text-xs text-slate-300">ยังไม่มีรถเข้าวันนี้</p>
                </div>
              ) : (
                <div className="p-4 flex items-center gap-4">
                  <ChartContainer config={entryTypeChartConfig} className="h-[130px] w-[130px] shrink-0 aspect-square">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                      <Pie data={entryTypeData} dataKey="value" nameKey="key"
                        innerRadius={34} outerRadius={58} paddingAngle={2} strokeWidth={2}>
                        {entryTypeData.map(d => (
                          <Cell key={d.key} fill={`var(--color-${d.key})`} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <div className="flex-1 space-y-2 min-w-0">
                    {entryTypeData.map(d => {
                      const pct = Math.round((d.value / totalEntriesToday) * 100)
                      return (
                        <div key={d.key} className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5 min-w-0">
                            <span className="size-2 rounded-full shrink-0" style={{ background: entryTypeChartConfig[d.key].color }} />
                            <span className="truncate">{entryTypeChartConfig[d.key].label}</span>
                          </span>
                          <span className="text-[11px] font-bold text-slate-800 shrink-0">
                            {d.value} <span className="text-slate-400 font-normal">({pct}%)</span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── LOWER ROW ── */}
          <div className="grid grid-cols-5 gap-4">

            {/* Quick links */}
            <div className="col-span-2 bg-white rounded-xl overflow-hidden"
              style={{ border: '1px solid #E8ECF4' }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid #E8ECF4', background: '#FAFBFF' }}>
                <p className="text-xs font-bold text-slate-700">เมนูด่วน</p>
              </div>
              <div className="p-3 grid grid-cols-1 gap-2">
                {QUICK_LINKS.map(l => {
                  const Icon = l.icon
                  return (
                    <Link key={l.href} href={l.href}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg group transition-all hover:shadow-sm"
                      style={{ border: '1px solid #F1F5F9' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = l.color; e.currentTarget.style.background = l.bg }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#F1F5F9'; e.currentTarget.style.background = 'transparent' }}>
                      <div className="size-8 rounded-lg flex items-center justify-center shrink-0 transition-all"
                        style={{ background: l.bg }}>
                        <Icon className="size-4" style={{ color: l.color }} strokeWidth={1.75} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800">{l.label}</p>
                        <p className="text-[10px] text-slate-400">{l.sub}</p>
                      </div>
                      <ArrowUpRight className="size-3.5 text-slate-300 shrink-0 group-hover:text-slate-500 transition-colors" />
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Recent activity */}
            <div className="col-span-3 bg-white rounded-xl overflow-hidden flex flex-col"
              style={{ border: '1px solid #E8ECF4' }}>
              <div className="shrink-0 flex items-center justify-between px-5 py-3"
                style={{ borderBottom: '1px solid #E8ECF4', background: '#FAFBFF' }}>
                <p className="text-xs font-bold text-slate-700">กิจกรรมล่าสุด</p>
                <Link href="/history" className="text-[10px] font-bold flex items-center gap-1 hover:underline"
                  style={{ color: '#A16207' }}>
                  ดูทั้งหมด <ArrowUpRight className="size-3" />
                </Link>
              </div>

              {loading ? (
                <div className="flex-1 flex items-center justify-center py-12">
                  <RefreshCw className="size-4 text-slate-200 animate-spin" />
                </div>
              ) : recent.length === 0 ? (
                <div className="flex-1 flex items-center justify-center py-12">
                  <p className="text-sm text-slate-300">ยังไม่มีข้อมูล</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto scrollbar-hide">
                  {recent.map((s, i) => {
                    const isActive    = s.status === 'active'
                    const isLost      = s.status === 'lost'
                    const TypeIcon    = TYPE_ICON[s.cardType] ?? Car
                    const statusColor = isLost ? '#D97706' : isActive ? '#059669' : '#A16207'
                    const statusBg    = isLost ? 'rgba(217,119,6,0.08)' : isActive ? 'rgba(5,150,105,0.08)' : 'rgba(161,98,7,0.07)'
                    const statusLabel = isLost ? 'บัตรหาย' : isActive ? 'จอดอยู่' : 'เสร็จสิ้น'
                    return (
                      <div key={s._id}
                        className="flex items-center gap-3.5 px-5 py-3 hover:bg-slate-50 transition-colors"
                        style={i < recent.length - 1 ? { borderBottom: '1px solid #F8FAFF' } : {}}>

                        {/* status dot */}
                        <div className="relative shrink-0">
                          <div className="size-8 rounded-lg flex items-center justify-center"
                            style={{ background: statusBg }}>
                            {isLost
                              ? <AlertTriangle className="size-3.5" style={{ color: statusColor }} />
                              : isActive
                              ? <ArrowDownLeft  className="size-3.5" style={{ color: statusColor }} />
                              : <ArrowUpRight   className="size-3.5" style={{ color: statusColor }} />}
                          </div>
                          {isActive && (
                            <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-green-400"
                              style={{ boxShadow: '0 0 0 2px white' }} />
                          )}
                        </div>

                        {/* info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold text-slate-800">{s.plate || '—'}</p>
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                              style={{ background: statusBg, color: statusColor }}>
                              {statusLabel}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <TypeIcon className="size-2.5" strokeWidth={1.75} />
                            {TYPE_LABEL[s.cardType]}
                            <span className="text-slate-300">·</span>
                            <Clock className="size-2.5" />
                            {fmtDate(s.entryTime)} {fmtTime(s.entryTime)}
                          </p>
                        </div>

                        {/* fee */}
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-slate-800">
                            {s.totalFee > 0 ? `฿${s.totalFee.toLocaleString('th-TH')}` : <span className="text-slate-300">—</span>}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
