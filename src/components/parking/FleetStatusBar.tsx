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
  monthlyCardsRegistered?: number
  temporaryCardsRegistered?: number
  temporaryCardsInUse?: number
  temporaryCardsRemaining?: number
  monthlyCardsRemaining?: number
  cardsRemaining: number
  // เฉพาะรถยนต์ — แยกจำนวนบัตรตามประเภทที่ลงทะเบียนไว้จริง (ค้างคืน vs ชั่วคราว)
  overnightCardsRegistered?: number
  overnightCardsRemaining?: number
  normalCardsRegistered?: number
  normalCardsRemaining?: number
  lostToday: number
  lostTemporaryToday?: number | null
  lostMonthlyToday?: number | null
}
export interface FleetStats {
  car: FleetTypeStats
  motorcycle: FleetTypeStats
}

function Stat({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.ElementType; color: string }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0 px-2">
      <Icon className="size-3 shrink-0" style={{ color }} />
      <div className="flex flex-col leading-none gap-0.5">
        <span className="text-[8px] font-bold text-slate-400 whitespace-nowrap">{label}</span>
        <span className="text-xs font-black tabular-nums whitespace-nowrap" style={{ color }}>{value}</span>
      </div>
    </div>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-slate-200 shrink-0" />
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
    <div className="flex items-stretch rounded-lg overflow-hidden" style={{ border: `1px solid ${accent}30` }}>
      <div className="w-16 flex flex-col items-center justify-center gap-0.5 px-1.5 py-1 shrink-0" style={{ background: bg }}>
        <Icon className="size-4 text-white" />
        <span className="text-[8px] font-black text-white text-center leading-tight">{label}</span>
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
        <div title="บัตรชั่วคราวที่รถอยู่ในลาน / บัตรชั่วคราวที่เปิดใช้งานทั้งหมด">
          <Stat label="บัตรชั่วคราว" value={`${stats.temporaryCardsInUse ?? '—'}/${stats.temporaryCardsRegistered ?? '—'}`} icon={IdCard} color="#334155" />
        </div>
        <Divider />
        <div title="บัตรชั่วคราวที่เปิดใช้งาน หักบัตรของรถในลานและคิวรอ">
          <Stat label="บัตรเหลือชั่วคราว" value={stats.temporaryCardsRemaining ?? '—'} icon={IdCard} color={(stats.temporaryCardsRemaining ?? 0) > 0 ? '#059669' : '#DC2626'} />
        </div>
        {stats.monthlyCardsRegistered !== 0 && <><Divider />
        <div title="จำนวนบัตรรายเดือนที่เปิดใช้งาน รวมบัตรที่เลยวันหมดอายุแต่ยังไม่ได้ปิดใช้งาน">
          <Stat label="บัตรรายเดือน" value={stats.monthlyCardsRegistered ?? '—'} icon={IdCard} color="#7C3AED" />
        </div></>}
        {stats.monthlyCardsRemaining !== 0 && <><Divider />
        <div title="บัตรรายเดือนที่เปิดใช้งาน หักบัตรของรถในลานและคิวรอ รวมบัตรที่เลยวันหมดอายุแต่ยังไม่ได้ปิดใช้งาน">
          <Stat label="บัตรเหลือรายเดือน" value={stats.monthlyCardsRemaining ?? '—'} icon={IdCard} color={(stats.monthlyCardsRemaining ?? 0) > 0 ? '#059669' : '#DC2626'} />
        </div></>}
        <Divider />
        <div title="รายการเสียค่าบัตรหายวันนี้ แยกตามประเภทบัตรที่ลงทะเบียนปัจจุบัน — หมายถึงข้อมูลประเภทบัตรไม่ครบ">
          <Stat label="บัตรหายชั่วคราว" value={stats.lostTemporaryToday ?? '—'} icon={AlertTriangle} color="#DC2626" />
        </div>
        {stats.lostMonthlyToday !== 0 && <><Divider />
          <div title="รายการเสียค่าบัตรหายวันนี้ แยกตามประเภทบัตรที่ลงทะเบียนปัจจุบัน — หมายถึงข้อมูลประเภทบัตรไม่ครบ">
            <Stat label="บัตรหายรายเดือน" value={stats.lostMonthlyToday ?? '—'} icon={AlertTriangle} color="#DC2626" />
          </div>
        </>}
      </div>
    </div>
  )
}

export function FleetStatusBar({ stats }: { stats: FleetStats | null }) {
  if (!stats) return null

  return (
    <div className="shrink-0 flex flex-col gap-1">
      <FleetRow type="car" label="รถยนต์" accent="#DC2626" bg="linear-gradient(135deg,#991B1B,#DC2626)" stats={stats.car} />
      <FleetRow type="motorcycle" label="รถจักรยานยนต์" accent="#059669" bg="linear-gradient(135deg,#065F46,#059669)" stats={stats.motorcycle} />
    </div>
  )
}
