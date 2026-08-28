'use client'

import { useEffect, useState } from 'react'
import { Car, Bike, LogIn, LogOut, Sun, Moon, CircleParking, IdCard, AlertTriangle, Users } from 'lucide-react'

interface TypeStats {
  inToday: number
  outToday: number
  activeTotal: number
  activeNormal: number
  activeOvernight: number
  cardsRegistered: number
  cardsRemaining: number
  lostToday: number
}
interface CarStats extends TypeStats {
  capacityTotal: number
  capacityAvailable: number
  queueWaiting: number
}
interface FleetStats {
  car: CarStats
  motorcycle: TypeStats
}

function Stat({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.ElementType; color: string }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0 px-2.5">
      <Icon className="size-3 shrink-0" style={{ color }} />
      <div className="flex flex-col leading-none">
        <span className="text-[8px] font-bold text-slate-400 whitespace-nowrap">{label}</span>
        <span className="text-xs font-black tabular-nums whitespace-nowrap" style={{ color }}>{value}</span>
      </div>
    </div>
  )
}

function Divider() {
  return <div className="w-px h-6 bg-slate-200 shrink-0" />
}

function FleetRow({ type, label, accent, bg, stats }: {
  type: 'car' | 'motorcycle'
  label: string
  accent: string
  bg: string
  stats: TypeStats | CarStats
}) {
  const isCar = type === 'car'
  const car = isCar ? (stats as CarStats) : null
  const Icon = isCar ? Car : Bike

  return (
    <div className="flex items-stretch rounded-lg overflow-hidden" style={{ border: `1px solid ${accent}30` }}>
      <div className="flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 shrink-0" style={{ background: bg }}>
        <Icon className="size-4 text-white" />
        <span className="text-[8px] font-black text-white whitespace-nowrap">{label}</span>
      </div>
      <div className="flex-1 flex items-center overflow-x-auto" style={{ background: `${accent}06`, scrollbarWidth: 'none' }}>
        <Stat label="เข้าวันนี้" value={stats.inToday} icon={LogIn} color="#2563EB" />
        <Divider />
        <Stat label="ออกวันนี้" value={stats.outToday} icon={LogOut} color="#2563EB" />
        <Divider />
        <Stat label="คงเหลือ" value={stats.activeTotal} icon={Icon} color={accent} />
        <Divider />
        <Stat label="ปกติ" value={stats.activeNormal} icon={Sun} color="#D97706" />
        <Divider />
        <Stat label="ค้างคืน" value={stats.activeOvernight} icon={Moon} color="#7C3AED" />
        {car && (
          <>
            <Divider />
            <Stat label="ช่องจอด" value={`${car.activeTotal}/${car.capacityTotal}`} icon={CircleParking} color={accent} />
            <Divider />
            <Stat label="คิวรอ" value={car.queueWaiting} icon={Users} color="#7C3AED" />
          </>
        )}
        <Divider />
        <Stat label="บัตร" value={`${stats.activeTotal}/${stats.cardsRegistered}`} icon={IdCard} color="#334155" />
        <Divider />
        <Stat label="บัตรหาย" value={stats.lostToday} icon={AlertTriangle} color="#DC2626" />
      </div>
    </div>
  )
}

export function FleetStatusBar() {
  const [stats, setStats] = useState<FleetStats | null>(null)

  useEffect(() => {
    const fetchStats = () => {
      fetch('/api/stats/fleet')
        .then(r => r.json())
        .then(setStats)
        .catch(() => {})
    }
    fetchStats()
    const t = setInterval(fetchStats, 15000)
    return () => clearInterval(t)
  }, [])

  if (!stats) return null

  return (
    <div className="shrink-0 flex flex-col gap-1.5">
      <FleetRow type="car" label="รถยนต์" accent="#DC2626" bg="linear-gradient(135deg,#991B1B,#DC2626)" stats={stats.car} />
      <FleetRow type="motorcycle" label="จักรยานยนต์" accent="#059669" bg="linear-gradient(135deg,#065F46,#059669)" stats={stats.motorcycle} />
    </div>
  )
}
