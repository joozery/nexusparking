'use client'

import { Car, Search, RefreshCw } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogBody,
} from '@/components/ui/dialog'
import { type CardType } from './types'

interface Stats {
  totalCapacity: number
}

const TYPE_META: Record<CardType, { label: string; icon: typeof Car; color: string }> = {
  car:        { label: 'รถยนต์',       icon: Car, color: '#1D4ED8' },
  motorcycle: { label: 'มอเตอร์ไซค์', icon: Car, color: '#6D28D9' },
  overnight:  { label: 'ค้างคืน',     icon: Car, color: '#B45309' },
}

function fmtDuration(entryTime: string) {
  const diff = Date.now() - new Date(entryTime).getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return h > 0 ? `${h} ชม. ${m} น.` : `${m} น.`
}

interface CarLike {
  _id: string
  plate: string
  cardType: CardType
  entryTime: string
}

interface Props<T extends CarLike> {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessions: T[]
  stats: Stats | null
  loading: boolean
  search: string
  onSearchChange: (v: string) => void
  onRefresh: () => void
  onCheckout: (s: T) => void
}

export function CarsInLotDialog<T extends CarLike>({
  open, onOpenChange, sessions, stats, loading, search, onSearchChange, onRefresh, onCheckout,
}: Props<T>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col" showCloseButton>
        <DialogHeader className="bg-gradient-to-r from-blue-700 to-blue-600">
          <div className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-white/20 shrink-0">
              <Car className="size-3.5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white text-sm">
                รถในลาน — {sessions.length} คัน{stats ? ` / ${stats.totalCapacity} ที่` : ''}
              </DialogTitle>
              <DialogDescription className="text-blue-100 text-xs mt-0">F2 เปิด/ปิดหน้าต่างนี้</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-center gap-2 px-4 py-2 shrink-0" style={{ borderBottom: '1px solid #E8ECF4' }}>
          <div className="relative flex-1">
            <Search className="size-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="ค้นหาทะเบียน"
              className="w-full h-8 pl-6 pr-2.5 rounded-lg text-xs text-slate-700 outline-none"
              style={{ background: 'white', border: '1px solid #E2E8F0' }}
              autoFocus
            />
          </div>
          <button
            onClick={onRefresh}
            className="size-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'white', border: '1px solid #E2E8F0' }}
          >
            <RefreshCw className={`size-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <DialogBody className="py-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2">
              <RefreshCw className="size-4 text-slate-300 animate-spin" />
              <span className="text-xs text-slate-300">กำลังโหลด…</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Car className="size-8 text-slate-200" />
              <p className="text-xs text-slate-300">{search ? `ไม่พบทะเบียน "${search}"` : 'ยังไม่มีรถในลาน'}</p>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ borderBottom: '1px solid #E8ECF4' }}>
                  <th className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 py-2 w-8">#</th>
                  <th className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 py-2">ป้ายทะเบียน</th>
                  <th className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 py-2">ประเภท</th>
                  <th className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 py-2">เวลาเข้า</th>
                  <th className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 py-2">ระยะเวลา</th>
                  <th className="py-2 pr-4 w-24" />
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, idx) => {
                  const m = TYPE_META[s.cardType]
                  const Icon = m.icon
                  const entryTime = new Date(s.entryTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
                  return (
                    <tr key={s._id}
                      style={{ borderBottom: idx < sessions.length - 1 ? '1px solid #F1F5F9' : 'none', background: idx % 2 === 1 ? '#FAFBFF' : 'white' }}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-0.5 h-4 rounded-full shrink-0" style={{ background: m.color }} />
                          <span className="text-[10px] text-slate-400 tabular-nums">{idx + 1}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5"><span className="text-[15px] font-black text-slate-900 tracking-widest">{s.plate}</span></td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Icon className="size-3 shrink-0" style={{ color: m.color }} strokeWidth={2} />
                          <span className="text-[10px] font-bold" style={{ color: m.color }}>{m.label}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5"><span className="text-[11px] text-slate-500 tabular-nums">{entryTime}</span></td>
                      <td className="px-3 py-2.5"><span className="text-[11px] font-semibold text-slate-600">{fmtDuration(s.entryTime)}</span></td>
                      <td className="pr-4 py-1.5">
                        <button
                          onClick={() => onCheckout(s)}
                          className="w-full px-3 py-1.5 rounded-lg font-black text-white text-[10px] tracking-wide transition-all active:scale-[0.97]"
                          style={{ background: 'linear-gradient(160deg,#065F46,#059669)' }}
                        >
                          CHECK OUT
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
