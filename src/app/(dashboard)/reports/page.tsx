'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Area, AreaChart, Bar, BarChart,
  CartesianGrid, XAxis, YAxis,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  BarChart2, TrendingUp, Car, Bike, Moon, AlertTriangle,
  RefreshCw, ArrowUpRight, Calendar, SlidersHorizontal, History,
  FileSpreadsheet, FileText, Columns3, Check as CheckIcon,
} from 'lucide-react'
import { SessionHistory } from '@/components/reports/SessionHistory'
import { exportRowsToExcel, exportRowsToPDF, type ExportColumn } from '@/lib/reportExport'

interface MonthlyRow { _id: string; total: number; count: number; car: number; motorcycle: number; overnight: number; overnightCount: number; lostFines: number }
interface DailyRow   { _id: string; total: number; count: number; car: number; motorcycle: number; overnight: number; overnightCount: number; lostFines: number }
interface TypeRow    { _id: string; total: number; count: number; avg: number; avgDurationMin: number }
interface Summary    { total: number; count: number; avg: number; lostFines: number; maxFee: number }
interface AvgOccupancy { car: number; motorcycle: number }
interface HourlyRow { hour: number; total: number; count: number; avgTotal: number; avgCount: number }
interface ReportData {
  period: string; startDate: string; endDate: string
  daily: DailyRow[]; monthly: MonthlyRow[]; byType: TypeRow[]; summary: Summary
  avgOccupancy: AvgOccupancy
  hourly: HourlyRow[]; periodDays: number
}

type PeriodKey = 'day' | 'week' | 'month' | 'custom'
type MonthlyKey = 'total' | 'car' | 'motorcycle' | 'overnight'

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'day',    label: 'วันนี้'    },
  { key: 'week',   label: '7 วัน'    },
  { key: 'month',  label: 'เดือนนี้' },
  { key: 'custom', label: 'กำหนดเอง' },
]

const TYPE_META: Record<string, { label: string; icon: typeof Car; color: string; bg: string; grad: string }> = {
  car:        { label: 'รถยนต์',       icon: Car,  color: '#A16207', bg: 'rgba(161,98,7,0.1)',  grad: 'linear-gradient(135deg,#713F12,#A16207)' },
  motorcycle: { label: 'รถจักรยานยนต์', icon: Bike, color: '#0891B2', bg: 'rgba(8,145,178,0.1)',  grad: 'linear-gradient(135deg,#164E63,#0891B2)' },
  overnight:  { label: 'ค้างคืน',     icon: Moon, color: '#7C3AED', bg: 'rgba(124,58,237,0.1)', grad: 'linear-gradient(135deg,#4C1D95,#7C3AED)' },
}

// ── ตารางรายวัน: คอลัมน์ที่โชว์/export ได้ (วันที่ล็อกไว้เสมอ) ──
const REPORT_COLUMNS: ExportColumn[] = [
  { key: '_id',        label: 'วันที่' ,            pdfLabel: 'Date' },
  { key: 'car',        label: 'รถยนต์ (บาท)',        pdfLabel: 'Car (THB)' },
  { key: 'motorcycle', label: 'รถจักรยานยนต์ (บาท)', pdfLabel: 'Motorcycle (THB)' },
  { key: 'overnight',  label: 'ค้างคืน (บาท)',       pdfLabel: 'Overnight (THB)' },
  { key: 'lostFines',  label: 'ค่าปรับ (บาท)',       pdfLabel: 'Fines (THB)' },
  { key: 'count',      label: 'จำนวนคัน',            pdfLabel: 'Count' },
  { key: 'total',      label: 'รวม (บาท)',           pdfLabel: 'Total (THB)' },
]
const REPORT_COLUMNS_STORAGE_KEY = 'np_reports_columns'

// ── Chart configs ────────────────────────────────────────────────
const dailyChartConfig = {
  car:        { label: 'รถยนต์',       color: '#A16207' },
  motorcycle: { label: 'รถจักรยานยนต์', color: '#0891B2' },
  overnight:  { label: 'ค้างคืน',     color: '#7C3AED' },
} satisfies ChartConfig

const monthlyChartConfig = {
  total:      { label: 'รายได้รวม',   color: '#A16207' },
  car:        { label: 'รถยนต์',      color: '#CA8A04' },
  motorcycle: { label: 'รถจักรยานยนต์', color: '#0891B2' },
  overnight:  { label: 'ค้างคืน',    color: '#7C3AED' },
} satisfies ChartConfig

const overnightCountChartConfig = {
  overnightCount: { label: 'รถค้างคืน', color: '#7C3AED' },
} satisfies ChartConfig

const hourlyChartConfig = {
  total:    { label: 'รายได้',   color: '#A16207' },
  avgTotal: { label: 'รายได้เฉลี่ย/วัน', color: '#A16207' },
} satisfies ChartConfig

const fmt         = (n: number) => n.toLocaleString('th-TH')
const toInputDate = (d: Date)   => d.toISOString().slice(0, 10)
const fmtDurationMin = (min: number) => {
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return h > 0 ? `${h}ชม. ${m}น.` : `${m}น.`
}

function shortDate(iso: string) {
  const d = new Date(iso + (iso.length === 7 ? '-01' : ''))
  return d.toLocaleDateString('th-TH', { day: iso.length === 10 ? 'numeric' : undefined, month: 'short' })
}
function formatDateThai(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
}
function shortNum(v: number) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
  if (v >= 1000)    return `${(v / 1000).toFixed(0)}k`
  return fmt(v)
}
function thaiMonth(iso: string) {
  return new Date(iso + '-01').toLocaleDateString('th-TH', { month: 'short', year: '2-digit' })
}

// ── Main page ─────────────────────────────────────────────────────
export default function ReportsPage() {
  const today   = toInputDate(new Date())
  const weekAgo = toInputDate(new Date(Date.now() - 6 * 86400000))

  const [tab,         setTab]         = useState<'revenue' | 'history'>('revenue')
  const [period,      setPeriod]      = useState<PeriodKey>('week')
  const [dateFrom,    setDateFrom]    = useState(weekAgo)
  const [dateTo,      setDateTo]      = useState(today)
  const [data,        setData]        = useState<ReportData | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [activeMonth, setActiveMonth] = useState<MonthlyKey>('total')
  const [hourlyMode,  setHourlyMode]  = useState<'sum' | 'avg'>('sum')

  // คอลัมน์ที่จะโชว์ในตารางรายวัน + export — จำค่าไว้ต่อเบราว์เซอร์ (วันที่ล็อกไว้เสมอ ไม่ togglable)
  const togglableColumns = REPORT_COLUMNS.filter(c => c.key !== '_id')
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => new Set(togglableColumns.map(c => c.key)))
  const [colPanelOpen, setColPanelOpen] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REPORT_COLUMNS_STORAGE_KEY)
      if (saved) setVisibleCols(new Set(JSON.parse(saved)))
    } catch { /* localStorage unavailable — keep defaults */ }
  }, [])

  function toggleColumn(key: string) {
    setVisibleCols(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      try { localStorage.setItem(REPORT_COLUMNS_STORAGE_KEY, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  const activeColumns = REPORT_COLUMNS.filter(c => c.key === '_id' || visibleCols.has(c.key))

  function exportFilename() {
    if (!data) return 'revenue-report'
    return `revenue-report_${data.startDate.slice(0, 10)}_to_${data.endDate.slice(0, 10)}`
  }
  function handleExportExcel() {
    if (!data) return
    exportRowsToExcel(data.daily, activeColumns, exportFilename())
  }
  function handleExportPDF() {
    if (!data) return
    exportRowsToPDF(data.daily, activeColumns, exportFilename(), 'Revenue Report')
  }

  const fetchReport = useCallback(async (p: PeriodKey, from: string, to: string) => {
    setLoading(true)
    try {
      const url = p === 'custom'
        ? `/api/reports/revenue?period=custom&dateFrom=${from}&dateTo=${to}`
        : `/api/reports/revenue?period=${p}`
      setData(await (await fetch(url)).json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (period !== 'custom') fetchReport(period, dateFrom, dateTo)
  }, [period, fetchReport]) // eslint-disable-line react-hooks/exhaustive-deps

  function applyCustom() {
    if (dateFrom && dateTo) fetchReport('custom', dateFrom, dateTo)
  }

  // totals for monthly interactive header
  const monthlyTotals = data ? {
    total:      data.monthly.reduce((s, r) => s + r.total, 0),
    car:        data.monthly.reduce((s, r) => s + r.car, 0),
    motorcycle: data.monthly.reduce((s, r) => s + r.motorcycle, 0),
    overnight:  data.monthly.reduce((s, r) => s + r.overnight, 0),
  } : { total: 0, car: 0, motorcycle: 0, overnight: 0 }

  return (
    <>
      {/* ── HEADER ── */}
      <header className="shrink-0 bg-white" style={{ borderBottom: '1px solid #E8ECF4' }}>
        <div className="flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-3">
            <div className="size-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(161,98,7,0.08)' }}>
              <BarChart2 className="size-3.5" style={{ color: '#A16207' }} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-none">{tab === 'history' ? 'ประวัติรายการ' : 'รายงานรายได้'}</h1>
              {tab === 'revenue' && data && (
                <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                  <Calendar className="size-2.5" />
                  {formatDateThai(data.startDate)} — {formatDateThai(data.endDate)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg p-0.5 gap-0.5" style={{ background: '#F1F5F9' }}>
              {[
                { key: 'revenue' as const, label: 'รายได้',       icon: BarChart2 },
                { key: 'history' as const, label: 'ประวัติรายการ', icon: History   },
              ].map(t => {
                const TIcon = t.icon
                return (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className="h-7 px-3 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1"
                    style={tab === t.key
                      ? { background: 'white', color: '#A16207', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
                      : { color: '#94A3B8' }}>
                    <TIcon className="size-3" />
                    {t.label}
                  </button>
                )
              })}
            </div>

            {tab === 'revenue' && (
              <>
                <div className="flex items-center rounded-lg p-0.5 gap-0.5" style={{ background: '#F1F5F9' }}>
                  {PERIODS.map(p => (
                    <button key={p.key}
                      onClick={() => {
                        setPeriod(p.key)
                        if (p.key !== 'custom') fetchReport(p.key, dateFrom, dateTo)
                      }}
                      className="h-7 px-3 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1"
                      style={period === p.key
                        ? { background: 'white', color: '#A16207', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
                        : { color: '#94A3B8' }}>
                      {p.key === 'custom' && <SlidersHorizontal className="size-3" />}
                      {p.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => fetchReport(period, dateFrom, dateTo)} disabled={loading}
                  className="size-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors disabled:opacity-50">
                  <RefreshCw className={`size-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                </button>

                <div className="w-px h-5 bg-slate-200" />

                {/* เลือกคอลัมน์ที่จะโชว์/export */}
                <div className="relative">
                  <button onClick={() => setColPanelOpen(v => !v)}
                    className="h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
                    style={{ border: '1px solid #E2E8F0' }}>
                    <Columns3 className="size-3.5" /> คอลัมน์
                  </button>
                  {colPanelOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setColPanelOpen(false)} />
                      <div className="absolute right-0 top-9 z-50 w-56 rounded-xl bg-white p-2 shadow-lg"
                        style={{ border: '1px solid #E8ECF4' }}>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide px-2 py-1">
                          โชว์คอลัมน์ในตาราง/export
                        </p>
                        {togglableColumns.map(c => {
                          const active = visibleCols.has(c.key)
                          return (
                            <button key={c.key} onClick={() => toggleColumn(c.key)}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-left hover:bg-slate-50 transition-colors"
                              style={{ color: active ? '#1E293B' : '#94A3B8' }}>
                              <span className="size-4 rounded flex items-center justify-center shrink-0"
                                style={{ background: active ? '#A16207' : '#F1F5F9' }}>
                                {active && <CheckIcon className="size-3 text-white" />}
                              </span>
                              {c.label}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* Export */}
                <button onClick={handleExportExcel} disabled={!data || data.daily.length === 0}
                  title="Export Excel"
                  className="h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-40"
                  style={{ border: '1px solid #E2E8F0' }}>
                  <FileSpreadsheet className="size-3.5" style={{ color: '#059669' }} /> Excel
                </button>
                <button onClick={handleExportPDF} disabled={!data || data.daily.length === 0}
                  title="Export PDF"
                  className="h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-40"
                  style={{ border: '1px solid #E2E8F0' }}>
                  <FileText className="size-3.5" style={{ color: '#DC2626' }} /> PDF
                </button>
              </>
            )}
          </div>
        </div>

        {tab === 'revenue' && period === 'custom' && (
          <div className="flex items-center gap-3 px-6 pb-3">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-semibold text-slate-400 whitespace-nowrap">ตั้งแต่</label>
              <input type="date" value={dateFrom} max={dateTo || today}
                onChange={e => setDateFrom(e.target.value)}
                className="h-8 px-3 rounded-lg text-xs text-slate-700 outline-none"
                style={{ border: '1.5px solid #E8ECF4', background: '#FAFBFF' }}
                onFocus={e => e.currentTarget.style.borderColor = '#A16207'}
                onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'} />
            </div>
            <span className="text-slate-300">—</span>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-semibold text-slate-400 whitespace-nowrap">ถึง</label>
              <input type="date" value={dateTo} min={dateFrom} max={today}
                onChange={e => setDateTo(e.target.value)}
                className="h-8 px-3 rounded-lg text-xs text-slate-700 outline-none"
                style={{ border: '1.5px solid #E8ECF4', background: '#FAFBFF' }}
                onFocus={e => e.currentTarget.style.borderColor = '#A16207'}
                onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'} />
            </div>
            <button onClick={applyCustom} disabled={!dateFrom || !dateTo || loading}
              className="h-8 px-4 rounded-lg text-xs font-semibold text-black flex items-center gap-1.5 disabled:opacity-50 hover:opacity-90 transition-opacity"
              style={{ background: '#EAB308' }}>
              {loading ? <RefreshCw className="size-3 animate-spin" /> : <ArrowUpRight className="size-3" />}
              ดูรายงาน
            </button>
          </div>
        )}
      </header>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-auto bg-slate-50/60">
        {tab === 'history' && (
          <div className="p-5">
            <SessionHistory />
          </div>
        )}

        {tab === 'revenue' && loading && !data && (
          <div className="flex items-center justify-center h-40">
            <RefreshCw className="size-5 text-slate-300 animate-spin" />
          </div>
        )}

        {tab === 'revenue' && data && (
          <div className="p-5 space-y-4">

            {/* KPI strip */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'รายได้รวม',      value: `฿${fmt(data.summary.total)}`,            sub: `${fmt(data.summary.count)} รายการ`, icon: TrendingUp,    grad: 'linear-gradient(135deg,#713F12,#A16207)', glow: 'rgba(161,98,7,0.22)'  },
                { label: 'เฉลี่ย/ครั้ง',   value: `฿${fmt(Math.round(data.summary.avg))}`, sub: 'บาทต่อคัน',                           icon: BarChart2,     grad: 'linear-gradient(135deg,#164E63,#0891B2)', glow: 'rgba(8,145,178,0.22)'  },
                { label: 'สูงสุด/ครั้ง',   value: `฿${fmt(data.summary.maxFee)}`,           sub: 'ในช่วงที่เลือก',                       icon: ArrowUpRight,  grad: 'linear-gradient(135deg,#4C1D95,#7C3AED)', glow: 'rgba(124,58,237,0.22)' },
                { label: 'ค่าปรับบัตรหาย', value: `฿${fmt(data.summary.lostFines)}`,       sub: 'รวมทั้งหมด',                           icon: AlertTriangle, grad: 'linear-gradient(135deg,#7F1D1D,#DC2626)', glow: 'rgba(220,38,38,0.22)'  },
              ].map(k => {
                const Icon = k.icon
                return (
                  <div key={k.label} className="rounded-xl p-4 text-white relative overflow-hidden"
                    style={{ background: k.grad, boxShadow: `0 4px 18px ${k.glow}` }}>
                    <div className="absolute -top-3 -right-3 size-16 rounded-full pointer-events-none"
                      style={{ background: 'rgba(255,255,255,0.07)' }} />
                    <Icon className="size-4 opacity-75 mb-3" strokeWidth={1.75} />
                    <p className="text-2xl font-bold leading-none">{k.value}</p>
                    <p className="text-[10px] font-semibold opacity-65 mt-1">{k.label}</p>
                    <p className="text-[9px] opacity-40 mt-0.5">{k.sub}</p>
                  </div>
                )
              })}
            </div>

            {/* ── ค่าเฉลี่ยจำนวนรถในลาน ── */}
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: 'car' as const,        label: 'รถยนต์',       icon: Car,  color: '#A16207', bg: 'rgba(161,98,7,0.08)'  },
                { key: 'motorcycle' as const, label: 'รถจักรยานยนต์', icon: Bike, color: '#0891B2', bg: 'rgba(8,145,178,0.08)' },
              ]).map(({ key, label, icon: Icon, color, bg }) => (
                <div key={key} className="bg-white rounded-xl p-4 flex items-center gap-3.5"
                  style={{ border: '1px solid #E8ECF4' }}>
                  <div className="size-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: bg }}>
                    <Icon className="size-4" style={{ color }} strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-lg font-black leading-none" style={{ color }}>
                      {data.avgOccupancy[key].toLocaleString('th-TH')} <span className="text-xs font-semibold text-slate-400">คัน</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">จำนวนรถในลานเฉลี่ย ({label})</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── DAILY AREA CHART (chart-tooltip-default) ── */}
            {data.daily.length > 0 ? (
              <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
                <div className="flex items-center justify-between px-5 pt-4 pb-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">รายได้รายวัน</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{data.daily.length} วัน ในช่วงที่เลือก</p>
                  </div>
                </div>
                <div className="px-2 pb-4">
                  <ChartContainer config={dailyChartConfig} className="h-[220px] w-full">
                    <AreaChart data={data.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="fillCar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="var(--color-car)"   stopOpacity={0.5} />
                          <stop offset="95%" stopColor="var(--color-car)"   stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="fillMoto" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="var(--color-motorcycle)" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="var(--color-motorcycle)" stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="fillOver" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="var(--color-overnight)" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="var(--color-overnight)" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="#F1F5F9" />
                      <XAxis
                        dataKey="_id"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={shortDate}
                        tick={{ fontSize: 10, fill: '#94A3B8' }}
                        interval={data.daily.length > 14 ? Math.ceil(data.daily.length / 8) - 1 : 0}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={4}
                        tickFormatter={v => `฿${shortNum(v)}`}
                        tick={{ fontSize: 10, fill: '#94A3B8' }}
                        width={52}
                      />
                      <ChartTooltip
                        cursor={{ stroke: '#E2E8F0', strokeWidth: 1 }}
                        content={
                          <ChartTooltipContent
                            indicator="dot"
                            labelFormatter={v => shortDate(String(v))}
                            formatter={(value, name) => [
                              `฿${fmt(Number(value))}`,
                              dailyChartConfig[name as keyof typeof dailyChartConfig]?.label ?? name,
                            ]}
                          />
                        }
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Area
                        dataKey="car"
                        type="natural"
                        fill="url(#fillCar)"
                        stroke="var(--color-car)"
                        strokeWidth={2}
                        stackId="a"
                      />
                      <Area
                        dataKey="motorcycle"
                        type="natural"
                        fill="url(#fillMoto)"
                        stroke="var(--color-motorcycle)"
                        strokeWidth={2}
                        stackId="a"
                      />
                      <Area
                        dataKey="overnight"
                        type="natural"
                        fill="url(#fillOver)"
                        stroke="var(--color-overnight)"
                        strokeWidth={2}
                        stackId="a"
                      />
                    </AreaChart>
                  </ChartContainer>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl flex flex-col items-center justify-center py-16"
                style={{ border: '1px solid #E8ECF4' }}>
                <BarChart2 className="size-8 text-slate-200 mb-2" />
                <p className="text-sm font-bold text-slate-400">ไม่มีข้อมูลในช่วงนี้</p>
                <p className="text-xs text-slate-300 mt-1">ลองเปลี่ยนช่วงเวลา</p>
              </div>
            )}

            {/* ── MONTHLY BAR CHART (chart-bar-interactive) ── */}
            {data.monthly.length > 0 && (
              <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
                {/* interactive header */}
                <div className="flex items-stretch" style={{ borderBottom: '1px solid #E8ECF4' }}>
                  <div className="px-5 py-4 flex-1 flex items-center gap-3">
                    <BarChart2 className="size-4 text-slate-400" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">รายได้รายเดือน</p>
                      <p className="text-[10px] text-slate-400">12 เดือนล่าสุด · คลิกเพื่อเลือกมุมมอง</p>
                    </div>
                  </div>
                  {/* interactive toggle tabs */}
                  <div className="flex" style={{ borderLeft: '1px solid #E8ECF4' }}>
                    {(Object.keys(monthlyChartConfig) as MonthlyKey[]).map(key => {
                      const isActive = activeMonth === key
                      const color    = monthlyChartConfig[key].color
                      return (
                        <button
                          key={key}
                          onClick={() => setActiveMonth(key)}
                          className="flex flex-col items-end justify-center px-5 py-3 text-right transition-colors"
                          style={{
                            borderLeft: '1px solid #E8ECF4',
                            background: isActive ? 'rgba(161,98,7,0.03)' : 'transparent',
                            borderBottom: isActive ? `2px solid ${color}` : '2px solid transparent',
                          }}>
                          <span className="text-[10px] font-semibold text-slate-400">
                            {monthlyChartConfig[key].label}
                          </span>
                          <span className="text-lg font-bold leading-tight"
                            style={{ color: isActive ? color : '#1E293B' }}>
                            ฿{shortNum(monthlyTotals[key])}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* bar chart */}
                <div className="px-2 pb-4 pt-2">
                  <ChartContainer config={monthlyChartConfig} className="h-[220px] w-full">
                    <BarChart
                      data={data.monthly}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid vertical={false} stroke="#F1F5F9" />
                      <XAxis
                        dataKey="_id"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={thaiMonth}
                        tick={{ fontSize: 10, fill: '#94A3B8' }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={4}
                        tickFormatter={v => `฿${shortNum(v)}`}
                        tick={{ fontSize: 10, fill: '#94A3B8' }}
                        width={52}
                      />
                      <ChartTooltip
                        cursor={{ fill: 'rgba(161,98,7,0.04)' }}
                        content={
                          <ChartTooltipContent
                            indicator="dot"
                            labelFormatter={v => thaiMonth(String(v))}
                            formatter={(value, name) => [
                              `฿${fmt(Number(value))}`,
                              monthlyChartConfig[name as keyof typeof monthlyChartConfig]?.label ?? name,
                            ]}
                          />
                        }
                      />
                      <Bar
                        dataKey={activeMonth}
                        fill={`var(--color-${activeMonth})`}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={48}
                      />
                    </BarChart>
                  </ChartContainer>
                </div>
              </div>
            )}

            {/* Type breakdown */}
            {data.daily.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {['car', 'motorcycle', 'overnight'].map(t => {
                  const row  = data.byType.find(r => r._id === t)
                  const meta = TYPE_META[t]
                  const Icon = meta.icon
                  const pct  = data.summary.total > 0 && row ? Math.round(row.total / data.summary.total * 100) : 0
                  return (
                    <div key={t} className="bg-white rounded-xl p-4 relative overflow-hidden"
                      style={{ border: '1px solid #E8ECF4' }}>
                      <div className="absolute -top-4 -right-4 size-20 rounded-full pointer-events-none"
                        style={{ background: meta.bg }} />
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="size-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: meta.bg }}>
                          <Icon className="size-4" style={{ color: meta.color }} strokeWidth={1.75} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{meta.label}</p>
                          <p className="text-[10px] text-slate-400">{pct}% ของรายได้รวม</p>
                        </div>
                      </div>
                      {row ? (
                        <>
                          <p className="text-2xl font-bold leading-none mb-1" style={{ color: meta.color }}>฿{fmt(row.total)}</p>
                          <div className="flex items-center gap-3 text-[10px] text-slate-500 mb-3 flex-wrap">
                            <span>{fmt(row.count)} ครั้ง</span>
                            <span className="w-px h-3 bg-slate-200" />
                            <span>เฉลี่ย ฿{fmt(Math.round(row.avg))}</span>
                            <span className="w-px h-3 bg-slate-200" />
                            <span>จอดเฉลี่ย {fmtDurationMin(row.avgDurationMin ?? 0)}</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                            <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: meta.grad }} />
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-slate-300 py-2">ไม่มีข้อมูล</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* กราฟค้างคืน: วัน/จำนวนคัน */}
            {data.daily.some(r => r.overnightCount > 0) && (
              <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
                <div className="px-5 pt-4 pb-2">
                  <p className="text-sm font-bold text-slate-900">กราฟค้างคืน — วัน / จำนวนคัน</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">จำนวนรถที่โดนคิดอัตราค้างคืนในแต่ละวัน</p>
                </div>
                <div className="px-2 pb-4">
                  <ChartContainer config={overnightCountChartConfig} className="h-[180px] w-full">
                    <BarChart data={data.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#F1F5F9" />
                      <XAxis
                        dataKey="_id"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={shortDate}
                        tick={{ fontSize: 10, fill: '#94A3B8' }}
                        interval={data.daily.length > 14 ? Math.ceil(data.daily.length / 8) - 1 : 0}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={4}
                        allowDecimals={false}
                        tick={{ fontSize: 10, fill: '#94A3B8' }}
                        width={28}
                      />
                      <ChartTooltip
                        cursor={{ fill: 'rgba(124,58,237,0.06)' }}
                        content={
                          <ChartTooltipContent
                            labelFormatter={v => shortDate(String(v))}
                            formatter={(value) => [`${value} คัน`, 'รถค้างคืน']}
                          />
                        }
                      />
                      <Bar dataKey="overnightCount" fill="var(--color-overnightCount)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </div>
              </div>
            )}

            {/* กราฟรายชั่วโมง */}
            <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <div>
                  <p className="text-sm font-bold text-slate-900">กราฟรายชั่วโมง</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    รายได้แยกตามชั่วโมงที่รถออก รวม {data.periodDays} วันในช่วงที่เลือก
                  </p>
                </div>
                {data.periodDays > 1 && (
                  <div className="flex rounded-lg overflow-hidden shrink-0" style={{ border: '1px solid #E2E8F0' }}>
                    {(['sum', 'avg'] as const).map(m => (
                      <button key={m} onClick={() => setHourlyMode(m)}
                        className="px-3 h-7 text-[10px] font-bold transition-colors"
                        style={hourlyMode === m
                          ? { background: '#A16207', color: 'black' }
                          : { background: 'white', color: '#94A3B8' }}>
                        {m === 'sum' ? 'รวม' : 'เฉลี่ย/วัน'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-2 pb-4">
                <ChartContainer config={hourlyChartConfig} className="h-[220px] w-full">
                  <BarChart data={data.hourly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#F1F5F9" />
                    <XAxis
                      dataKey="hour"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={h => `${h}:00`}
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      interval={1}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={4}
                      tickFormatter={v => `฿${shortNum(v)}`}
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      width={52}
                    />
                    <ChartTooltip
                      cursor={{ fill: 'rgba(161,98,7,0.06)' }}
                      content={
                        <ChartTooltipContent
                          labelFormatter={v => `${v}:00 - ${(Number(v) + 1) % 24}:00`}
                          formatter={(value, name) => [
                            `฿${fmt(Math.round(Number(value)))}`,
                            hourlyChartConfig[name as keyof typeof hourlyChartConfig]?.label ?? name,
                          ]}
                        />
                      }
                    />
                    <Bar dataKey={hourlyMode === 'sum' ? 'total' : 'avgTotal'} fill="var(--color-total)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            </div>

            {/* Table */}
            {data.daily.length > 0 && (
              <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
                <div className="flex items-center gap-2 px-5 py-3"
                  style={{ borderBottom: '1px solid #E8ECF4', background: '#FAFBFF' }}>
                  <Calendar className="size-3.5 text-slate-400" />
                  <p className="text-xs font-bold text-slate-700">ตารางรายได้แต่ละวัน</p>
                  <span className="ml-auto text-[10px] text-slate-400">{data.daily.length} วัน</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: '#F8FAFF', borderBottom: '1px solid #E8ECF4' }}>
                        <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">วันที่</th>
                        {visibleCols.has('car')        && <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">รถยนต์</th>}
                        {visibleCols.has('motorcycle') && <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">รถจักรยานยนต์</th>}
                        {visibleCols.has('overnight')  && <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">ค้างคืน</th>}
                        {visibleCols.has('lostFines')  && <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">ค่าปรับ</th>}
                        {visibleCols.has('count')      && <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">คัน</th>}
                        {visibleCols.has('total')      && <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">รวม</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {[...data.daily].reverse().map((row, i) => (
                        <tr key={row._id}
                          className="hover:bg-yellow-50/50 transition-colors"
                          style={{ background: i % 2 === 0 ? 'white' : '#FAFBFF', borderBottom: '1px solid #F1F5F9' }}>
                          <td className="px-4 py-2.5 text-xs font-bold text-slate-700 whitespace-nowrap">{shortDate(row._id)}</td>
                          {visibleCols.has('car') &&
                            <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: row.car        > 0 ? '#A16207' : '#CBD5E1' }}>{row.car        > 0 ? `฿${fmt(row.car)}`        : '—'}</td>}
                          {visibleCols.has('motorcycle') &&
                            <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: row.motorcycle > 0 ? '#0891B2' : '#CBD5E1' }}>{row.motorcycle > 0 ? `฿${fmt(row.motorcycle)}` : '—'}</td>}
                          {visibleCols.has('overnight') &&
                            <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: row.overnight  > 0 ? '#7C3AED' : '#CBD5E1' }}>{row.overnight  > 0 ? `฿${fmt(row.overnight)}`  : '—'}</td>}
                          {visibleCols.has('lostFines') &&
                            <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: row.lostFines  > 0 ? '#DC2626' : '#CBD5E1' }}>{row.lostFines  > 0 ? `฿${fmt(row.lostFines)}`  : '—'}</td>}
                          {visibleCols.has('count') &&
                            <td className="px-4 py-2.5 text-xs font-semibold text-slate-600">{row.count}</td>}
                          {visibleCols.has('total') &&
                            <td className="px-4 py-2.5 text-xs font-bold" style={{ color: '#A16207' }}>฿{fmt(row.total)}</td>}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#EEF2FF', borderTop: '2px solid #C7D2FE' }}>
                        <td className="px-4 py-2.5 text-xs font-bold text-slate-800">รวมทั้งหมด</td>
                        {visibleCols.has('car') &&
                          <td className="px-4 py-2.5 text-xs font-bold" style={{ color: '#A16207' }}>฿{fmt(data.daily.reduce((s,r)=>s+r.car,0))}</td>}
                        {visibleCols.has('motorcycle') &&
                          <td className="px-4 py-2.5 text-xs font-bold" style={{ color: '#0891B2' }}>฿{fmt(data.daily.reduce((s,r)=>s+r.motorcycle,0))}</td>}
                        {visibleCols.has('overnight') &&
                          <td className="px-4 py-2.5 text-xs font-bold" style={{ color: '#7C3AED' }}>฿{fmt(data.daily.reduce((s,r)=>s+r.overnight,0))}</td>}
                        {visibleCols.has('lostFines') &&
                          <td className="px-4 py-2.5 text-xs font-bold" style={{ color: '#DC2626' }}>฿{fmt(data.summary.lostFines)}</td>}
                        {visibleCols.has('count') &&
                          <td className="px-4 py-2.5 text-xs font-bold text-slate-800">{data.summary.count}</td>}
                        {visibleCols.has('total') &&
                          <td className="px-4 py-2.5 text-xs font-bold" style={{ color: '#A16207' }}>฿{fmt(data.summary.total)}</td>}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* ตารางสรุปค้างคืน */}
            {(() => {
              const overnightRows = data.daily.filter(r => r.overnightCount > 0)
              if (overnightRows.length === 0) return null
              const totalOvernightCount   = overnightRows.reduce((s, r) => s + r.overnightCount, 0)
              const totalOvernightRevenue = overnightRows.reduce((s, r) => s + r.overnight, 0)
              return (
                <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
                  <div className="flex items-center gap-2 px-5 py-3"
                    style={{ borderBottom: '1px solid #E8ECF4', background: '#FAFBFF' }}>
                    <Moon className="size-3.5 text-slate-400" />
                    <p className="text-xs font-bold text-slate-700">ตารางสรุปค้างคืน</p>
                    <span className="ml-auto text-[10px] text-slate-400">{overnightRows.length} วัน</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr style={{ background: '#F8FAFF', borderBottom: '1px solid #E8ECF4' }}>
                          {['วันที่', 'จำนวนคัน (ค้างคืน)', 'รายได้ค้างคืน', '% ของรายได้วันนั้น'].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...overnightRows].reverse().map((row, i) => (
                          <tr key={row._id}
                            className="hover:bg-violet-50/50 transition-colors"
                            style={{ background: i % 2 === 0 ? 'white' : '#FAFBFF', borderBottom: '1px solid #F1F5F9' }}>
                            <td className="px-4 py-2.5 text-xs font-bold text-slate-700 whitespace-nowrap">{shortDate(row._id)}</td>
                            <td className="px-4 py-2.5 text-xs font-semibold text-slate-600">{row.overnightCount} คัน</td>
                            <td className="px-4 py-2.5 text-xs font-bold" style={{ color: '#7C3AED' }}>฿{fmt(row.overnight)}</td>
                            <td className="px-4 py-2.5 text-xs font-semibold text-slate-600">
                              {row.total > 0 ? `${Math.round(row.overnight / row.total * 100)}%` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#F5F3FF', borderTop: '2px solid #DDD6FE' }}>
                          <td className="px-4 py-2.5 text-xs font-bold text-slate-800">รวมทั้งหมด</td>
                          <td className="px-4 py-2.5 text-xs font-bold text-slate-800">{totalOvernightCount} คัน</td>
                          <td className="px-4 py-2.5 text-xs font-bold" style={{ color: '#7C3AED' }}>฿{fmt(totalOvernightRevenue)}</td>
                          <td className="px-4 py-2.5 text-xs font-bold text-slate-800">
                            {data.summary.total > 0 ? `${Math.round(totalOvernightRevenue / data.summary.total * 100)}%` : '—'}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )
            })()}

          </div>
        )}
      </div>
    </>
  )
}
