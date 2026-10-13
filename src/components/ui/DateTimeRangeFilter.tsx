'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Filter } from 'lucide-react'

interface Props {
  dateFrom: string
  dateTo: string
  onChange: (from: string, to: string) => void
  onApply?: () => void
  onClear?: () => void
}

const pad = (value: number) => String(value).padStart(2, '0')
const localValue = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
const datePart = (value: string) => value.slice(0, 10)
const timePart = (value: string, fallback: string) => value.includes('T') ? value.slice(11, 16) : fallback

export function DateTimeRangeFilter({ dateFrom, dateTo, onChange, onApply, onClear }: Props) {
  const [open, setOpen] = useState(false)
  const [openField, setOpenField] = useState<'from' | 'to' | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const fromTime = timePart(dateFrom, '00:00')
  const toTime = timePart(dateTo, '23:59')

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  function setDate(kind: 'from' | 'to', value: string) {
    const time = kind === 'from' ? fromTime : toTime
    const next = value ? `${value}T${time}` : ''
    onChange(kind === 'from' ? next : dateFrom, kind === 'to' ? next : dateTo)
  }

  function setTime(kind: 'from' | 'to', value: string) {
    const current = kind === 'from' ? dateFrom : dateTo
    const next = current ? `${datePart(current)}T${value}` : ''
    onChange(kind === 'from' ? next : dateFrom, kind === 'to' ? next : dateTo)
  }

  function preset(kind: 'today' | '7days' | 'month') {
    const now = new Date()
    const from = new Date(now)
    if (kind === '7days') from.setDate(from.getDate() - 6)
    if (kind === 'month') from.setDate(1)
    from.setHours(0, 0, 0, 0)
    onChange(localValue(from), localValue(now))
  }

  const active = Boolean(dateFrom || dateTo)
  const dateButton = (kind: 'from' | 'to', value: string) => value
    ? `${datePart(value)} ${timePart(value, kind === 'from' ? '00:00' : '23:59')}`
    : kind === 'from' ? 'เลือกวันเวลาเริ่มต้น' : 'เลือกวันเวลาสิ้นสุด'

  function editor(kind: 'from' | 'to', value: string, time: string) {
    return openField === kind ? (
      <div className="absolute left-0 top-10 z-50 rounded-lg bg-white p-3 shadow-xl" style={{ border: '1px solid #E8ECF4' }}>
        <input type="date" value={datePart(value)} min={kind === 'to' ? datePart(dateFrom) || undefined : undefined} max={kind === 'from' ? datePart(dateTo) || undefined : undefined}
          onChange={event => setDate(kind, event.target.value)} className="h-8 w-36 rounded-lg px-2 text-xs text-slate-700 outline-none" style={{ background: '#F8FAFF', border: '1px solid #E8ECF4' }} />
        <div className="mt-2 flex items-center gap-1">
          <select value={time.slice(0, 2)} aria-label="ชั่วโมง" onChange={event => setTime(kind, `${event.target.value}:${time.slice(3, 5)}`)} className="h-8 w-14 rounded-lg px-1 text-xs text-slate-700 outline-none" style={{ border: '1px solid #E8ECF4' }}>
            {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={pad(hour)}>{pad(hour)}</option>)}
          </select>
          <span>:</span>
          <select value={time.slice(3, 5)} aria-label="นาที" onChange={event => setTime(kind, `${time.slice(0, 2)}:${event.target.value}`)} className="h-8 w-14 rounded-lg px-1 text-xs text-slate-700 outline-none" style={{ border: '1px solid #E8ECF4' }}>
            {Array.from({ length: 60 }, (_, minute) => <option key={minute} value={pad(minute)}>{pad(minute)}</option>)}
          </select>
        </div>
      </div>
    ) : null
  }

  return (
    <div ref={ref} className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => setOpen(value => !value)}
        className="h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
        style={active || open
          ? { background: 'rgba(161,98,7,0.08)', color: '#A16207', border: '1px solid rgba(161,98,7,0.2)' }
          : { background: '#F8FAFF', color: '#94A3B8', border: '1px solid #E8ECF4' }}>
        <Filter className="size-3" />
        ช่วงวันที่
      </button>

      {open && <>
        {(['today', '7days', 'month'] as const).map(kind => <button key={kind} type="button" onClick={() => preset(kind)} className="h-8 px-2.5 rounded-lg text-[11px] font-semibold text-slate-600" style={{ background: '#F8FAFF', border: '1px solid #E8ECF4' }}>{kind === 'today' ? 'วันนี้' : kind === '7days' ? '7 วัน' : 'เดือนนี้'}</button>)}
        <div className="relative">
          <button type="button" onClick={() => setOpenField(openField === 'from' ? null : 'from')} className="h-8 px-3 rounded-lg text-xs text-slate-700 outline-none" style={{ background: '#F8FAFF', border: '1px solid #E8ECF4' }}>{dateButton('from', dateFrom)}</button>
          {editor('from', dateFrom, fromTime)}
        </div>
        <span className="text-slate-300 text-xs">—</span>
        <div className="relative">
          <button type="button" onClick={() => setOpenField(openField === 'to' ? null : 'to')} className="h-8 px-3 rounded-lg text-xs text-slate-700 outline-none" style={{ background: '#F8FAFF', border: '1px solid #E8ECF4' }}>{dateButton('to', dateTo)}</button>
          {editor('to', dateTo, toTime)}
        </div>
        {onClear && <button type="button" onClick={() => { onClear(); setOpen(false); setOpenField(null) }} className="h-8 px-2.5 rounded-lg text-[11px] font-semibold text-slate-500 hover:bg-slate-100" style={{ border: '1px solid #E8ECF4' }}>ล้างตัวกรอง</button>}
        {onApply && <button type="button" onClick={() => { onApply(); setOpen(false); setOpenField(null) }} disabled={!dateFrom || !dateTo} className="h-8 px-3 rounded-lg text-xs font-semibold text-black flex items-center gap-1.5 disabled:opacity-50" style={{ background: '#EAB308' }}><ArrowUpRight className="size-3" /> ดูรายงาน</button>}
      </>}
    </div>
  )
}
