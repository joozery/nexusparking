'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  BarChart2, TrendingUp, Car, Bike, Moon, AlertTriangle,
  RefreshCw, ArrowUpRight, Calendar, ChevronLeft, ChevronRight,
} from 'lucide-react'

interface DailyRow  { _id: string; total: number; count: number; car: number; motorcycle: number; overnight: number; lostFines: number }
interface TypeRow   { _id: string; total: number; count: number; avg: number }
interface Summary   { total: number; count: number; avg: number; lostFines: number; maxFee: number }
interface ReportData {
  period: string; startDate: string; endDate: string
  daily: DailyRow[]; byType: TypeRow[]; summary: Summary
}

const PERIODS = [
  { key: 'day',   label: 'วันนี้',   icon: '📅' },
  { key: 'week',  label: '7 วัน',    icon: '📊' },
  { key: 'month', label: 'เดือนนี้', icon: '📈' },
] as const

const TYPE_META: Record<string, { label: string; icon: typeof Car; color: string; bg: string; grad: string }> = {
  car:        { label: 'รถยนต์',        icon: Car,  color: '#1D4ED8', bg: 'rgba(29,78,216,0.08)',   grad: 'linear-gradient(135deg,#1E3A8A,#1D4ED8)' },
  motorcycle: { label: 'มอเตอร์ไซค์', icon: Bike, color: '#0891B2', bg: 'rgba(8,145,178,0.08)',    grad: 'linear-gradient(135deg,#164E63,#0891B2)' },
  overnight:  { label: 'ค้างคืน',      icon: Moon, color: '#7C3AED', bg: 'rgba(124,58,237,0.08)',   grad: 'linear-gradient(135deg,#4C1D95,#7C3AED)' },
}

const fmt = (n: number) => n.toLocaleString('th-TH')

function shortDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

function formatDateThai(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
}

export default function ReportsPage() {
  const [period,  setPeriod]  = useState<'day' | 'week' | 'month'>('week')
  const [data,    setData]    = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchReport = useCallback(async (p: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/revenue?period=${p}`)
      setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchReport(period) }, [period, fetchReport])

  const maxBar = data ? Math.max(...data.daily.map(d => d.total), 1) : 1

  return (
    <>
      {/* ── HEADER ── */}
      <header className="shrink-0 h-14 bg-white flex items-center justify-between px-6"
        style={{ borderBottom: '1px solid #E8ECF4' }}>
        <div className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded-lg"
            style={{ background: 'rgba(29,78,216,0.08)' }}>
            <BarChart2 className="size-3.5" style={{ color: '#1D4ED8' }} />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 leading-none">รายงานรายได้</h1>
            {data && (
              <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                <Calendar className="size-2.5" />
                {formatDateThai(data.startDate)} — {formatDateThai(data.endDate)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Period selector */}
          <div className="flex items-center rounded-xl p-0.5" style={{ background: '#F1F5F9' }}>
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className="h-7 px-3 rounded-lg text-xs font-bold transition-all"
                style={period === p.key
                  ? { background: 'white', color: '#1D4ED8', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
                  : { color: '#94A3B8' }}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={() => fetchReport(period)} disabled={loading}
            className="size-8 flex items-center justify-center rounded-xl transition-colors hover:bg-slate-100 disabled:opacity-50">
            <RefreshCw className={`size-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        {loading && !data && (
          <div className="flex items-center justify-center h-40">
            <RefreshCw className="size-5 text-slate-300 animate-spin" />
          </div>
        )}

        {data && (
          <>
            {/* ── HERO SUMMARY STRIP ── */}
            <div className="relative overflow-hidden px-5 pt-5 pb-0">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    label: 'รายได้รวม',
                    value: `฿${fmt(data.summary.total)}`,
                    sub:   `${fmt(data.summary.count)} รายการ`,
                    icon:  TrendingUp,
                    grad:  'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 100%)',
                    glow:  'rgba(29,78,216,0.3)',
                  },
                  {
                    label: 'เฉลี่ย/ครั้ง',
                    value: `฿${fmt(Math.round(data.summary.avg))}`,
                    sub:   'บาทต่อคัน',
                    icon:  BarChart2,
                    grad:  'linear-gradient(135deg, #164E63 0%, #0891B2 100%)',
                    glow:  'rgba(8,145,178,0.3)',
                  },
                  {
                    label: 'สูงสุด/ครั้ง',
                    value: `฿${fmt(data.summary.maxFee)}`,
                    sub:   'ในช่วงที่เลือก',
                    icon:  ArrowUpRight,
                    grad:  'linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)',
                    glow:  'rgba(124,58,237,0.3)',
                  },
                  {
                    label: 'ค่าปรับบัตรหาย',
                    value: `฿${fmt(data.summary.lostFines)}`,
                    sub:   'รวมทั้งหมด',
                    icon:  AlertTriangle,
                    grad:  'linear-gradient(135deg, #7F1D1D 0%, #DC2626 100%)',
                    glow:  'rgba(220,38,38,0.3)',
                  },
                ].map(kpi => {
                  const Icon = kpi.icon
                  return (
                    <div key={kpi.label} className="rounded-2xl p-4 text-white relative overflow-hidden"
                      style={{ background: kpi.grad, boxShadow: `0 4px 20px ${kpi.glow}` }}>
                      <div className="absolute top-2 right-2 size-12 rounded-full pointer-events-none"
                        style={{ background: 'rgba(255,255,255,0.07)' }} />
                      <Icon className="size-5 mb-3 opacity-80" strokeWidth={1.75} />
                      <p className="text-xl font-black leading-none">{kpi.value}</p>
                      <p className="text-[10px] font-medium opacity-70 mt-1">{kpi.label}</p>
                      <p className="text-[9px] opacity-50 mt-0.5">{kpi.sub}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="p-5 space-y-4">

              {/* ── BAR CHART ── */}
              {data.daily.length > 0 && (
                <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid #E8ECF4' }}>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <p className="text-sm font-black text-slate-900">รายได้รายวัน</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">แยกตามประเภทบัตร</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {[
                        { label: 'รถยนต์',        color: '#1D4ED8' },
                        { label: 'มอเตอร์ไซค์',  color: '#0891B2' },
                        { label: 'ค้างคืน',       color: '#7C3AED' },
                      ].map(l => (
                        <span key={l.label} className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                          <span className="size-2 rounded-sm" style={{ background: l.color }} />
                          {l.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-end gap-1 h-44 relative">
                    {/* Y-axis guide lines */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-5">
                      {[100, 75, 50, 25, 0].map(pct => (
                        <div key={pct} className="flex items-center gap-1.5">
                          <span className="text-[8px] text-slate-300 w-6 text-right tabular-nums">
                            {pct > 0 ? fmt(Math.round(maxBar * pct / 100)) : '0'}
                          </span>
                          <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.04)' }} />
                        </div>
                      ))}
                    </div>

                    {/* Bars */}
                    <div className="flex-1 flex items-end gap-1 pl-8 pb-5 h-full">
                      {data.daily.map(row => {
                        const carH  = (row.car        / maxBar) * 128
                        const motoH = (row.motorcycle  / maxBar) * 128
                        const ovH   = (row.overnight   / maxBar) * 128
                        return (
                          <div key={row._id} className="flex-1 flex flex-col items-center gap-0.5 group cursor-default">
                            <div className="w-full relative" style={{ height: '128px' }}>
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap text-[9px] font-bold text-white px-2 py-1 rounded-lg shadow"
                                style={{ background: '#1E293B' }}>
                                ฿{fmt(row.total)}
                              </div>
                              <div className="absolute bottom-0 left-0.5 right-0.5 flex flex-col-reverse gap-px">
                                {ovH   > 0 && <div className="rounded-t-sm min-h-[2px]" style={{ height: `${ovH}px`,   background: '#7C3AED' }} />}
                                {motoH > 0 && <div className="min-h-[2px]"              style={{ height: `${motoH}px`, background: '#0891B2' }} />}
                                {carH  > 0 && <div className="rounded-b-sm min-h-[2px]" style={{ height: `${carH}px`,  background: '#1D4ED8' }} />}
                                {row.total === 0 && <div className="rounded-sm" style={{ height: 2, background: '#E8ECF4' }} />}
                              </div>
                            </div>
                            <span className="text-[8px] text-slate-400">{shortDate(row._id)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── BY-TYPE ── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {['car', 'motorcycle', 'overnight'].map(t => {
                  const row  = data.byType.find(r => r._id === t)
                  const meta = TYPE_META[t]
                  const Icon = meta.icon
                  const pct  = data.summary.total > 0 && row ? Math.round(row.total / data.summary.total * 100) : 0
                  return (
                    <div key={t} className="bg-white rounded-2xl p-4 relative overflow-hidden"
                      style={{ border: '1px solid #E8ECF4' }}>
                      <div className="absolute top-0 right-0 w-20 h-20 rounded-full pointer-events-none"
                        style={{ background: meta.bg, transform: 'translate(30%, -30%)' }} />
                      <div className="flex items-center gap-2 mb-3">
                        <div className="size-8 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: meta.bg }}>
                          <Icon className="size-4" style={{ color: meta.color }} strokeWidth={1.75} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-800">{meta.label}</p>
                          <p className="text-[9px] text-slate-400">{pct}% ของรายได้รวม</p>
                        </div>
                      </div>
                      {row ? (
                        <>
                          <p className="text-lg font-black leading-none mb-1" style={{ color: meta.color }}>
                            ฿{fmt(row.total)}
                          </p>
                          <div className="flex items-center gap-3 text-[10px] text-slate-500 mb-3">
                            <span>{fmt(row.count)} ครั้ง</span>
                            <span className="w-px h-3 bg-slate-200" />
                            <span>เฉลี่ย ฿{fmt(Math.round(row.avg))}</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                            <div className="h-1.5 rounded-full transition-all"
                              style={{ width: `${pct}%`, background: meta.grad }} />
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-slate-300 py-2">ไม่มีข้อมูล</p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* ── TABLE ── */}
              {data.daily.length > 0 && (
                <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
                  <div className="px-5 py-3.5 flex items-center justify-between"
                    style={{ borderBottom: '1px solid #E8ECF4' }}>
                    <div className="flex items-center gap-2">
                      <Calendar className="size-3.5 text-slate-400" />
                      <p className="text-xs font-black text-slate-900">ตารางรายได้แต่ละวัน</p>
                    </div>
                    <div className="flex items-center gap-1 text-slate-300">
                      <ChevronLeft className="size-4" />
                      <ChevronRight className="size-4" />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr style={{ background: '#F8FAFF' }}>
                          {['วันที่', 'รถยนต์', 'มอเตอร์ไซค์', 'ค้างคืน', 'ค่าปรับ', 'ครั้ง', 'รวม'].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left font-black text-slate-500 text-[10px] uppercase tracking-wide"
                              style={{ borderBottom: '1px solid #E8ECF4' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...data.daily].reverse().map((row, i) => (
                          <tr key={row._id}
                            className="group hover:bg-blue-50 transition-colors"
                            style={{ background: i % 2 === 0 ? 'white' : '#FAFBFF' }}>
                            <td className="px-4 py-2.5 text-xs font-black text-slate-700">{shortDate(row._id)}</td>
                            <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: '#1D4ED8' }}>฿{fmt(row.car)}</td>
                            <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: '#0891B2' }}>฿{fmt(row.motorcycle)}</td>
                            <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: '#7C3AED' }}>฿{fmt(row.overnight)}</td>
                            <td className="px-4 py-2.5 text-xs font-semibold"
                              style={{ color: row.lostFines > 0 ? '#DC2626' : '#CBD5E1' }}>
                              {row.lostFines > 0 ? `฿${fmt(row.lostFines)}` : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-xs font-semibold text-slate-600">{row.count}</td>
                            <td className="px-4 py-2.5 text-xs font-black" style={{ color: '#1D4ED8' }}>฿{fmt(row.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#EEF2FF', borderTop: '2px solid #C7D2FE' }}>
                          <td className="px-4 py-2.5 text-xs font-black text-slate-800">รวม</td>
                          <td className="px-4 py-2.5 text-xs font-black" style={{ color: '#1D4ED8' }}>฿{fmt(data.daily.reduce((s,r)=>s+r.car,0))}</td>
                          <td className="px-4 py-2.5 text-xs font-black" style={{ color: '#0891B2' }}>฿{fmt(data.daily.reduce((s,r)=>s+r.motorcycle,0))}</td>
                          <td className="px-4 py-2.5 text-xs font-black" style={{ color: '#7C3AED' }}>฿{fmt(data.daily.reduce((s,r)=>s+r.overnight,0))}</td>
                          <td className="px-4 py-2.5 text-xs font-black" style={{ color: '#DC2626' }}>฿{fmt(data.summary.lostFines)}</td>
                          <td className="px-4 py-2.5 text-xs font-black text-slate-800">{data.summary.count}</td>
                          <td className="px-4 py-2.5 text-xs font-black" style={{ color: '#1D4ED8' }}>฿{fmt(data.summary.total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {data.daily.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl"
                  style={{ border: '1px solid #E8ECF4' }}>
                  <div className="size-14 rounded-2xl flex items-center justify-center mb-3"
                    style={{ background: 'rgba(29,78,216,0.06)' }}>
                    <BarChart2 className="size-7" style={{ color: '#C7D2FE' }} />
                  </div>
                  <p className="text-sm font-black text-slate-400">ไม่มีข้อมูลในช่วงนี้</p>
                  <p className="text-xs text-slate-300 mt-1">ลองเปลี่ยนช่วงเวลา หรือรอข้อมูลใหม่</p>
                </div>
              )}

            </div>
          </>
        )}
      </div>
    </>
  )
}
