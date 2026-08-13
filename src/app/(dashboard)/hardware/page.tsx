'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity, Camera, Shield, CreditCard, Printer, Banknote,
  Wifi, WifiOff, HelpCircle, RefreshCw, Play, CheckCircle2,
  XCircle, Clock, Zap,
} from 'lucide-react'
import { triggerBarrierClient } from '@/lib/barrierClient'

interface DeviceStatus {
  device:    string
  enabled:   boolean
  ip:        string
  port:      number
  success:   boolean | null
  latencyMs: number | null
  lastSeen:  string | null
  event:     string | null
}

interface LogEntry {
  _id:       string
  device:    string
  event:     string
  success:   boolean
  ip:        string
  latencyMs: number
  createdAt: string
}

const HW_META: Record<string, {
  label: string
  desc:  string
  icon:  typeof Camera
  passive?: boolean
}> = {
  camera:  { label: 'กล้องวงจรปิด',           desc: 'ถ่าย Snapshot อัตโนมัติเมื่อรถเข้า-ออก',    icon: Camera  },
  barrier: { label: 'ไม้กั้นรถยนต์',          desc: 'เปิดอัตโนมัติหลังขาเข้า / ขาออก',          icon: Shield  },
  reader:  { label: 'เครื่องอ่านบัตร',         desc: 'อุปกรณ์ Passive — อ่าน UID บัตรจอดรถ',      icon: CreditCard, passive: true },
  printer: { label: 'เครื่องพิมพ์ใบเสร็จ',    desc: 'พิมพ์ใบเสร็จหลังชำระเงิน',                  icon: Printer },
  drawer:  { label: 'ลิ้นชักเก็บเงิน',         desc: 'เด้งเปิดอัตโนมัติหลังขาออก',                icon: Banknote },
}

const EVENT_LABEL: Record<string, string> = {
  checkin:  'ขาเข้า',
  checkout: 'ขาออก',
  trigger:  'Manual',
  receipt:  'ใบเสร็จ',
  ping:     'Ping',
  lost:     'บัตรหาย',
}

function timeAgo(iso: string | null) {
  if (!iso) return '—'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)  return `${Math.floor(diff)}s ที่แล้ว`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ที่แล้ว`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ที่แล้ว`
  return `${Math.floor(diff / 86400)}d ที่แล้ว`
}

function StatusBadge({ success, passive }: { success: boolean | null; passive?: boolean }) {
  if (passive) return (
    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(100,116,139,0.1)', color: '#64748B' }}>
      <HelpCircle className="size-2.5" /> Passive
    </span>
  )
  if (success === null) return (
    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(100,116,139,0.08)', color: '#94A3B8' }}>
      <HelpCircle className="size-2.5" /> Unknown
    </span>
  )
  if (success) return (
    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(5,150,105,0.1)', color: '#059669' }}>
      <Wifi className="size-2.5" /> Online
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(220,38,38,0.1)', color: '#DC2626' }}>
      <WifiOff className="size-2.5" /> Offline
    </span>
  )
}

export default function HardwareMonitorPage() {
  const [statuses, setStatuses] = useState<DeviceStatus[]>([])
  const [logs,     setLogs]     = useState<LogEntry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [pinging,  setPinging]  = useState<Record<string, boolean>>({})
  const [countdown, setCountdown] = useState(30)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [sRes, lRes] = await Promise.all([
        fetch('/api/hardware/status'),
        fetch('/api/hardware/log?limit=50'),
      ])
      const [s, l] = await Promise.all([sRes.json(), lRes.json()])
      setStatuses(s)
      setLogs(l)
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-refresh every 30s with countdown
  useEffect(() => {
    fetchAll()
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { fetchAll(); return 30 }
        return c - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [fetchAll])

  async function pingDevice(device: string, direction?: 'checkin' | 'checkout') {
    if (device === 'reader') return
    const key = device === 'barrier' && direction ? `barrier_${direction}` : device
    setPinging(p => ({ ...p, [key]: true }))
    try {
      if (device === 'barrier' && direction) {
        await triggerBarrierClient(direction)
      } else {
        await fetch(`/api/hardware/trigger?device=${device}`)
      }
      const [sRes, lRes] = await Promise.all([
        fetch('/api/hardware/status'),
        fetch('/api/hardware/log?limit=50'),
      ])
      setStatuses(await sRes.json())
      setLogs(await lRes.json())
    } finally {
      setPinging(p => ({ ...p, [key]: false }))
    }
  }

  async function pingAll() {
    await Promise.all([
      pingDevice('camera'),
      pingDevice('barrier', 'checkin'),
      pingDevice('drawer'),
      pingDevice('printer'),
    ])
  }

  function manualRefresh() {
    setCountdown(30)
    fetchAll()
  }

  const deviceOrder = ['camera', 'barrier', 'reader', 'printer', 'drawer']

  return (
    <>
      <header className="shrink-0 h-14 bg-white flex items-center justify-between px-6"
        style={{ borderBottom: '1px solid #E8ECF4' }}>
        <div className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded-lg"
            style={{ background: 'rgba(99,102,241,0.08)' }}>
            <Activity className="size-3.5" style={{ color: '#6366F1' }} />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 leading-none">มอนิเตอร์ฮาร์ดแวร์</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">สถานะการเชื่อมต่ออุปกรณ์ทั้งหมด</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Countdown ring */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
            style={{ background: '#F8FAFF', border: '1px solid #E8ECF4' }}>
            <Clock className="size-3 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500 tabular-nums w-4">{countdown}</span>
            <span className="text-[10px] text-slate-400">s</span>
          </div>
          <button onClick={manualRefresh}
            className="size-8 flex items-center justify-center rounded-lg transition-colors hover:bg-slate-100"
            style={{ color: '#64748B' }}>
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={pingAll}
            className="h-8 px-3 rounded-lg text-white text-xs font-bold flex items-center gap-1.5"
            style={{ background: '#6366F1', boxShadow: '0 1px 8px rgba(99,102,241,0.35)' }}>
            <Zap className="size-3.5" />
            Ping All
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-5 space-y-4">

        {/* Device Status Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {deviceOrder.map(d => {
            const st   = statuses.find(s => s.device === d)
            const meta = HW_META[d]
            const Icon = meta.icon
            const busy = pinging[d]

            const borderColor = st?.success === true
              ? 'rgba(5,150,105,0.2)'
              : st?.success === false
              ? 'rgba(220,38,38,0.15)'
              : '#E8ECF4'

            return (
              <div key={d} className="bg-white rounded-xl p-4"
                style={{ border: `1px solid ${borderColor}` }}>
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg flex items-center justify-center"
                      style={{
                        background: st?.success === true
                          ? 'rgba(5,150,105,0.08)'
                          : st?.success === false
                          ? 'rgba(220,38,38,0.08)'
                          : 'rgba(100,116,139,0.06)',
                      }}>
                      <Icon className="size-4" style={{
                        color: st?.success === true ? '#059669' : st?.success === false ? '#DC2626' : '#94A3B8'
                      }} strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800">{meta.label}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">{meta.desc}</p>
                    </div>
                  </div>
                  <StatusBadge success={st?.success ?? null} passive={meta.passive} />
                </div>

                {/* IP:Port */}
                <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 rounded-lg"
                  style={{ background: '#F8FAFF', border: '1px solid #E8ECF4' }}>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide">IP</span>
                  <span className="text-[10px] font-mono font-bold text-slate-700 flex-1 truncate">
                    {st?.ip ? `${st.ip}:${st.port}` : '—'}
                  </span>
                  {st?.enabled === false && (
                    <span className="text-[9px] font-bold" style={{ color: '#F59E0B' }}>Disabled</span>
                  )}
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center">
                    <p className="text-[9px] text-slate-400 mb-0.5">Latency</p>
                    <p className="text-xs font-black text-slate-700">
                      {st?.latencyMs != null ? `${st.latencyMs}ms` : '—'}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-slate-400 mb-0.5">ล่าสุด</p>
                    <p className="text-[10px] font-bold text-slate-600 truncate">{timeAgo(st?.lastSeen ?? null)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-slate-400 mb-0.5">Event</p>
                    <p className="text-[10px] font-bold text-slate-600">{EVENT_LABEL[st?.event ?? ''] ?? st?.event ?? '—'}</p>
                  </div>
                </div>

                {/* Latency bar */}
                {st?.latencyMs != null && (
                  <div className="h-1 rounded-full mb-3 overflow-hidden" style={{ background: '#F1F5F9' }}>
                    <div className="h-1 rounded-full transition-all"
                      style={{
                        width: `${Math.min((st.latencyMs / 3000) * 100, 100)}%`,
                        background: st.latencyMs < 200 ? '#059669' : st.latencyMs < 1000 ? '#F59E0B' : '#DC2626',
                      }} />
                  </div>
                )}

                {/* Ping button */}
                {!meta.passive && (
                  d === 'barrier' ? (
                    <div className="flex gap-1.5">
                      <button onClick={() => pingDevice('barrier', 'checkin')}
                        disabled={pinging['barrier_checkin']}
                        className="flex-1 h-7 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                        style={{ background: 'rgba(5,150,105,0.08)', color: '#059669' }}>
                        {pinging['barrier_checkin']
                          ? <RefreshCw className="size-3 animate-spin" />
                          : <><Play className="size-3" /> ขาเข้า</>}
                      </button>
                      <button onClick={() => pingDevice('barrier', 'checkout')}
                        disabled={pinging['barrier_checkout']}
                        className="flex-1 h-7 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                        style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}>
                        {pinging['barrier_checkout']
                          ? <RefreshCw className="size-3 animate-spin" />
                          : <><Play className="size-3" /> ขาออก</>}
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => pingDevice(d)} disabled={busy}
                      className="w-full h-7 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                      style={{ background: 'rgba(99,102,241,0.08)', color: '#6366F1' }}>
                      {busy
                        ? <><RefreshCw className="size-3 animate-spin" /> กำลัง Ping...</>
                        : <><Play className="size-3" /> Ping Device</>
                      }
                    </button>
                  )
                )}
              </div>
            )
          })}
        </div>

        {/* Activity Log */}
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
          <div className="px-5 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid #E8ECF4' }}>
            <div className="flex items-center gap-2">
              <Activity className="size-3.5 text-slate-400" />
              <p className="text-xs font-black text-slate-900">กิจกรรมล่าสุด</p>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(99,102,241,0.08)', color: '#6366F1' }}>
                {logs.length} รายการ
              </span>
            </div>
            <p className="text-[10px] text-slate-400">50 รายการล่าสุด</p>
          </div>

          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Activity className="size-7 text-slate-200 mb-2" />
              <p className="text-sm font-bold text-slate-400">ยังไม่มีกิจกรรม</p>
              <p className="text-xs text-slate-300">กด Ping เพื่อทดสอบการเชื่อมต่อ</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: '#F8FAFF' }}>
                    {['อุปกรณ์', 'เหตุการณ์', 'IP', 'สถานะ', 'Latency', 'เวลา'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-bold text-slate-500"
                        style={{ fontSize: '10px', borderBottom: '1px solid #E8ECF4' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => {
                    const meta = HW_META[log.device]
                    const Icon = meta?.icon ?? Activity
                    return (
                      <tr key={log._id} style={{ background: i % 2 === 0 ? 'white' : '#FAFBFF' }}>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <Icon className="size-3 text-slate-400" strokeWidth={1.75} />
                            <span className="font-bold text-slate-700">{meta?.label ?? log.device}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                            style={{ background: '#F1F5F9', color: '#475569' }}>
                            {EVENT_LABEL[log.event] ?? log.event}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-mono text-[10px] text-slate-500">{log.ip || '—'}</td>
                        <td className="px-4 py-2">
                          {log.success
                            ? <span className="flex items-center gap-1 font-bold" style={{ color: '#059669' }}><CheckCircle2 className="size-3" /> สำเร็จ</span>
                            : <span className="flex items-center gap-1 font-bold" style={{ color: '#DC2626' }}><XCircle className="size-3" /> ล้มเหลว</span>
                          }
                        </td>
                        <td className="px-4 py-2 font-mono text-[10px]"
                          style={{ color: log.latencyMs < 200 ? '#059669' : log.latencyMs < 1000 ? '#F59E0B' : '#DC2626' }}>
                          {log.latencyMs}ms
                        </td>
                        <td className="px-4 py-2 text-slate-400 whitespace-nowrap">{timeAgo(log.createdAt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </>
  )
}
