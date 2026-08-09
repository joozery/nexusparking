'use client'

import {
  LayoutDashboard, DoorOpen, History, CreditCard,
  BarChart2, Settings, ChevronRight, LogOut,
  Clock, CloudSun, Droplets, Wind, Sun, Cloud, CloudRain, Activity, Users, ClipboardList, Tag, FlaskConical, Cctv,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { type HardwareStatus } from './types'

interface Props {
  isOpen: boolean
  hardware?: Record<string, HardwareStatus>
  activeNav?: string
}

const NAV_MAIN = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard, label: 'ภาพรวม',       badge: null },
  { key: 'gate',      href: '/gate',      icon: DoorOpen,        label: 'ประตูเข้า-ออก', badge: null },
  { key: 'history',   href: '/history',   icon: History,         label: 'ประวัติการจอด', badge: '12' },
  { key: 'cards',     href: '/cards',     icon: CreditCard,      label: 'จัดการบัตร',    badge: '2'  },
]
const NAV_SYSTEM = [
  { key: 'shifts',    href: '/shifts',    icon: ClipboardList, label: 'รายงานกะ'          },
  { key: 'discounts', href: '/discounts', icon: Tag,           label: 'ส่วนลดร้านค้า'    },
  { key: 'reports',   href: '/reports',   icon: BarChart2,     label: 'รายงานรายได้'      },
  { key: 'monitor',   href: '/monitor',   icon: Cctv,          label: 'กล้องวงจรปิด'      },
  { key: 'hardware',  href: '/hardware',  icon: Activity,      label: 'มอนิเตอร์ฮาร์ดแวร์' },
  { key: 'settings',  href: '/settings',  icon: Settings,      label: 'ตั้งค่าระบบ'       },
  { key: 'admin',     href: '/admin',     icon: Users,         label: 'จัดการแอดมิน'      },
  { key: 'simulator', href: '/simulator', icon: FlaskConical,  label: 'จำลองข้อมูล'       },
]

const PATH_MAP: Record<string, string> = {
  '/': 'gate', '/gate': 'gate', '/dashboard': 'dashboard',
  '/history': 'history', '/cards': 'cards',
  '/shifts': 'shifts', '/discounts': 'discounts',
  '/reports': 'reports', '/monitor': 'monitor', '/hardware': 'hardware', '/settings': 'settings', '/admin': 'admin',
  '/simulator': 'simulator',
}

type WeatherCondition = 'sunny' | 'partly-cloudy' | 'cloudy' | 'rainy'
// Mock weather — replace with real API call in production
const WEATHER: { temp: number; feels: number; condition: WeatherCondition; label: string; humidity: number; wind: number } =
  { temp: 32, feels: 35, condition: 'partly-cloudy', label: 'มีเมฆบางส่วน', humidity: 75, wind: 12 }

const WEATHER_ICON = {
  sunny:          { icon: Sun,      color: '#F59E0B', bg: 'rgba(251,191,36,0.1)'  },
  'partly-cloudy':{ icon: CloudSun, color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
  cloudy:         { icon: Cloud,    color: '#64748B', bg: 'rgba(100,116,139,0.1)' },
  rainy:          { icon: CloudRain,color: '#2563EB', bg: 'rgba(37,99,235,0.1)'   },
} as const

const TH_DAYS   = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์']
const TH_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

function WeatherClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const hh  = now ? String(now.getHours()).padStart(2, '0')   : '--'
  const mm  = now ? String(now.getMinutes()).padStart(2, '0') : '--'
  const ss  = now ? String(now.getSeconds()).padStart(2, '0') : '--'
  const day  = now ? TH_DAYS[now.getDay()] : ''
  const date = now ? `${day} ${now.getDate()} ${TH_MONTHS[now.getMonth()]} ${now.getFullYear() + 543}` : ''

  const w = WEATHER_ICON[WEATHER.condition]
  const WeatherIcon = w.icon

  return (
    <div className="mx-3 mb-3 shrink-0 rounded-xl overflow-hidden"
      style={{ border: '1px solid #E8ECF4', background: '#FAFBFF' }}>

      {/* Time row */}
      <div className="px-4 pt-3 pb-2 flex items-end justify-between">
        <div>
          <div className="flex items-end gap-1 leading-none">
            <span className="text-2xl font-bold text-slate-800 tabular-nums tracking-tight">{hh}:{mm}</span>
            <span className="text-xs font-medium text-slate-400 mb-0.5 tabular-nums">{ss}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">{date}</p>
        </div>

        {/* Weather icon */}
        <div className="flex size-10 items-center justify-center rounded-lg shrink-0"
          style={{ background: w.bg }}>
          <WeatherIcon className="size-5" style={{ color: w.color }} strokeWidth={1.75} />
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid #E8ECF4' }} />

      {/* Weather stats */}
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold text-slate-800">{WEATHER.temp}°</span>
          <span className="text-[10px] text-slate-400">รู้สึก {WEATHER.feels}°C</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Droplets className="size-3" style={{ color: '#3B82F6' }} />
            <span className="text-[10px] font-semibold text-slate-500">{WEATHER.humidity}%</span>
          </div>
          <div className="flex items-center gap-1">
            <Wind className="size-3" style={{ color: '#64748B' }} />
            <span className="text-[10px] font-semibold text-slate-500">{WEATHER.wind} km/h</span>
          </div>
        </div>
      </div>

      {/* Condition label */}
      <div className="px-4 pb-2.5">
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: w.bg, color: w.color }}>
          {WEATHER.label}
        </span>
      </div>
    </div>
  )
}

export function ParkingSidebar({ isOpen, activeNav }: Props) {
  const pathname   = usePathname()
  const router     = useRouter()
  const currentNav = activeNav ?? PATH_MAP[pathname] ?? 'gate'
  const [me, setMe] = useState<{ name: string; role: string } | null>(null)
  const [bizHours, setBizHours] = useState({ open: '06:30', close: '22:00' })
  const [stats, setStats] = useState<{ activeCars: number; availableSlots: number; todayEntries: number } | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => { if (d) setMe(d) })
    fetch('/api/settings').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.businessHours) setBizHours(d.businessHours)
    })
    fetch('/api/stats').then(r => r.ok ? r.json() : null).then(d => { if (d) setStats(d) })
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col h-screen select-none bg-white"
      style={{ borderRight: '1px solid #E8ECF4' }}>

      {/* ══ HEADER BANNER ══ */}
      <div className="relative overflow-hidden px-5 pt-5 pb-4 shrink-0"
        style={{ background: 'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 60%, #3B82F6 100%)' }}>
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full pointer-events-none"
          style={{ background: 'rgba(255,255,255,0.07)' }} />
        <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full pointer-events-none"
          style={{ background: 'rgba(255,255,255,0.05)' }} />

        <div className="relative z-10 flex items-center justify-between mb-4">
          <img
            src="/logo/logonext.svg"
            alt="Logo"
            className="h-8 w-auto object-contain brightness-0 invert"
          />
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
            style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.2)' }}>
            v2.4
          </span>
        </div>

        <div className="relative z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)' }}>
          <span className="relative flex size-2 shrink-0">
            {isOpen && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
              style={{ background: '#86EFAC' }} />}
            <span className="relative size-2 rounded-full"
              style={{ background: isOpen ? '#4ADE80' : '#F87171' }} />
          </span>
          <span className="text-[11px] font-semibold text-white/90">
            {isOpen ? 'เปิดให้บริการ' : 'ปิดให้บริการ'}
          </span>
          <div className="ml-auto flex items-center gap-1 text-white/50">
            <Clock className="size-3" />
            <span className="text-[10px]">{bizHours.open}–{bizHours.close}</span>
          </div>
        </div>
      </div>

      {/* ══ QUICK STAT STRIP ══ */}
      <div className="shrink-0 grid grid-cols-3" style={{ borderBottom: '1px solid #E8ECF4' }}>
        {[
          { label: 'ในลาน', value: stats ? String(stats.activeCars)      : '—' },
          { label: 'ที่ว่าง', value: stats ? String(stats.availableSlots) : '—' },
          { label: 'วันนี้',  value: stats ? String(stats.todayEntries)   : '—' },
        ].map(({ label, value }, i) => (
          <div key={label} className="flex flex-col items-center py-2.5 gap-0.5"
            style={i < 2 ? { borderRight: '1px solid #E8ECF4' } : {}}>
            <span className="text-sm font-bold text-slate-800">{value}</span>
            <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wide">{label}</span>
          </div>
        ))}
      </div>

      {/* ══ NAV ══ */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide px-3 py-4 space-y-5">
        <div>
          <div className="flex items-center gap-2 px-2 mb-2">
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">เมนูหลัก</span>
            <div className="flex-1 h-px" style={{ background: '#E8ECF4' }} />
          </div>
          <div className="space-y-0.5">
            {NAV_MAIN.map(({ key, href, icon: Icon, label, badge }) => {
              const active = key === currentNav
              return (
                <Link key={key} href={href}
                  className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 group"
                  style={{ background: active ? 'rgba(29,78,216,0.07)' : 'transparent', color: active ? '#1D4ED8' : '#64748B' }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = '#F8FAFF'; e.currentTarget.style.color = '#334155' } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748B' } }}
                >
                  {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full" style={{ background: '#1D4ED8' }} />}
                  <div className="flex size-7 items-center justify-center rounded-lg shrink-0"
                    style={active ? { background: 'rgba(29,78,216,0.1)', boxShadow: '0 0 0 3px rgba(29,78,216,0.06)' } : {}}>
                    <Icon className="size-4" style={{ color: active ? '#1D4ED8' : '#94A3B8' }} strokeWidth={active ? 2.2 : 1.75} />
                  </div>
                  <span className="flex-1 truncate">{label}</span>
                  {badge && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={active ? { background: '#1D4ED8', color: 'white' } : { background: '#F1F5F9', color: '#94A3B8' }}>
                      {badge}
                    </span>
                  )}
                  {active
                    ? <ChevronRight className="size-3.5 shrink-0" style={{ color: '#1D4ED8', opacity: 0.5 }} />
                    : <ChevronRight className="size-3.5 shrink-0 opacity-0 group-hover:opacity-30 transition-opacity" style={{ color: '#94A3B8' }} />
                  }
                </Link>
              )
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 px-2 mb-2">
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">ระบบ</span>
            <div className="flex-1 h-px" style={{ background: '#E8ECF4' }} />
          </div>
          <div className="space-y-0.5">
            {NAV_SYSTEM.map(({ key, href, icon: Icon, label }) => {
              const active = key === currentNav
              return (
                <Link key={key} href={href}
                  className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150"
                  style={{ background: active ? 'rgba(29,78,216,0.07)' : 'transparent', color: active ? '#1D4ED8' : '#64748B' }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = '#F8FAFF'; e.currentTarget.style.color = '#334155' } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748B' } }}
                >
                  {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full" style={{ background: '#1D4ED8' }} />}
                  <div className="flex size-7 items-center justify-center rounded-lg shrink-0"
                    style={active ? { background: 'rgba(29,78,216,0.1)', boxShadow: '0 0 0 3px rgba(29,78,216,0.06)' } : {}}>
                    <Icon className="size-4" style={{ color: active ? '#1D4ED8' : '#94A3B8' }} strokeWidth={1.75} />
                  </div>
                  <span className="flex-1">{label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* ══ WEATHER + TIME ══ */}
      <WeatherClock />

      {/* ══ USER PROFILE ══ */}
      <div className="px-3 pb-4 shrink-0" style={{ borderTop: '1px solid #E8ECF4', paddingTop: '12px' }}>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer group transition-colors hover:bg-red-50 text-left">
          <div className="relative shrink-0">
            <div className="flex size-8 items-center justify-center rounded-lg text-[10px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)', boxShadow: '0 2px 6px rgba(29,78,216,0.35)' }}>
              {me ? me.name.charAt(0).toUpperCase() : 'OP'}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border-2 border-white"
              style={{ background: '#22C55E' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">{me?.name ?? 'Loading...'}</p>
            <p className="text-[10px] text-slate-400 truncate mt-0.5 capitalize">{me?.role ?? '—'}</p>
          </div>
          <LogOut className="size-3.5 text-slate-300 shrink-0 opacity-0 group-hover:opacity-100 group-hover:text-red-400 transition-all" />
        </button>
      </div>

    </aside>
  )
}
