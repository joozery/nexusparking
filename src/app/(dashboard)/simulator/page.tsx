'use client'

import { useState, useEffect, useMemo, Fragment } from 'react'
import {
  FlaskConical, Car, Bike, Moon, Plus, Trash2,
  Play, RefreshCw, CheckCircle2, AlertTriangle, X, Info,
  Upload, Download, FileSpreadsheet, ChevronDown, ChevronRight,
  Tag, Percent, Banknote,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { calcFeeBreakdown, type CardType, type FeeSegment, type OvernightConfig } from '@/lib/calcFee'
import { useToast } from '@/components/ui/Toast'

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDatetime(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('th-TH', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function fmtDuration(min: number) {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  const s = Math.round((min % 1) * 60)
  if (h > 0 && m > 0) return `${h} ชม. ${m} น.`
  if (h > 0) return `${h} ชม.`
  if (min < 1) return `${s} วิ.`
  return `${m} น.`
}

function nowLocal() {
  const d = new Date()
  d.setSeconds(0, 0)
  return d.toISOString().slice(0, 19)
}

function toMin(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function exitIsDaytime(exitIso: string, cfg: OvernightConfig): boolean {
  if (!exitIso) return false
  const exit = new Date(exitIso)
  const exitMin = exit.getHours() * 60 + exit.getMinutes()
  const weMin = toMin(cfg.windowEnd)
  const wsMin = toMin(cfg.windowStart)
  return exitMin >= weMin && exitMin < wsMin
}

const KIND_STYLE: Record<FeeSegment['kind'], { bg: string; border: string; label: string; color: string }> = {
  normal:       { bg: 'rgba(29,78,216,0.04)',  border: 'rgba(29,78,216,0.12)',  label: 'ปกติ',         color: '#1D4ED8' },
  outside:      { bg: 'rgba(217,119,6,0.05)',  border: 'rgba(217,119,6,0.15)',  label: 'นอกช่วง',      color: '#B45309' },
  overnight:    { bg: 'rgba(109,40,217,0.05)', border: 'rgba(109,40,217,0.15)', label: 'ค้างคืน',      color: '#6D28D9' },
  'after-hours':{ bg: 'rgba(220,38,38,0.05)',  border: 'rgba(220,38,38,0.15)',  label: 'นอกเวลาทำการ', color: '#DC2626' },
}

const TYPE_META: Record<CardType, { label: string; icon: typeof Car; color: string }> = {
  car:        { label: 'รถยนต์',       icon: Car,  color: '#1D4ED8' },
  motorcycle: { label: 'มอเตอร์ไซค์', icon: Bike, color: '#6D28D9' },
  overnight:  { label: 'ค้างคืน',     icon: Moon, color: '#B45309' },
}

// ── types ─────────────────────────────────────────────────────────────────────

interface DiscountDoc {
  _id:           string
  name:          string
  discountType:  'fixed' | 'percent' | 'per_day'
  discountValue: number
  maxDiscount?:  number
  description?:  string
}

interface SeedRow {
  id:            string
  plate:         string
  cardType:      CardType
  entryTime:     string
  exitTime:      string
  paymentMethod: 'cash' | 'qr'
}

// ── discount helper ───────────────────────────────────────────────────
function calcDiscount(subtotal: number, disc: DiscountDoc | null, nightCount = 1): number {
  if (!disc || subtotal <= 0) return 0
  if (disc.discountType === 'fixed')   return Math.min(disc.discountValue, subtotal)
  if (disc.discountType === 'percent') {
    const d = Math.round(subtotal * disc.discountValue / 100)
    return disc.maxDiscount != null ? Math.min(d, disc.maxDiscount) : d
  }
  if (disc.discountType === 'per_day') return Math.min(disc.discountValue * Math.max(1, nightCount), subtotal)
  return 0
}

// ── Fee Calculator ────────────────────────────────────────────────────────────

function FeeCalculator({ overnightCfg, discounts }: { overnightCfg: OvernightConfig | null; discounts: DiscountDoc[] }) {
  const [cardType,         setCardType]         = useState<CardType>('car')
  const [entryTime,        setEntryTime]        = useState(nowLocal())
  const [exitTime,         setExitTime]         = useState('')
  const [selectedDiscount, setSelectedDiscount] = useState<string>('')  // '' = none

  const breakdown = useMemo(() => {
    if (!entryTime || !exitTime) return null
    const entry = new Date(entryTime)
    const exit  = new Date(exitTime)
    if (isNaN(entry.getTime()) || isNaN(exit.getTime()) || exit <= entry) return null
    return calcFeeBreakdown(cardType, entry, exit, overnightCfg ?? undefined)
  }, [cardType, entryTime, exitTime, overnightCfg])

  const activeDiscount = discounts.find(d => d._id === selectedDiscount) ?? null
  const nightCount = breakdown?.segments.filter(s => s.kind === 'overnight').length ?? 1
  const discountAmt = breakdown ? calcDiscount(breakdown.total, activeDiscount, nightCount) : 0
  const finalTotal  = breakdown ? breakdown.total - discountAmt : 0

  const showDaytimeNote = exitTime && overnightCfg && exitIsDaytime(exitTime, overnightCfg) && cardType !== 'overnight'
    && breakdown != null && !breakdown.segments.some(s => s.kind === 'overnight')

  return (
    <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
      <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #E8ECF4', background: '#FAFBFF' }}>
        <div className="size-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(109,40,217,0.08)' }}>
          <FlaskConical className="size-4" style={{ color: '#6D28D9' }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-black text-slate-900">คำนวณค่าจอด</p>
          <p className="text-[10px] text-slate-400">กรอกเวลาเข้า-ออก เห็นผลแยกทุกช่วงทันที</p>
        </div>
        {overnightCfg && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
            style={{ background: 'rgba(109,40,217,0.06)', border: '1px solid rgba(109,40,217,0.15)' }}>
            <Moon className="size-3" style={{ color: '#6D28D9' }} />
            <span className="text-[10px] font-bold" style={{ color: '#6D28D9' }}>
              ค้างคืน {overnightCfg.windowStart}–{overnightCfg.windowEnd} · ฿{overnightCfg.flatRate}/คืน · นอกช่วง ฿{overnightCfg.extraHour}/ชม.
            </span>
          </div>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Card type */}
        <div className="grid grid-cols-3 gap-2">
          {(['car', 'motorcycle', 'overnight'] as CardType[]).map(t => {
            const m = TYPE_META[t]; const Icon = m.icon; const active = cardType === t
            return (
              <button key={t} onClick={() => setCardType(t)}
                className="flex items-center justify-center gap-2 h-10 rounded-xl text-xs font-bold transition-all"
                style={active
                  ? { background: `rgba(${t === 'car' ? '29,78,216' : t === 'motorcycle' ? '109,40,217' : '180,83,9'},0.1)`, border: `2px solid ${m.color}`, color: m.color }
                  : { background: '#F8FAFF', border: '2px solid #E2E8F0', color: '#64748B' }}>
                <Icon className="size-3.5" />
                {m.label}
              </button>
            )
          })}
        </div>

        {/* Datetime inputs */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'เวลาเข้า', value: entryTime, set: setEntryTime },
            { label: 'เวลาออก', value: exitTime,  set: setExitTime  },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1.5">{label}</label>
              <input type="datetime-local" step="1" value={value}
                onChange={e => set(e.target.value)}
                className="w-full h-10 px-3 rounded-lg text-xs text-slate-800 outline-none"
                style={{ border: '1.5px solid #E8ECF4', background: '#FAFBFF' }}
                onFocus={e => e.currentTarget.style.borderColor = '#6D28D9'}
                onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'} />
            </div>
          ))}
        </div>

        {/* Daytime exit note */}
        {showDaytimeNote && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
            style={{ background: 'rgba(29,78,216,0.04)', border: '1px solid rgba(29,78,216,0.15)' }}>
            <Info className="size-3.5 shrink-0 mt-0.5" style={{ color: '#1D4ED8' }} />
            <p className="text-[10px] font-medium" style={{ color: '#1D4ED8' }}>
              ออกก่อน {overnightCfg?.windowStart} — คิดเรทปกติ ไม่มีค่าเหมาค้างคืน แม้รถจะค้างข้ามวัน
            </p>
          </div>
        )}

        {/* Discount selector */}
        {discounts.length > 0 && (
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1.5">
              ส่วนลด
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedDiscount('')}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold transition-all"
                style={selectedDiscount === ''
                  ? { background: '#F1F5F9', border: '1.5px solid #94A3B8', color: '#475569' }
                  : { background: '#F8FAFF', border: '1.5px solid #E2E8F0', color: '#94A3B8' }}
              >
                ไม่มีส่วนลด
              </button>
              {discounts.map(d => {
                const Icon = d.discountType === 'percent' ? Percent : d.discountType === 'per_day' ? Tag : Banknote
                const label = d.discountType === 'percent'
                  ? `${d.discountValue}%${d.maxDiscount ? ` (สูงสุด ฿${d.maxDiscount})` : ''}`
                  : d.discountType === 'per_day'
                  ? `฿${d.discountValue}/คืน`
                  : `฿${d.discountValue}`
                const isActive = selectedDiscount === d._id
                return (
                  <button key={d._id}
                    onClick={() => setSelectedDiscount(d._id)}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold transition-all"
                    style={isActive
                      ? { background: 'rgba(109,40,217,0.08)', border: '1.5px solid #6D28D9', color: '#6D28D9' }
                      : { background: '#F8FAFF', border: '1.5px solid #E2E8F0', color: '#94A3B8' }}
                  >
                    <Icon className="size-3" />
                    {d.name} — {label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Breakdown */}
        {breakdown && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: '#F8FAFF', borderBottom: '1px solid #E8ECF4' }}>
                  <th className="px-3 py-2 text-left font-black text-slate-500 text-[10px] uppercase">ช่วงเวลา</th>
                  <th className="px-3 py-2 text-left font-black text-slate-500 text-[10px] uppercase">ระยะเวลา</th>
                  <th className="px-3 py-2 text-left font-black text-slate-500 text-[10px] uppercase">อัตรา</th>
                  <th className="px-3 py-2 text-right font-black text-slate-500 text-[10px] uppercase">ค่าบริการ</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.segments.map((seg, i) => {
                  const s = KIND_STYLE[seg.kind]
                  return (
                    <tr key={i} style={{ background: s.bg, borderBottom: '1px solid #E8ECF4' }}>
                      <td className="px-3 py-2.5">
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full mr-1.5"
                          style={{ background: s.border, color: s.color }}>{s.label}</span>
                        <span className="text-slate-600 text-[10px]">
                          {fmtDatetime(seg.from.toISOString())} → {fmtDatetime(seg.to.toISOString())}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 text-[10px]">{fmtDuration(seg.minutes)}</td>
                      <td className="px-3 py-2.5 text-[10px]" style={{ color: s.color }}>{seg.rateLabel}</td>
                      <td className="px-3 py-2.5 text-right font-black" style={{ color: s.color }}>฿{seg.fee}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                {discountAmt > 0 ? (
                  <>
                    <tr style={{ background: '#F8FAFF', borderTop: '1px solid #E8ECF4' }}>
                      <td colSpan={3} className="px-3 py-2 text-slate-500 text-xs">ก่อนส่วนลด</td>
                      <td className="px-3 py-2 text-right font-bold text-slate-600">฿{breakdown.total}</td>
                    </tr>
                    <tr style={{ background: 'rgba(109,40,217,0.04)' }}>
                      <td colSpan={3} className="px-3 py-2 text-xs font-bold" style={{ color: '#6D28D9' }}>
                        <Tag className="size-3 inline mr-1" />
                        ส่วนลด: {activeDiscount?.name}
                      </td>
                      <td className="px-3 py-2 text-right font-black" style={{ color: '#6D28D9' }}>-฿{discountAmt}</td>
                    </tr>
                    <tr style={{ background: '#F0F2F8', borderTop: '2px solid #E8ECF4' }}>
                      <td colSpan={3} className="px-3 py-3 font-black text-slate-700 text-xs">ยอดสุทธิ</td>
                      <td className="px-3 py-3 text-right text-lg font-black" style={{ color: '#059669' }}>฿{finalTotal}</td>
                    </tr>
                  </>
                ) : (
                  <tr style={{ background: '#F0F2F8', borderTop: '2px solid #E8ECF4' }}>
                    <td colSpan={3} className="px-3 py-3 font-black text-slate-700 text-xs">รวมทั้งหมด</td>
                    <td className="px-3 py-3 text-right text-lg font-black" style={{ color: '#1D4ED8' }}>฿{breakdown.total}</td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        )}

        {!breakdown && exitTime && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
            style={{ background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.15)' }}>
            <AlertTriangle className="size-3.5 shrink-0" style={{ color: '#DC2626' }} />
            <p className="text-[10px] text-red-600 font-medium">เวลาออกต้องมากกว่าเวลาเข้า</p>
          </div>
        )}

        {!exitTime && (
          <p className="text-[10px] text-slate-400 text-center">กรอกเวลาออกเพื่อดูผลการคำนวณ</p>
        )}
      </div>
    </div>
  )
}

// ── Batch Seed ────────────────────────────────────────────────────────────────

function BatchSeed({ overnightCfg }: { overnightCfg: OvernightConfig | null }) {
  const { success, error: toastError, warning } = useToast()
  const [rows, setRows] = useState<SeedRow[]>([])
  const [seeding, setSeeding] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  // form state for new row
  const [plate,         setPlate]         = useState('')
  const [cardType,      setCardType]      = useState<CardType>('car')
  const [entryTime,     setEntryTime]     = useState(nowLocal())
  const [exitTime,      setExitTime]      = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qr'>('cash')

  function addRow() {
    if (!plate || !entryTime || !exitTime) return
    const entry = new Date(entryTime), exit = new Date(exitTime)
    if (isNaN(entry.getTime()) || isNaN(exit.getTime()) || exit <= entry) return
    setRows(r => [...r, {
      id: crypto.randomUUID(), plate: plate.trim(), cardType,
      entryTime, exitTime, paymentMethod,
    }])
    setPlate('')
    setExitTime('')
  }

  function removeRow(id: string) {
    setRows(r => r.filter(x => x.id !== id))
  }

  async function seedAll() {
    if (rows.length === 0) return
    setSeeding(true)
    try {
      const body = rows.map(r => ({
        plate: r.plate, cardType: r.cardType,
        entryTime: r.entryTime, exitTime: r.exitTime,
        paymentMethod: r.paymentMethod,
      }))
      const res = await fetch('/api/simulate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const data = await res.json()
        success(`Seed สำเร็จ`, `บันทึก ${data.created} sessions เข้า DB แล้ว`)
        setRows([])
      } else {
        const err = await res.json()
        toastError('Seed ไม่สำเร็จ', err.error)
      }
    } finally { setSeeding(false) }
  }

  async function clearSimulated() {
    setClearing(true)
    try {
      const res = await fetch('/api/simulate', { method: 'DELETE' })
      if (res.ok) {
        const data = await res.json()
        warning('ล้างข้อมูลแล้ว', `ลบ ${data.deleted} simulated sessions`)
      } else {
        toastError('ล้างไม่สำเร็จ', 'กรุณาลองใหม่')
      }
    } finally { setClearing(false); setConfirmClear(false) }
  }

  function previewFee(r: SeedRow) {
    try {
      const { total } = calcFeeBreakdown(r.cardType, new Date(r.entryTime), new Date(r.exitTime), overnightCfg ?? undefined)
      return total
    } catch { return 0 }
  }

  const totalFee = rows.reduce((s, r) => s + previewFee(r), 0)

  const formExitIsDaytime = exitTime && entryTime && overnightCfg && exitIsDaytime(exitTime, overnightCfg) && cardType !== 'overnight'
    && (() => { try { const { segments } = calcFeeBreakdown(cardType, new Date(entryTime), new Date(exitTime), overnightCfg); return !segments.some(s => s.kind === 'overnight') } catch { return true } })()

  return (
    <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E8ECF4', background: '#FAFBFF' }}>
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(5,150,105,0.08)' }}>
            <Play className="size-4" style={{ color: '#059669' }} />
          </div>
          <div>
            <p className="text-sm font-black text-slate-900">Seed ข้อมูลเข้า DB</p>
            <p className="text-[10px] text-slate-400">เพิ่มรายการแล้วกด Seed ทั้งหมด — บันทึกเป็น session จริงในระบบ</p>
          </div>
        </div>
        {!confirmClear ? (
          <button onClick={() => setConfirmClear(true)} disabled={clearing}
            className="h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
            style={{ background: 'rgba(220,38,38,0.06)', color: '#991B1B', border: '1px solid rgba(220,38,38,0.2)' }}>
            <Trash2 className="size-3.5" />ล้างข้อมูลทดสอบ
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-red-700">ยืนยันลบทั้งหมด?</span>
            <button onClick={clearSimulated} disabled={clearing}
              className="h-7 px-2.5 rounded-lg text-xs font-black text-white"
              style={{ background: '#DC2626' }}>
              {clearing ? <RefreshCw className="size-3 animate-spin" /> : 'ลบ'}
            </button>
            <button onClick={() => setConfirmClear(false)}
              className="h-7 px-2 rounded-lg text-xs font-bold text-slate-500"
              style={{ background: '#F1F5F9' }}>ยกเลิก</button>
          </div>
        )}
      </div>

      {/* Add row form */}
      <div className="p-5 space-y-3" style={{ borderBottom: '1px solid #E8ECF4' }}>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wide">เพิ่มรายการ</p>

        <div className="grid grid-cols-3 gap-2 max-w-sm">
          {(['car', 'motorcycle', 'overnight'] as CardType[]).map(t => {
            const m = TYPE_META[t]; const Icon = m.icon; const active = cardType === t
            return (
              <button key={t} onClick={() => setCardType(t)}
                className="flex items-center justify-center gap-1.5 h-9 rounded-lg text-[10px] font-bold transition-all"
                style={active
                  ? { background: `rgba(${t === 'car' ? '29,78,216' : t === 'motorcycle' ? '109,40,217' : '180,83,9'},0.1)`, border: `1.5px solid ${m.color}`, color: m.color }
                  : { background: '#F8FAFF', border: '1.5px solid #E2E8F0', color: '#94A3B8' }}>
                <Icon className="size-3" />{m.label}
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">ทะเบียน</label>
            <input value={plate} onChange={e => setPlate(e.target.value.toUpperCase())}
              placeholder="1234"
              className="w-full h-9 px-3 rounded-lg text-sm font-black text-slate-800 outline-none tracking-widest"
              style={{ border: '1.5px solid #E8ECF4', background: '#FAFBFF' }}
              onFocus={e => e.currentTarget.style.borderColor = '#059669'}
              onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'} />
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">เข้า (วัน-เวลา)</label>
            <input type="datetime-local" step="1" value={entryTime}
              onChange={e => setEntryTime(e.target.value)}
              className="w-full h-9 px-2 rounded-lg text-[10px] text-slate-800 outline-none"
              style={{ border: '1.5px solid #E8ECF4', background: '#FAFBFF' }}
              onFocus={e => e.currentTarget.style.borderColor = '#059669'}
              onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'} />
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">ออก (วัน-เวลา)</label>
            <input type="datetime-local" step="1" value={exitTime}
              onChange={e => setExitTime(e.target.value)}
              className="w-full h-9 px-2 rounded-lg text-[10px] text-slate-800 outline-none"
              style={{ border: '1.5px solid #E8ECF4', background: '#FAFBFF' }}
              onFocus={e => e.currentTarget.style.borderColor = '#059669'}
              onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'} />
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">ชำระ</label>
            <div className="flex gap-1.5 h-9">
              {(['cash', 'qr'] as const).map(m => (
                <button key={m} onClick={() => setPaymentMethod(m)}
                  className="flex-1 rounded-lg text-[10px] font-bold transition-all"
                  style={paymentMethod === m
                    ? { background: 'rgba(5,150,105,0.1)', border: '1.5px solid #059669', color: '#059669' }
                    : { background: '#F8FAFF', border: '1.5px solid #E2E8F0', color: '#94A3B8' }}>
                  {m === 'cash' ? 'เงินสด' : 'โอน'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {formExitIsDaytime && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(29,78,216,0.04)', border: '1px solid rgba(29,78,216,0.15)' }}>
            <Info className="size-3.5 shrink-0" style={{ color: '#1D4ED8' }} />
            <p className="text-[10px] font-medium" style={{ color: '#1D4ED8' }}>
              ออกก่อน {overnightCfg?.windowStart} — จะคิดเรทปกติ (ไม่มีค่าเหมาค้างคืน)
            </p>
          </div>
        )}

        <button onClick={addRow}
          disabled={!plate || !exitTime || new Date(exitTime) <= new Date(entryTime)}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-xs font-black text-white disabled:opacity-40"
          style={{ background: '#059669' }}>
          <Plus className="size-3.5" />เพิ่มรายการ
        </button>
      </div>

      {/* Rows list */}
      {rows.length > 0 ? (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: '#F8FAFF', borderBottom: '1px solid #E8ECF4' }}>
                  {['ทะเบียน', 'ประเภท', 'เข้า', 'ออก', 'ระยะเวลา', 'ชำระ', 'ค่าจอด', ''].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-black text-slate-500 text-[10px] uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const fee = previewFee(r)
                  const m = TYPE_META[r.cardType]; const Icon = m.icon
                  const durMin = (new Date(r.exitTime).getTime() - new Date(r.entryTime).getTime()) / 60000
                  const daytime = overnightCfg && exitIsDaytime(r.exitTime, overnightCfg) && r.cardType !== 'overnight'
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFF')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td className="px-3 py-2.5 font-black text-slate-800 tracking-widest">{r.plate}</td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: m.color }}>
                          <Icon className="size-3" />{m.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[10px] text-slate-500 font-mono">{fmtDatetime(r.entryTime)}</td>
                      <td className="px-3 py-2.5 text-[10px] text-slate-500 font-mono">{fmtDatetime(r.exitTime)}</td>
                      <td className="px-3 py-2.5 text-[10px] text-slate-500">{fmtDuration(durMin)}</td>
                      <td className="px-3 py-2.5 text-[10px] text-slate-500">{r.paymentMethod === 'cash' ? 'เงินสด' : 'โอน'}</td>
                      <td className="px-3 py-2.5">
                        <span className="font-black text-emerald-700">฿{fee}</span>
                        {daytime && (
                          <span className="ml-1.5 text-[9px] font-bold px-1 py-0.5 rounded"
                            style={{ background: 'rgba(29,78,216,0.08)', color: '#1D4ED8' }}>ปกติ</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => removeRow(r.id)}
                          className="size-6 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors">
                          <X className="size-3 text-slate-400 hover:text-red-500" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#F0F2F8', borderTop: '2px solid #E8ECF4' }}>
                  <td colSpan={6} className="px-3 py-3 font-black text-slate-700 text-xs">
                    รวม {rows.length} รายการ
                  </td>
                  <td className="px-3 py-3 font-black text-emerald-700">฿{totalFee}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="p-4 flex justify-end">
            <button onClick={seedAll} disabled={seeding}
              className="h-10 px-6 rounded-xl text-sm font-black text-white flex items-center gap-2 disabled:opacity-60 hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#059669,#10B981)', boxShadow: '0 4px 16px rgba(5,150,105,0.35)' }}>
              {seeding ? <RefreshCw className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {seeding ? 'กำลัง Seed...' : `Seed ${rows.length} รายการเข้า DB`}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <FlaskConical className="size-8 text-slate-200" />
          <p className="text-sm text-slate-300 font-medium">ยังไม่มีรายการ — เพิ่มด้านบน</p>
        </div>
      )}
    </div>
  )
}

// ── Excel Tester ──────────────────────────────────────────────────────────────

interface TestRow {
  id:                string
  rowNum:            number
  plate:             string
  cardType:          CardType
  entryTime:         string    // ISO
  exitTime:          string    // ISO
  calculatedFee:     number    // gross fee
  segments:          FeeSegment[]
  shopDiscountName:  string    // col G — ชื่อส่วนลดร้านค้า (ค่าว่าง = ไม่มี)
  hotelDiscountName: string    // col H — ชื่อส่วนลดรถโรงแรม (ค่าว่าง = ไม่มี)
  error:             string | null
}

function parseExcelDate(val: unknown): Date | null {
  if (!val) return null
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val
  if (typeof val === 'number') {
    try {
      const p = XLSX.SSF.parse_date_code(val)
      return new Date(p.y, p.m - 1, p.d, p.H, p.M, p.S)
    } catch { return null }
  }
  if (typeof val === 'string') {
    const s = val.trim()
    // ISO string
    const d0 = new Date(s)
    if (!isNaN(d0.getTime())) return d0
    // DD/MM/YYYY HH:mm[:ss]
    const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
    if (m1) {
      let y = parseInt(m1[3]); if (y < 100) y += 2000; if (y > 2500) y -= 543
      return new Date(y, parseInt(m1[2]) - 1, parseInt(m1[1]), parseInt(m1[4]), parseInt(m1[5]), parseInt(m1[6] ?? '0'))
    }
    // YYYY-MM-DD HH:mm (space-separated, not ISO)
    const m2 = s.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/)
    if (m2) {
      return new Date(parseInt(m2[1]), parseInt(m2[2]) - 1, parseInt(m2[3]), parseInt(m2[4]), parseInt(m2[5]), parseInt(m2[6] ?? '0'))
    }
  }
  return null
}

function normalizeCardType(val: unknown): CardType | null {
  const s = String(val ?? '').toLowerCase().trim()
  if (['car', 'รถยนต์', 'ยนต์', 'c'].includes(s)) return 'car'
  if (['motorcycle', 'มอเตอร์ไซค์', 'moto', 'bike', 'm', 'motor'].includes(s)) return 'motorcycle'
  if (['overnight', 'ค้างคืน', 'o', 'night'].includes(s)) return 'overnight'
  return null
}

// รวมคอลัมน์ วันที่ (C/E) + เวลา (D/F) ให้เป็น Date เดียว
function parseDateTimeSplit(dateCol: unknown, timeCol: unknown): Date | null {
  if (!dateCol) return null

  // เมื่อ XLSX.read ใช้ cellDates:true, Date column มาเป็น Date object (UTC-based)
  // Time-only fraction มาเป็น Date ที่ anchor ที่ 1899-12-30 UTC
  let base: Date | null

  if (dateCol instanceof Date) {
    const d = dateCol
    if (isNaN(d.getTime())) return null
    // Date จาก cellDates=true เป็น UTC → ดึง UTC y/m/d
    base = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0)
    // ถ้าวันที่เป็น 1899 แสดงว่าเป็น time-only fraction → ไม่ใช่ date column จริง
    if (d.getUTCFullYear() === 1899) return null
  } else if (typeof dateCol === 'number') {
    try {
      const p = XLSX.SSF.parse_date_code(dateCol)
      base = new Date(p.y, p.m - 1, p.d, 0, 0, 0)
    } catch { return null }
  } else {
    base = parseExcelDate(dateCol)
    if (!base) return null
    base = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0)
  }

  // parse timeCol
  if (timeCol != null && timeCol !== '') {
    if (timeCol instanceof Date) {
      // cellDates=true: time fraction → Date anchored at 1899-12-30 UTC
      const t = timeCol as Date
      if (!isNaN(t.getTime())) {
        base.setHours(t.getUTCHours(), t.getUTCMinutes(), t.getUTCSeconds(), 0)
      }
    } else if (typeof timeCol === 'number') {
      // Excel time fraction: 0.5 = 12:00
      const totalSec = Math.round(timeCol * 86400)
      base.setHours(Math.floor(totalSec / 3600), Math.floor((totalSec % 3600) / 60), totalSec % 60, 0)
    } else {
      const t = String(timeCol).trim()
      const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
      if (m) base.setHours(parseInt(m[1]), parseInt(m[2]), parseInt(m[3] ?? '0'), 0)
    }
  }
  return base
}

// ค้นหา discount จากชื่อ (ตรงทันที, พอ partial match)
function findDiscountByName(name: string, list: DiscountDoc[]): DiscountDoc | null {
  if (!name.trim()) return null
  const n = name.trim().toLowerCase()
  return list.find(d => d.name.toLowerCase() === n)
      ?? list.find(d => d.name.toLowerCase().includes(n) || n.includes(d.name.toLowerCase()))
      ?? null
}

function downloadTemplate() {
  const wb = XLSX.utils.book_new()
  const rows = [
    [
      'ทะเบียน',
      'ประเภท (car/motorcycle/overnight)',
      'วันที่เข้า (DD/MM/YYYY)',
      'เวลาเข้า (HH:MM[:SS])',
      'วันที่ออก (DD/MM/YYYY)',
      'เวลาออก (HH:MM[:SS])',
      'ชื่อส่วนลดร้านค้า (ไม่บังคับ)',
      'ชื่อส่วนลดรถโรงแรม (ไม่บังคับ)',
    ],
    ['1234', 'car',        '14/08/2024', '09:00:00', '14/08/2024', '11:30:00', 'คูปองร้านอาหาร', ''],
    ['5678', 'motorcycle', '14/08/2024', '08:00',    '14/08/2024', '09:00',    '', ''],
    ['9999', 'car',        '14/08/2024', '20:00',    '15/08/2024', '07:30',    'คูปอง VIP', ''],
    ['ABCD', 'overnight',  '14/08/2024', '18:00',    '15/08/2024', '08:00',    '', 'โรงแรม ABC'],
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [
    { wch: 12 }, { wch: 28 },
    { wch: 20 }, { wch: 14 },
    { wch: 20 }, { wch: 14 },
    { wch: 24 }, { wch: 24 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'fee_test')
  XLSX.writeFile(wb, 'fee_test_template.xlsx')
}

function ExcelTester({ overnightCfg, discounts }: { overnightCfg: OvernightConfig | null; discounts: DiscountDoc[] }) {
  const [rows,      setRows]      = useState<TestRow[]>([])
  const [fileName,  setFileName]  = useState('')
  const [expandedId,setExpandedId]= useState<string | null>(null)
  const [dragging,  setDragging]  = useState(false)

  // คำนวณ discount ราย row โดย match ชื่อจาก DB
  function rowDiscounts(r: TestRow) {
    const empty = { shopDisc: null as DiscountDoc|null, hotelDisc: null as DiscountDoc|null, shopAmt: 0, hotelAmt: 0, total: 0, final: r.calculatedFee }
    if (r.error || !r.calculatedFee) return empty
    const nightCount = r.segments.filter(s => s.kind === 'overnight').length
    const shopDisc   = findDiscountByName(r.shopDiscountName, discounts)
    const hotelDisc  = findDiscountByName(r.hotelDiscountName, discounts)
    const shopAmt    = calcDiscount(r.calculatedFee, shopDisc, nightCount)
    const hotelAmt   = calcDiscount(r.calculatedFee, hotelDisc, nightCount)
    const total      = Math.min(shopAmt + hotelAmt, r.calculatedFee)
    const final      = Math.max(0, r.calculatedFee - total)
    return { shopDisc, hotelDisc, shopAmt, hotelAmt, total, final }
  }

  function processFile(file: File) {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb   = XLSX.read(data, { type: 'array', cellDates: true })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const raw  = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null }) as unknown[][]
        const dataRows = raw.slice(1).filter(r => r && (r as unknown[]).some(c => c !== null && c !== ''))

        const parsed: TestRow[] = dataRows.map((r, i) => {
          const rowNum    = i + 2
          const plate     = String(r[0] ?? '').trim().toUpperCase()
          const cardType  = normalizeCardType(r[1])
          const entryDate = parseDateTimeSplit(r[2], r[3])
          const exitDate  = parseDateTimeSplit(r[4], r[5])
          // G = ชื่อส่วนลดร้านค้า, H = ชื่อส่วนลดรถโรงแรม
          const shopDiscountName  = String(r[6] ?? '').trim()
          const hotelDiscountName = String(r[7] ?? '').trim()

          const base = {
            id: crypto.randomUUID(), rowNum, plate, cardType: (cardType ?? 'car') as CardType,
            shopDiscountName, hotelDiscountName,
            calculatedFee: 0, segments: [] as FeeSegment[],
          }

          if (!plate)     return { ...base, entryTime: '', exitTime: '', error: 'ไม่มีทะเบียน' }
          if (!cardType)  return { ...base, entryTime: '', exitTime: '', error: `ประเภทไม่ถูกต้อง: "${r[1]}"` }
          if (!entryDate) return { ...base, entryTime: '', exitTime: '', error: 'วันที่/เวลาเข้าไม่ถูกต้อง (col C-D)' }
          if (!exitDate)  return { ...base, entryTime: entryDate.toISOString(), exitTime: '', error: 'วันที่/เวลาออกไม่ถูกต้อง (col E-F)' }
          if (exitDate <= entryDate) return { ...base, entryTime: entryDate.toISOString(), exitTime: exitDate.toISOString(), error: 'เวลาออกต้องมากกว่าเวลาเข้า' }

          try {
            const { total, segments } = calcFeeBreakdown(cardType, entryDate, exitDate, overnightCfg ?? undefined)
            return {
              ...base, cardType,
              entryTime: entryDate.toISOString(), exitTime: exitDate.toISOString(),
              calculatedFee: total, segments, error: null,
            }
          } catch (err) {
            return { ...base, entryTime: entryDate.toISOString(), exitTime: exitDate.toISOString(), error: String(err) }
          }
        })

        setRows(parsed)
        setExpandedId(null)
      } catch (err) {
        alert(`อ่านไฟล์ไม่ได้: ${err}`)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f)
  }

  const errorCount  = rows.filter(r => r.error !== null).length
  const hasShopDiscount  = rows.some(r => r.shopDiscountName)
  const hasHotelDiscount = rows.some(r => r.hotelDiscountName)
  const hasDiscount = hasShopDiscount || hasHotelDiscount

  return (
    <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>

      {/* header */}
      <div className="px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid #E8ECF4', background: '#FAFBFF' }}>
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(217,119,6,0.08)' }}>
            <FileSpreadsheet className="size-4" style={{ color: '#B45309' }} />
          </div>
          <div>
            <p className="text-sm font-black text-slate-900">ทดสอบจาก Excel</p>
            <p className="text-[10px] text-slate-400">import .xlsx แล้วเช็คผลคำนวณ vs ค่าที่คาดหวัง — คลิกแถวเพื่อดู breakdown</p>
          </div>
        </div>
        <button onClick={downloadTemplate}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold transition-colors hover:opacity-80"
          style={{ background: 'rgba(217,119,6,0.06)', color: '#B45309', border: '1px solid rgba(217,119,6,0.2)' }}>
          <Download className="size-3.5" />ดาวน์โหลด Template
        </button>
      </div>

      {/* drop zone */}
      <div className="p-5" style={{ borderBottom: '1px solid #E8ECF4' }}>
        <label
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className="flex flex-col items-center justify-center gap-3 rounded-xl cursor-pointer py-8 transition-all"
          style={{
            border: `2px dashed ${dragging ? '#B45309' : '#D1D9F0'}`,
            background: dragging ? 'rgba(217,119,6,0.04)' : '#FAFBFF',
          }}>
          <div className="size-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(217,119,6,0.08)' }}>
            <Upload className="size-5" style={{ color: '#B45309' }} />
          </div>
          <div className="text-center">
            <p className="text-xs font-bold text-slate-700">
              {fileName ? `✓ ${fileName}` : 'วาง .xlsx ที่นี่ หรือคลิกเพื่อเลือกไฟล์'}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">รองรับ .xlsx, .xls, .csv — แถวแรกเป็น header ข้ามอัตโนมัติ</p>
          </div>
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileInput} />
        </label>
      </div>


      {/* summary bar */}
      {rows.length > 0 && (() => {
        const totalShop  = rows.filter(r => !r.error).reduce((s, r) => s + rowDiscounts(r).shopAmt,  0)
        const totalHotel = rows.filter(r => !r.error).reduce((s, r) => s + rowDiscounts(r).hotelAmt, 0)
        const totalFinal = rows.filter(r => !r.error).reduce((s, r) => s + rowDiscounts(r).final,    0)
        return (
          <div className="px-5 py-3 flex items-center gap-4 flex-wrap"
            style={{ borderBottom: '1px solid #E8ECF4', background: '#F8FAFF' }}>
            <span className="text-xs font-black text-slate-700">{rows.length} แถว</span>
            {errorCount > 0 && (
              <span className="text-xs font-bold text-amber-600">⚠ ข้อผิดพลาด {errorCount} แถว</span>
            )}
            {hasDiscount && totalShop > 0 && (
              <span className="text-[10px] font-bold" style={{ color: '#6D28D9' }}>ส่วนลดร้านค้า ฿{totalShop}</span>
            )}
            {hasDiscount && totalHotel > 0 && (
              <span className="text-[10px] font-bold" style={{ color: '#B45309' }}>ส่วนลดโรงแรม ฿{totalHotel}</span>
            )}
            <span className="ml-auto text-xs font-black" style={{ color: '#059669' }}>
              ยอดสุทธิรวม ฿{totalFinal}
            </span>
          </div>
        )
      })()}

      {/* results table */}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: '#F8FAFF', borderBottom: '1px solid #E8ECF4' }}>
                {(['แถว', 'ทะเบียน', 'ประเภท', 'เข้า', 'ออก', 'ระยะ', 'คำนวณ',
                  ...(hasShopDiscount  ? ['ส่วนลดร้านค้า'] : []),
                  ...(hasHotelDiscount ? ['ส่วนลดโรงแรม'] : []),
                  ...(hasDiscount      ? ['สุทธิ'] : []),
                  '']).map(h => (
                  <th key={h} className="px-3 py-2 text-left font-black text-slate-500 text-[10px] uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const meta = TYPE_META[r.cardType]; const Icon = meta.icon
                const durMin = r.entryTime && r.exitTime
                  ? (new Date(r.exitTime).getTime() - new Date(r.entryTime).getTime()) / 60000 : 0
                const isExp = expandedId === r.id
                const disc  = rowDiscounts(r)

                return (
                  <Fragment key={r.id}>
                    <tr
                      onClick={() => !r.error && setExpandedId(isExp ? null : r.id)}
                      style={{
                        borderBottom: (isExp || r.error) ? 'none' : '1px solid #F1F5F9',
                        background: r.error ? 'rgba(220,38,38,0.02)' : isExp ? '#FAFBFF' : 'transparent',
                        cursor: r.error ? 'default' : 'pointer',
                      }}
                      onMouseEnter={e => { if (!r.error && !isExp) e.currentTarget.style.background = '#FAFBFF' }}
                      onMouseLeave={e => { if (!isExp) e.currentTarget.style.background = r.error ? 'rgba(220,38,38,0.02)' : 'transparent' }}>
                      <td className="px-3 py-2.5 text-slate-400 text-[10px]">#{r.rowNum}</td>
                      <td className="px-3 py-2.5 font-black text-slate-800 tracking-widest">{r.plate || '—'}</td>
                      <td className="px-3 py-2.5">
                        {r.error
                          ? <span className="text-[10px] text-slate-400">—</span>
                          : <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: meta.color }}>
                              <Icon className="size-3" />{meta.label}
                            </span>}
                      </td>
                      <td className="px-3 py-2.5 text-[10px] text-slate-500 font-mono">{r.entryTime ? fmtDatetime(r.entryTime) : '—'}</td>
                      <td className="px-3 py-2.5 text-[10px] text-slate-500 font-mono">{r.exitTime ? fmtDatetime(r.exitTime) : '—'}</td>
                      <td className="px-3 py-2.5 text-[10px] text-slate-500">{durMin > 0 ? fmtDuration(durMin) : '—'}</td>
                      <td className="px-3 py-2.5">
                        {r.error
                          ? <span className="text-[10px] text-slate-400">—</span>
                          : <span className="font-black text-slate-700">฿{r.calculatedFee}</span>}
                      </td>
                      {hasShopDiscount && (
                        <td className="px-3 py-2.5 text-[10px]">
                          {r.shopDiscountName
                            ? disc.shopDisc
                              ? <span style={{ color: '#6D28D9' }}>-฿{disc.shopAmt} <span className="font-normal opacity-60">({disc.shopDisc.name})</span></span>
                              : <span className="px-1 py-0.5 rounded text-[9px] font-black" style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}>ไม่พบ: {r.shopDiscountName}</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                      )}
                      {hasHotelDiscount && (
                        <td className="px-3 py-2.5 text-[10px]">
                          {r.hotelDiscountName
                            ? disc.hotelDisc
                              ? <span style={{ color: '#B45309' }}>-฿{disc.hotelAmt} <span className="font-normal opacity-60">({disc.hotelDisc.name})</span></span>
                              : <span className="px-1 py-0.5 rounded text-[9px] font-black" style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}>ไม่พบ: {r.hotelDiscountName}</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                      )}
                      {hasDiscount && (
                        <td className="px-3 py-2.5">
                          {r.error
                            ? <span className="text-[10px] text-slate-400">—</span>
                            : <span className="font-black" style={{ color: disc.total > 0 ? '#059669' : '#1D4ED8' }}>฿{disc.final}</span>}
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-slate-300">
                        {!r.error && (isExp
                          ? <ChevronDown className="size-3.5 text-slate-400" />
                          : <ChevronRight className="size-3.5" />)}
                      </td>
                    </tr>

                    {/* error detail */}
                    {r.error && (
                      <tr style={{ borderBottom: '1px solid #F1F5F9', background: 'rgba(220,38,38,0.02)' }}>
                        <td colSpan={99} className="px-4 pb-2.5 pt-0">
                          <span className="text-[10px] text-amber-600">⚠ {r.error}</span>
                        </td>
                      </tr>
                    )}

                    {/* expanded breakdown */}
                    {isExp && !r.error && (
                      <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td colSpan={99} className="px-4 pb-3 pt-1">
                          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
                            <table className="w-full text-xs">
                              <thead>
                                <tr style={{ background: '#F8FAFF', borderBottom: '1px solid #E8ECF4' }}>
                                  {['ช่วงเวลา', 'ระยะเวลา', 'อัตรา', 'ค่าบริการ'].map(h => (
                                    <th key={h} className="px-3 py-1.5 text-left font-black text-slate-400 text-[9px] uppercase">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {r.segments.map((seg, si) => {
                                  const s = KIND_STYLE[seg.kind]
                                  return (
                                    <tr key={si} style={{ background: s.bg, borderBottom: '1px solid #E8ECF4' }}>
                                      <td className="px-3 py-2">
                                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full mr-1"
                                          style={{ background: s.border, color: s.color }}>{s.label}</span>
                                        <span className="text-[9px] text-slate-500">
                                          {fmtDatetime(seg.from.toISOString())} → {fmtDatetime(seg.to.toISOString())}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-[9px] text-slate-500">{fmtDuration(seg.minutes)}</td>
                                      <td className="px-3 py-2 text-[9px]" style={{ color: s.color }}>{seg.rateLabel}</td>
                                      <td className="px-3 py-2 text-right font-black text-[10px]" style={{ color: s.color }}>฿{seg.fee}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                              <tfoot>
                                {disc.total > 0 ? (
                                  <>
                                    <tr style={{ background: '#F8FAFF', borderTop: '1px solid #E8ECF4' }}>
                                      <td colSpan={3} className="px-3 py-1.5 text-slate-500 text-[10px]">ก่อนส่วนลด</td>
                                      <td className="px-3 py-1.5 text-right font-bold text-slate-600 text-[10px]">฿{r.calculatedFee}</td>
                                    </tr>
                                    {disc.shopAmt > 0 && (
                                      <tr style={{ background: 'rgba(109,40,217,0.04)' }}>
                                        <td colSpan={3} className="px-3 py-1 text-[10px] font-bold" style={{ color: '#6D28D9' }}>
                                          <Tag className="size-2.5 inline mr-1" />ส่วนลดร้านค้า ({disc.shopDisc?.name})
                                        </td>
                                        <td className="px-3 py-1 text-right font-black text-[10px]" style={{ color: '#6D28D9' }}>-฿{disc.shopAmt}</td>
                                      </tr>
                                    )}
                                    {disc.hotelAmt > 0 && (
                                      <tr style={{ background: 'rgba(180,83,9,0.04)' }}>
                                        <td colSpan={3} className="px-3 py-1 text-[10px] font-bold" style={{ color: '#B45309' }}>
                                          <Tag className="size-2.5 inline mr-1" />ส่วนลดรถโรงแรม ({disc.hotelDisc?.name})
                                        </td>
                                        <td className="px-3 py-1 text-right font-black text-[10px]" style={{ color: '#B45309' }}>-฿{disc.hotelAmt}</td>
                                      </tr>
                                    )}
                                    <tr style={{ background: '#F0F2F8', borderTop: '2px solid #E8ECF4' }}>
                                      <td colSpan={3} className="px-3 py-2 font-black text-slate-600 text-[10px]">ยอดสุทธิ</td>
                                      <td className="px-3 py-2 text-right font-black text-sm" style={{ color: '#059669' }}>฿{disc.final}</td>
                                    </tr>
                                  </>
                                ) : (
                                  <tr style={{ background: '#F0F2F8', borderTop: '2px solid #E8ECF4' }}>
                                    <td colSpan={3} className="px-3 py-2 font-black text-slate-600 text-[10px]">รวม</td>
                                    <td className="px-3 py-2 text-right font-black text-sm" style={{ color: '#1D4ED8' }}>฿{r.calculatedFee}</td>
                                  </tr>
                                )}
                              </tfoot>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SimulatorPage() {
  const [overnightCfg, setOvernightCfg] = useState<OvernightConfig | null>(null)
  const [discounts,    setDiscounts]    = useState<DiscountDoc[]>([])

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(s => { if (s?.rates?.overnight) setOvernightCfg(s.rates.overnight) })
      .catch(() => {})
    fetch('/api/discounts?active=1')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setDiscounts(d) })
      .catch(() => {})
  }, [])

  return (
    <>
      <header className="shrink-0 h-14 bg-white flex items-center px-6"
        style={{ borderBottom: '1px solid #E8ECF4' }}>
        <div className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded-lg"
            style={{ background: 'rgba(109,40,217,0.08)' }}>
            <FlaskConical className="size-3.5" style={{ color: '#6D28D9' }} />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 leading-none">จำลองข้อมูล / Simulator</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">ทดสอบสูตรคำนวณ · seed ข้อมูลข้ามวัน · ล้างข้อมูลทดสอบ</p>
          </div>
        </div>
        <span className="ml-3 text-[9px] font-black px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(109,40,217,0.1)', color: '#6D28D9', border: '1px solid rgba(109,40,217,0.2)' }}>
          DEV TOOL
        </span>
      </header>

      <div className="flex-1 overflow-auto p-5 space-y-5">
        <FeeCalculator overnightCfg={overnightCfg} discounts={discounts} />
        <ExcelTester overnightCfg={overnightCfg} discounts={discounts} />
        <BatchSeed overnightCfg={overnightCfg} />
      </div>
    </>
  )
}
