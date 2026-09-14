'use client'

import { Car, Bike, LogIn, LogOut, Sun, Moon, CircleParking, IdCard, AlertTriangle, Users } from 'lucide-react'

export interface FleetTypeStats {
  inToday: number
  outToday: number
  activeTotal: number
  activeNormal: number
  activeOvernight: number
  capacityTotal: number
  capacityAvailable: number
  queueWaiting: number
  cardsRegistered: number
  cardsRemaining: number
  lostToday: number
}
export interface FleetStats {
  car: FleetTypeStats
  motorcycle: FleetTypeStats
}

function Stat({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.ElementType; color: string }) {
  return (
    <div className="flex items-center gap-2 shrink-0 px-3.5">
      <Icon className="size-4 shrink-0" style={{ color }} />
      <div className="flex flex-col leading-none gap-0.5">
        <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">{label}</span>
        <span className="text-base font-black tabular-nums whitespace-nowrap" style={{ color }}>{value}</span>
      </div>
    </div>
  )
}

function Divider() {
  return <div className="w-px h-8 bg-slate-200 shrink-0" />
}

function FleetRow({ type, label, accent, bg, stats }: {
  type: 'car' | 'motorcycle'
  label: string
  accent: string
  bg: string
  stats: FleetTypeStats
}) {
  const Icon = type === 'car' ? Car : Bike

  return (
    <div className="flex items-stretch rounded-xl overflow-hidden" style={{ border: `1px solid ${accent}30` }}>
      <div className="w-24 flex flex-col items-center justify-center gap-1 px-2 py-2 shrink-0" style={{ background: bg }}>
        <Icon className="size-6 text-white" />
        <span className="text-[10px] font-black text-white text-center leading-tight">{label}</span>
      </div>
      <div className="flex-1 flex items-center overflow-x-auto" style={{ background: `${accent}06`, scrollbarWidth: 'none' }}>
        <Stat label="เข้าวันนี้" value={stats.inToday} icon={LogIn} color="#A16207" />
        <Divider />
        <Stat label="ออกวันนี้" value={stats.outToday} icon={LogOut} color="#A16207" />
        <Divider />
        <Stat label="คงเหลือ" value={stats.activeTotal} icon={Icon} color={accent} />
        <Divider />
        <Stat label="ปกติ" value={stats.activeNormal} icon={Sun} color="#D97706" />
        <Divider />
        <Stat label="ค้างคืน" value={stats.activeOvernight} icon={Moon} color="#7C3AED" />
        <Divider />
        <Stat label="ช่องจอด" value={`${stats.activeTotal}/${stats.capacityTotal}`} icon={CircleParking} color={accent} />
        <Divider />
        <Stat label="เหลือ" value={stats.capacityAvailable} icon={CircleParking} color={stats.capacityAvailable > 0 ? '#059669' : '#DC2626'} />
        <Divider />
        <Stat label="คิวรอ" value={stats.queueWaiting} icon={Users} color="#7C3AED" />
        <Divider />
        <Stat label="บัตร" value={`${stats.activeTotal}/${stats.cardsRegistered}`} icon={IdCard} color="#334155" />
        <Divider />
        <Stat label="บัตรหาย" value={stats.lostToday} icon={AlertTriangle} color="#DC2626" />
      </div>
    </div>
  )
}

export function FleetStatusBar({ stats }: { stats: FleetStats | null }) {
  if (!stats) return null

  return (
    <div className="shrink-0 flex flex-col gap-2">
      <FleetRow type="car" label="รถยนต์" accent="#DC2626" bg="linear-gradient(135deg,#991B1B,#DC2626)" stats={stats.car} />
      <FleetRow type="motorcycle" label="รถจักรยานยนต์" accent="#059669" bg="linear-gradient(135deg,#065F46,#059669)" stats={stats.motorcycle} />
    </div>
  )
}
