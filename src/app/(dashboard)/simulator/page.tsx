'use client'

import { useState, useEffect, useMemo, useRef, Fragment } from 'react'
import {
  FlaskConical, Car, Bike, Moon, Plus, Trash2,
  Play, RefreshCw, CheckCircle2, AlertTriangle, X, Info,
  Upload, Download, FileSpreadsheet, ChevronDown, ChevronRight,
  Tag, Percent, Banknote,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { calcFeeBreakdown, type CardType, type FeeSegment, type OvernightConfig } from '@/lib/calcFee'
import { nowLocal, parseDateTimeSplit, importDiscounts } from '@/lib/simulatorImport'
import { SimulatorCheckout } from '@/components/parking/SimulatorCheckout'
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
  normal:       { bg: 'rgba(161,98,7,0.04)',  border: 'rgba(161,98,7,0.12)',  label: 'ปกติ',         color: '#A16207' },
  outside:      { bg: 'rgba(217,119,6,0.05)',  border: 'rgba(217,119,6,0.15)',  label: 'นอกช่วง',      color: '#B45309' },
  overnight:    { bg: 'rgba(109,40,217,0.05)', border: 'rgba(109,40,217,0.15)', label: 'ค้างคืน',      color: '#6D28D9' },
}

const TYPE_META: Record<CardType, { label: string; icon: typeof Car; color: string }> = {
  car:        { label: 'รถยนต์',       icon: Car,  color: '#A16207' },
  motorcycle: { label: 'รถจักรยานยนต์', icon: Bike, color: '#6D28D9' },
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

interface RegisteredCard { uid: string; type: CardType; label: string; isActive: boolean }

interface SeedRow {
  cardUid: string
  lostCard: boolean
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
                  ? { background: `rgba(${t === 'car' ? '161,98,7' : t === 'motorcycle' ? '109,40,217' : '180,83,9'},0.1)`, border: `2px solid ${m.color}`, color: m.color }
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
            style={{ background: 'rgba(161,98,7,0.04)', border: '1px solid rgba(161,98,7,0.15)' }}>
            <Info className="size-3.5 shrink-0 mt-0.5" style={{ color: '#A16207' }} />
            <p className="text-[10px] font-medium" style={{ color: '#A16207' }}>
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
                    <td className="px-3 py-3 text-right text-lg font-black" style={{ color: '#A16207' }}>฿{breakdown.total}</td>
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

function BatchSeed({ overnightCfg, cards, lostCardFine }: { overnightCfg: OvernightConfig | null; cards: RegisteredCard[]; lostCardFine: number }) {
  const { success, error: toastError, warning } = useToast()
  const [rows, setRows] = useState<SeedRow[]>([])
  const [seeding, setSeeding] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [confirmClear, setConfirmClear] = useState<{ count: number; token: string } | null>(null)

  const [cardUid, setCardUid] = useState('')
  const [lostCard, setLostCard] = useState(false)
  // form state for new row
  const [plate,         setPlate]         = useState('')
  const [cardType,      setCardType]      = useState<CardType>('car')
  const [entryTime,     setEntryTime]     = useState(nowLocal())
  const [exitTime,      setExitTime]      = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qr'>('cash')

  function addRow() {
    if (!plate.trim() || !entryTime || !cards.some(c => c.uid === cardUid && c.type === cardType && c.isActive)) return
    const entry = new Date(entryTime), exit = new Date(exitTime)
    if (isNaN(entry.getTime()) || (exitTime && (isNaN(exit.getTime()) || exit <= entry))) return
    setRows(r => [...r, {
      id: crypto.randomUUID(), plate: plate.trim(), cardType,
      entryTime, exitTime, paymentMethod, cardUid, lostCard,
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
        plate: r.plate, cardType: r.cardType, cardUid: r.cardUid, lostCard: r.lostCard,
        entryTime: new Date(r.entryTime).toISOString(), exitTime: r.exitTime ? new Date(r.exitTime).toISOString() : '',
        paymentMethod: r.paymentMethod,
      }))
      const res = await fetch('/api/simulate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const data = await res.json()
        success(`Seed สำเร็จ`, `บันทึก ${data.created} รายการ ข้ามรายการซ้ำ ${data.duplicates ?? 0} รายการ`)
        setRows([])
      } else {
        const err = await res.json()
        toastError('Seed ไม่สำเร็จ', err.results?.filter((r: { error?: string }) => r.error).slice(0, 3).map((r: { rowNum: number; error: string }) => `แถว ${r.rowNum}: ${r.error}`).join(' · ') || err.error)
      }
    } catch { toastError('บันทึกไม่สำเร็จ', 'เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่') } finally { setSeeding(false) }
  }

  async function previewClear() {
    setClearing(true)
    try {
      const res = await fetch('/api/simulate')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setConfirmClear(data)
    } catch (err) { toastError('ตรวจสอบไม่สำเร็จ', err instanceof Error ? err.message : 'กรุณาลองใหม่') }
    finally { setClearing(false) }
  }

  async function clearSimulated() {
    if (!confirmClear) return
    setClearing(true)
    try {
      const res = await fetch('/api/simulate', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: confirmClear.token, confirmation: 'CLEAR_COMPLETED_HISTORY' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      warning('ล้างประวัติแล้ว', 'ลบ ' + data.deleted + ' รายการ โดยเก็บข้อมูลบัตร รถที่ยังไม่ออก และรายการบัตรหายไว้')
    } catch (err) { toastError('ล้างไม่สำเร็จ', err instanceof Error ? err.message : 'กรุณาลองใหม่') }
    finally { setClearing(false); setConfirmClear(null) }
  }

  function previewFee(r: SeedRow) {
    if (!r.exitTime) return 0
    try {
      const { total } = calcFeeBreakdown(r.cardType, new Date(r.entryTime), new Date(r.exitTime), overnightCfg ?? undefined)
      return total + (r.lostCard ? lostCardFine : 0)
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
            <p className="text-sm font-black text-slate-900">บันทึกรายการจอดย้อนหลัง</p>
            <p className="text-[10px] text-slate-400">บันทึกรายการปกติ · ล้างเฉพาะรถที่ออกแล้ว เก็บบัตรและรายการบัตรหายไว้</p>
          </div>
        </div>
        {!confirmClear ? (
          <button onClick={previewClear} disabled={clearing}
            className="h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
            style={{ background: 'rgba(220,38,38,0.06)', color: '#991B1B', border: '1px solid rgba(220,38,38,0.2)' }}>
            <Trash2 className="size-3.5" />ล้างประวัติการจอด
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-red-700">ลบประวัติ {confirmClear.count.toLocaleString()} รายการถาวร?</span>
            <button onClick={clearSimulated} disabled={clearing || confirmClear.count === 0}
              className="h-7 px-2.5 rounded-lg text-xs font-black text-white"
              style={{ background: '#DC2626' }}>
              {clearing ? <RefreshCw className="size-3 animate-spin" /> : 'ลบ'}
            </button>
            <button onClick={() => setConfirmClear(null)} disabled={clearing}
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
                  ? { background: `rgba(${t === 'car' ? '161,98,7' : t === 'motorcycle' ? '109,40,217' : '180,83,9'},0.1)`, border: `1.5px solid ${m.color}`, color: m.color }
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

        <div className="flex flex-wrap gap-3 items-center">
          <select aria-label="เลือกบัตรสำหรับรายการ" value={cardUid} onChange={e => setCardUid(e.target.value)} className="border rounded-lg p-2 text-sm">
            <option value="">เลือกบัตรที่ลงทะเบียน</option>
            {cards.filter(c => c.isActive && c.type === cardType).map(c => <option key={c.uid} value={c.uid}>{c.label || c.uid} · {c.uid}</option>)}
          </select>
          <label className="text-sm flex gap-2"><input type="checkbox" checked={lostCard} onChange={e => setLostCard(e.target.checked)} />บัตรหาย</label>
          <span className="text-xs text-slate-500">เว้นเวลาออกว่างเพื่อบันทึกเป็นรถอยู่ในลาน</span>
        </div>
        {formExitIsDaytime && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(161,98,7,0.04)', border: '1px solid rgba(161,98,7,0.15)' }}>
            <Info className="size-3.5 shrink-0" style={{ color: '#A16207' }} />
            <p className="text-[10px] font-medium" style={{ color: '#A16207' }}>
              ออกก่อน {overnightCfg?.windowStart} — จะคิดเรทปกติ (ไม่มีค่าเหมาค้างคืน)
            </p>
          </div>
        )}

        <button onClick={addRow}
          disabled={!plate.trim() || !entryTime || !cards.some(c => c.uid === cardUid && c.type === cardType && c.isActive) || (!!exitTime && new Date(exitTime) <= new Date(entryTime))}
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
                  const durMin = r.exitTime ? (new Date(r.exitTime).getTime() - new Date(r.entryTime).getTime()) / 60000 : 0
                  const daytime = overnightCfg && exitIsDaytime(r.exitTime, overnightCfg) && r.cardType !== 'overnight'
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFF')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td className="px-3 py-2.5 font-black text-slate-800 tracking-widest">{r.plate}<span className="block text-xs font-normal">บัตร {r.cardUid}{r.lostCard ? ' · บัตรหาย' : ''}</span></td>
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
                            style={{ background: 'rgba(161,98,7,0.08)', color: '#A16207' }}>ปกติ</span>
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
  cardUid: string
  lostCard: boolean
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
  fineId:            string    // ค่าปรับทั่วไปที่เลือกก่อนบันทึก
  error:             string | null
}

interface FineOption {
  _id: string
  name: string
  amount: number
  isActive: boolean
}

interface ImportPreview {
  waiting?: number
  active?: number
  queued?: number
  token: string
  ready: number
  duplicates: number
  errors: number
  total: number
  results: { cardUid: string; status: string; lostFine: number; fineAmount: number; fineName?: string; rowNum: number; plate: string; fee: number; discount: number; total: number; duplicate: boolean; error?: string; warning?: string }[]
}

function normalizeCardType(val: unknown): CardType | null {
  const s = String(val ?? '').toLowerCase().trim()
  if (['car', 'รถยนต์', 'ยนต์', 'c'].includes(s)) return 'car'
  if (['motorcycle', 'มอเตอร์ไซค์', 'รถจักรยานยนต์', 'moto', 'bike', 'm', 'motor'].includes(s)) return 'motorcycle'
  if (['overnight', 'ค้างคืน', 'o', 'night'].includes(s)) return 'overnight'
  return null
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
      'เลขบัตร UID (เลือกภายหลังได้)',
      'บัตรหาย (true/false)',
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

function ExcelTester({ overnightCfg, discounts, cards, lostCardFine }: { overnightCfg: OvernightConfig | null; discounts: DiscountDoc[]; cards: RegisteredCard[]; lostCardFine: number }) {
  const { success, error: toastError } = useToast()
  const [rows,      setRows]      = useState<TestRow[]>([])
  const [fines,     setFines]     = useState<FineOption[]>([])
  const [fileName,  setFileName]  = useState('')
  const [expandedId,setExpandedId]= useState<string | null>(null)
  const [dragging,  setDragging]  = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'' | 'cash' | 'qr'>('')
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [importing, setImporting] = useState(false)
  const [removedRows, setRemovedRows] = useState<{ rowNum: number; plate: string; error: string }[]>([])
  const [reading, setReading] = useState(false)
  const fileVersion = useRef(0)
  const [page, setPage] = useState(1)
  const pageSize = 100
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize)
  const [discountMapping, setDiscountMapping] = useState<Record<string, string | null>>({})

  useEffect(() => {
    fetch('/api/fines?active=1')
      .then(res => res.ok ? res.json() : [])
      .then(data => setFines(Array.isArray(data) ? data : []))
      .catch(() => setFines([]))
  }, [])

  const fineById = (id: string) => fines.find(f => f._id === id)
  const mappedName = (name: string, kind: 'shop' | 'hotel') => {
    const mapping = discountMapping[`${kind}:${name}`]
    return mapping === null ? '' : mapping || name
  }
  const unmatchedDiscounts = (['shop', 'hotel'] as const).flatMap(kind => {
    const names = [...new Set(rows.map(r => kind === 'shop' ? r.shopDiscountName : r.hotelDiscountName).filter(Boolean))]
    return names.filter(name => !discounts.some(d => d.name.trim().toLowerCase() === name.toLowerCase()
      && (d.discountType === 'per_day') === (kind === 'hotel'))).map(name => ({ kind, name }))
  })

  async function submitImport(mode: 'preview' | 'commit') {
    if (!paymentMethod || rows.some(r => r.error) || (mode === 'commit' && !importPreview)) return
    setImporting(true)
    try {
      const requestImport = async (source: TestRow[]) => fetch('/api/simulate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, token: importPreview?.token, rows: source.map(r => ({
          rowNum: r.rowNum, plate: r.plate, cardType: r.cardType, cardUid: r.cardUid, lostCard: r.lostCard,
          entryTime: r.entryTime, exitTime: r.exitTime, paymentMethod,
          fineId: r.fineId || undefined,
          shopDiscountName: mappedName(r.shopDiscountName, 'shop'), hotelDiscountName: mappedName(r.hotelDiscountName, 'hotel'),
        })) }),
      })
      let res = await requestImport(rows)
      let data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'ไม่สามารถบันทึกได้')
      if (mode === 'preview') {
        const removed = (data.results ?? []).filter((r: { cardUnavailable?: boolean }) => r.cardUnavailable) as { rowNum: number; plate: string; error: string }[]
        if (removed.length) {
          const numbers = new Set(removed.map(r => r.rowNum))
          const remaining = rows.filter(r => !numbers.has(r.rowNum))
          setRows(remaining)
          setRemovedRows(old => [...old, ...removed])
          setImportPreview(null)
          setExpandedId(null)
          setPage(old => Math.min(old, Math.max(1, Math.ceil(remaining.length / pageSize))))
          toastError('นำแถวที่ไม่มีบัตรใช้งานออกแล้ว', `${removed.length} แถว ดูเลขแถวและเหตุผลในรายการแจ้งเตือน`)
          if (!remaining.length) return
          res = await requestImport(remaining)
          data = await res.json()
          if (!res.ok) throw new Error(data.error ?? 'ตรวจสอบรายการที่เหลือไม่สำเร็จ')
        }
      }
      if (mode === 'preview') setImportPreview(data)
      else {
        window.dispatchEvent(new Event('parking-imported'))
        success('นำเข้าสำเร็จ', `บันทึก ${data.created} รายการ ข้ามรายการซ้ำ ${data.duplicates} รายการ`)
        setImportPreview(null)
        setRows([])
        setFileName('')
      }
    } catch (err) {
      setImportPreview(null)
      toastError('นำเข้าไม่สำเร็จ', err instanceof Error ? err.message : 'กรุณาลองใหม่')
    } finally { setImporting(false) }
  }

  function rowDiscounts(r: TestRow) {
    try {
      return importDiscounts(r.calculatedFee, r.segments.filter(s => s.kind === 'overnight').length,
        mappedName(r.shopDiscountName, 'shop'), mappedName(r.hotelDiscountName, 'hotel'), discounts)
    } catch {
      return { shopDisc: null, hotelDisc: null, shopAmt: 0, hotelAmt: 0, total: 0, final: r.calculatedFee, warning: '' }
    }
  }

  function processFile(file: File) {
    if (importing) return
    const version = ++fileVersion.current
    setFileName(file.name)
    setRemovedRows([])
    setRows([])
    setImportPreview(null)
    setDiscountMapping({})
    setPage(1)
    if (file.size > 10 * 1024 * 1024) { setReading(false); toastError('ไฟล์ใหญ่เกินไป', 'รองรับไฟล์สูงสุด 10 MB'); return }
    setReading(true)
    const reader = new FileReader()
    reader.onload = e => {
      if (version !== fileVersion.current) return
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb   = XLSX.read(data, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const raw  = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null }) as unknown[][]
        const dataRows = raw.slice(1).map((r, i) => ({ r, rowNum: i + 2 })).filter(({ r }) => r && r.some(c => c !== null && c !== ''))
        if (dataRows.length > 10000) throw new Error('รองรับสูงสุด 10,000 รายการต่อไฟล์')

        const parsed: TestRow[] = dataRows.map(({ r, rowNum }) => {
          const plate     = String(r[0] ?? '').trim().toUpperCase()
          const cardType  = normalizeCardType(r[1])
          const entryDate = parseDateTimeSplit(r[2], r[3], Boolean(wb.Workbook?.WBProps?.date1904))
          const exitDate  = parseDateTimeSplit(r[4], r[5], Boolean(wb.Workbook?.WBProps?.date1904))
          // G = ชื่อส่วนลดร้านค้า, H = ชื่อส่วนลดรถโรงแรม
          const shopDiscountName  = String(r[6] ?? '').trim()
          const hotelDiscountName = String(r[7] ?? '').trim()

          const base = {
            cardUid: String(r[8] ?? '').trim(), lostCard: ['true', '1', 'ใช่', 'บัตรหาย'].includes(String(r[9] ?? '').trim().toLowerCase()),
            id: crypto.randomUUID(), rowNum, plate, cardType: (cardType ?? 'car') as CardType,
            shopDiscountName, hotelDiscountName, fineId: '',
            calculatedFee: 0, segments: [] as FeeSegment[],
          }

          if (!plate)     return { ...base, entryTime: '', exitTime: '', error: 'ไม่มีทะเบียน' }
          if (!cardType)  return { ...base, entryTime: '', exitTime: '', error: `ประเภทไม่ถูกต้อง: "${r[1]}"` }
          if (!entryDate) return { ...base, entryTime: '', exitTime: '', error: 'วันที่/เวลาเข้าไม่ถูกต้อง (col C-D)' }
          const openVisit = (r[4] == null || r[4] === '') && (r[5] == null || r[5] === '')
          if (openVisit) return { ...base, entryTime: entryDate.toISOString(), exitTime: '', error: null }
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
        toastError('อ่านไฟล์ไม่ได้', String(err))
      } finally { setReading(false) }
    }
    reader.onerror = () => {
      if (version !== fileVersion.current) return
      setReading(false)
      toastError('อ่านไฟล์ไม่ได้', 'กรุณาเลือกไฟล์อีกครั้ง')
    }
    reader.readAsArrayBuffer(file)
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f)
  }

  function exportResultToExcel() {
    if (!rows.length) return
    const exportData = rows.map(r => {
      const disc = rowDiscounts(r)
      const durMin = r.entryTime && r.exitTime
        ? (new Date(r.exitTime).getTime() - new Date(r.entryTime).getTime()) / 60000 : 0
      
      const meta = TYPE_META[r.cardType]
      return {
        'แถว': r.rowNum,
        'ทะเบียน': r.plate || '—',
        'ประเภท': meta ? meta.label : r.cardType,
        'เข้า': r.entryTime ? fmtDatetime(r.entryTime) : '—',
        'ออก': r.exitTime ? fmtDatetime(r.exitTime) : '—',
        'ระยะ': durMin > 0 ? fmtDuration(durMin) : '—',
        'คำนวณ': r.error ? 'Error' : r.calculatedFee,
        'ส่วนลดร้านค้า': r.error ? 0 : disc.shopAmt,
        'ส่วนลดโรงแรม': r.error ? 0 : disc.hotelAmt,
        'ค่าปรับทั่วไป': r.error ? 0 : (fineById(r.fineId)?.amount ?? 0),
        'สุทธิ': r.error ? 0 : disc.final
          + (r.lostCard && r.exitTime ? lostCardFine : 0)
          + (fineById(r.fineId)?.amount ?? 0)
      }
    })

    const ws = XLSX.utils.json_to_sheet(exportData)
    // Adjust column widths slightly for readability
    ws['!cols'] = [
      { wch: 8 },  // แถว
      { wch: 12 }, // ทะเบียน
      { wch: 15 }, // ประเภท
      { wch: 18 }, // เข้า
      { wch: 18 }, // ออก
      { wch: 15 }, // ระยะ
      { wch: 10 }, // คำนวณ
      { wch: 15 }, // ส่วนลดร้านค้า
      { wch: 15 }, // ส่วนลดโรงแรม
      { wch: 10 }, // สุทธิ
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Results')
    XLSX.writeFile(wb, `fee_results_${new Date().getTime()}.xlsx`)
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
            <p className="text-sm font-black text-slate-900">นำเข้า Excel</p>
            <p className="text-[10px] text-slate-400">ตรวจค่าจอดจาก Excel แล้วบันทึกเป็นรายการจริง — คลิกแถวเพื่อดูรายละเอียด</p>
          </div>
        </div>
        <button onClick={downloadTemplate}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold transition-colors hover:opacity-80"
          style={{ background: 'rgba(217,119,6,0.06)', color: '#B45309', border: '1px solid rgba(217,119,6,0.2)' }}>
          <Download className="size-3.5" />ดาวน์โหลด Template
        </button>
      </div>

      <p className="px-5 py-2 text-xs text-amber-800">เมื่อตรวจสอบก่อนบันทึก ระบบจะนำแถวที่ไม่ได้เลือกบัตรหรือบัตรใช้ไม่ได้ออกจากรายการนำเข้า พร้อมแจ้งเหตุผล</p>
      {removedRows.length > 0 && <div role="alert" className="mx-5 my-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <p className="font-bold">นำออกจากรายการนำเข้า {removedRows.length} แถว — ไม่มีการลบข้อมูลในฐานข้อมูล</p>
        <ul className="mt-2 max-h-48 overflow-auto">
          {removedRows.map(r => <li key={r.rowNum}>แถว {r.rowNum} · {r.plate || 'ไม่มีทะเบียน'}: {r.error}</li>)}
        </ul>
      </div>}
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
              {reading ? 'กำลังอ่านไฟล์…' : fileName || 'วาง .xlsx ที่นี่ หรือคลิกเพื่อเลือกไฟล์'}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">รองรับ .xlsx, .xls, .csv — แถวแรกเป็น header ข้ามอัตโนมัติ</p>
          </div>
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileInput} disabled={importing} />
        </label>
      </div>

      {rows.length > pageSize && (
        <div className="px-5 py-3 flex items-center gap-3 text-sm border-b border-slate-200">
          <button className="border rounded px-3 py-1 disabled:opacity-40" disabled={page === 1} onClick={() => { setPage(p => p - 1); setExpandedId(null) }}>ก่อนหน้า</button>
          <span>หน้า {page} / {pageCount} · แสดงครั้งละ {pageSize} แถว การบันทึกและ Export ใช้ทุกแถว</span>
          <button className="border rounded px-3 py-1 disabled:opacity-40" disabled={page === pageCount} onClick={() => { setPage(p => p + 1); setExpandedId(null) }}>ถัดไป</button>
        </div>
      )}

      {rows.length > 0 && (
        <div className="p-5 space-y-3 border-b border-slate-200 bg-slate-50">
          <p className="text-sm font-bold text-slate-800">บันทึกเป็นรายการปกติในฐานข้อมูลจริง</p>
          <p className="text-xs text-slate-600">ลานเต็มจะสร้างคิวรออัตโนมัติ แถวที่มีเวลาออกจะเป็นรอคิวแล้วออก แถวที่ไม่มีเวลาออกจะรอให้เรียกเข้าช่องจอด · เลือกบัตรและบัตรหายในตารางด้านล่างก่อนตรวจสอบ · เว้นวันที่และเวลาออกว่างทั้งคู่สำหรับรถที่ยังอยู่ในลาน · ส่วนลดและค่าปรับของรถที่ยังไม่ออกจะคำนวณตอนรับรถออก</p>
          <p className="text-xs text-slate-600">ส่วนลดร้านค้าใช้กับรายการรายชั่วโมง ส่วนลดโรงแรมใช้ตามจำนวนคืนที่คิดค่าเหมา เลือกจับคู่ชื่อหรือ “ไม่ใช้ส่วนลด” เพื่อข้ามส่วนลดนั้นทุกแถว</p>
          {unmatchedDiscounts.map(({ kind, name }) => (
            <label key={`${kind}:${name}`} className="block text-sm text-amber-800">
              จับคู่ส่วนลด{kind === 'hotel' ? 'โรงแรม' : 'ร้านค้า'}ใน Excel: <strong>{name}</strong>
              <select className="ml-2 border rounded-lg p-2 bg-white" disabled={importing}
                value={discountMapping[`${kind}:${name}`] === null ? '__no_discount__' : discountMapping[`${kind}:${name}`] ?? ''}
                onChange={e => { setDiscountMapping(m => ({ ...m, [`${kind}:${name}`]: e.target.value === '__no_discount__' ? null : e.target.value })); setImportPreview(null) }}>
                <option value="">เลือกชื่อส่วนลดในระบบ</option>
                <option value="__no_discount__">ไม่ใช้ส่วนลด (ข้ามการจับคู่)</option>
                {discounts.filter(d => (d.discountType === 'per_day') === (kind === 'hotel')).map(d => <option key={d._id} value={d.name}>{d.name} — {d.discountValue}{d.discountType === 'percent' ? '%' : d.discountType === 'per_day' ? ' บาท/คืน' : ' บาท'}</option>)}
              </select>
            </label>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm">ช่องทางชำระเงิน
              <select className="ml-2 border rounded-lg p-2 bg-white" value={paymentMethod} disabled={importing}
                onChange={e => { setPaymentMethod(e.target.value as '' | 'cash' | 'qr'); setImportPreview(null) }}>
                <option value="">เลือกช่องทาง</option><option value="cash">เงินสด</option><option value="qr">QR</option>
              </select>
            </label>
            <button className="rounded-lg px-4 py-2 text-sm font-bold bg-violet-700 text-white disabled:opacity-40"
              disabled={importing || !paymentMethod || errorCount > 0} onClick={() => submitImport('preview')}>
              {importing ? 'กำลังดำเนินการ…' : 'ตรวจสอบก่อนบันทึก'}
            </button>
          </div>
          {errorCount > 0 && <p className="text-sm text-red-700">แก้ไขข้อมูลผิดพลาด {errorCount} แถวในไฟล์แล้วเลือกไฟล์อีกครั้ง</p>}
          {importPreview && (
            <div className="space-y-3">
              <p className="text-sm font-bold">พร้อมบันทึก {importPreview.ready.toLocaleString()} รายการ · อยู่ในลาน {importPreview.active ?? 0} · รอคิว {importPreview.waiting ?? 0} · ซ้ำ {importPreview.duplicates.toLocaleString()} · ผิดพลาด {importPreview.errors.toLocaleString()} · ยอดที่จะบันทึก ฿{importPreview.total.toLocaleString()}</p>
              <div className="max-h-72 overflow-auto border rounded-lg bg-white">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-100"><tr>{['แถว', 'ทะเบียน', 'บัตร / สถานะ', 'ค่าจอด', 'ส่วนลด', 'ค่าปรับบัตรหาย', 'ค่าปรับทั่วไป', 'สุทธิ', 'ผลตรวจจากเซิร์ฟเวอร์'].map(h => <th key={h} className="p-2 text-left">{h}</th>)}</tr></thead>
                  <tbody>{importPreview.results.slice((page - 1) * pageSize, page * pageSize).map((r, i) => <tr key={i} className="border-t">
                    <td className="p-2">{r.rowNum}</td><td className="p-2">{r.plate}</td><td className="p-2">{r.cardUid} · {r.status === 'waiting' ? 'รอคิว' : r.status === 'queue_completed' ? 'รอคิวแล้วออก' : r.status === 'active' ? 'อยู่ในลาน' : 'ออกแล้ว'}</td><td className="p-2">{r.fee}</td>
                    <td className="p-2">{r.discount}</td><td className="p-2">{r.lostFine}</td><td className="p-2">{r.fineAmount}{r.fineName ? ` (${r.fineName})` : ''}</td><td className="p-2">{r.total}</td>
                    <td className={`p-2 ${r.error ? 'text-red-700' : r.warning ? 'text-amber-700' : 'text-slate-600'}`}>{r.error || (r.duplicate ? 'ซ้ำ — จะข้ามรายการนี้' : r.warning || 'พร้อมบันทึก')}</td>
                  </tr>)}</tbody>
                </table>
              </div>
              <button className="rounded-lg px-4 py-2 text-sm font-bold bg-emerald-700 text-white disabled:opacity-40"
                disabled={importing || importPreview.errors > 0 || importPreview.ready === 0} onClick={() => submitImport('commit')}>
                ยืนยันบันทึก {importPreview.ready.toLocaleString()} รายการลงฐานข้อมูล
              </button>
            </div>
          )}
        </div>
      )}

      {/* summary bar */}
      {rows.length > 0 && (() => {
        const totalShop  = rows.filter(r => !r.error).reduce((s, r) => s + rowDiscounts(r).shopAmt,  0)
        const totalHotel = rows.filter(r => !r.error).reduce((s, r) => s + rowDiscounts(r).hotelAmt, 0)
        const totalFine = rows.filter(r => !r.error).reduce((s, r) => s + (fineById(r.fineId)?.amount ?? 0), 0)
        const totalLost = rows.filter(r => !r.error && r.exitTime && r.lostCard).length * lostCardFine
        const totalFinal = rows.filter(r => !r.error).reduce((s, r) => s + rowDiscounts(r).final, 0) + totalFine + totalLost
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
            <button onClick={exportResultToExcel}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold transition-colors hover:opacity-90 ml-2 shadow-sm"
              style={{ background: '#059669', color: 'white' }}>
              <Download className="size-3.5" />Export ผลลัพธ์
            </button>
          </div>
        )
      })()}

      {/* results table */}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: '#F8FAFF', borderBottom: '1px solid #E8ECF4' }}>
                {(['แถว', 'บัตรที่ลงทะเบียน', 'บัตรหาย', 'ค่าปรับ', 'ทะเบียน', 'ประเภท', 'เข้า', 'ออก', 'ระยะ', 'คำนวณ',
                  ...(hasShopDiscount  ? ['ส่วนลดร้านค้า'] : []),
                  ...(hasHotelDiscount ? ['ส่วนลดโรงแรม'] : []),
                  ...(hasDiscount      ? ['สุทธิ'] : []),
                  '']).map(h => (
                  <th key={h} className="px-3 py-2 text-left font-black text-slate-500 text-[10px] uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(r => {
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
                      <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                        <select aria-label={`บัตรแถว ${r.rowNum}`} disabled={importing} className="border rounded p-2 min-w-40" value={r.cardUid}
                          onChange={e => { setRows(old => old.map(v => v.id === r.id ? { ...v, cardUid: e.target.value } : v)); setImportPreview(null) }}>
                          <option value="">เลือกบัตร</option>
                          {cards.filter(c => c.isActive && c.type === r.cardType).map(c => <option key={c.uid} value={c.uid}>{c.label || c.uid} · {c.uid}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2" onClick={e => e.stopPropagation()}><input aria-label={`บัตรหายแถว ${r.rowNum}`} type="checkbox" checked={r.lostCard} disabled={importing}
                        onChange={e => { setRows(old => old.map(v => v.id === r.id ? { ...v, lostCard: e.target.checked } : v)); setImportPreview(null) }} /></td>
                      <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                        <select aria-label={`ค่าปรับแถว ${r.rowNum}`} disabled={importing || !r.exitTime}
                          className="border rounded p-2 min-w-36" value={r.fineId}
                          onChange={e => { setRows(old => old.map(v => v.id === r.id ? { ...v, fineId: e.target.value } : v)); setImportPreview(null) }}>
                          <option value="">ไม่คิดค่าปรับ</option>
                          {fines.map(f => <option key={f._id} value={f._id}>{f.name} · ฿{f.amount}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2.5 font-black text-slate-800 tracking-widest">{r.plate || '—'}</td>
                      <td className="px-3 py-2.5">
                        {r.error
                          ? <span className="text-[10px] text-slate-400">—</span>
                          : <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: meta.color }}>
                              <Icon className="size-3" />{meta.label}
                            </span>}
                      </td>
                      <td className="px-3 py-2.5 text-[10px]">
                        {r.fineId && fineById(r.fineId) ? <span className="text-red-600">฿{fineById(r.fineId)?.amount} <span className="font-normal opacity-70">({fineById(r.fineId)?.name})</span></span> : <span className="text-slate-300">—</span>}
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
                          {r.shopDiscountName && !mappedName(r.shopDiscountName, 'shop')
                            ? <span className="text-slate-500">ไม่ใช้ส่วนลด</span>
                            : r.shopDiscountName
                            ? disc.shopDisc
                              ? <span style={{ color: '#6D28D9' }}>-฿{disc.shopAmt} <span className="font-normal opacity-60">({disc.shopDisc.name})</span></span>
                              : <span className="px-1 py-0.5 rounded text-[9px] font-black" style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}>ไม่พบ: {r.shopDiscountName}</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                      )}
                      {hasHotelDiscount && (
                        <td className="px-3 py-2.5 text-[10px]">
                          {r.hotelDiscountName && !mappedName(r.hotelDiscountName, 'hotel')
                            ? <span className="text-slate-500">ไม่ใช้ส่วนลด</span>
                            : r.hotelDiscountName
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
                            : <span className="font-black" style={{ color: disc.total > 0 ? '#059669' : '#A16207' }}>฿{disc.final}</span>}
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
                                    <td className="px-3 py-2 text-right font-black text-sm" style={{ color: '#A16207' }}>฿{r.calculatedFee}</td>
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
  const [cards, setCards] = useState<RegisteredCard[]>([])
  const [lostCardFine, setLostCardFine] = useState(300)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    Promise.all(['/api/settings', '/api/discounts?active=1', '/api/cards'].map(async url => {
      const res = await fetch(url)
      if (!res.ok) throw new Error('โหลดอัตราค่าจอดและส่วนลดไม่สำเร็จ')
      return res.json()
    })).then(([settings, discounts, cards]) => {
      if (!settings?.rates?.overnight || !Array.isArray(discounts) || !Array.isArray(cards)) throw new Error('ข้อมูลการตั้งค่าไม่ครบ')
      setOvernightCfg(settings.rates.overnight)
      setDiscounts(discounts)
      setCards(cards)
      setLostCardFine(settings.lostCardFine ?? 300)
    }).catch(err => setLoadError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false))
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
            <p className="text-[10px] text-slate-400 mt-0.5">ทดสอบสูตรคำนวณ · seed ข้อมูลข้ามวัน · ล้างประวัติการจอด</p>
          </div>
        </div>
        <span className="ml-3 text-[9px] font-black px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(109,40,217,0.1)', color: '#6D28D9', border: '1px solid rgba(109,40,217,0.2)' }}>
          DEV TOOL
        </span>
      </header>

      <div className="flex-1 overflow-auto p-5 space-y-5">
        {loading ? <p role="status">กำลังโหลดอัตราค่าจอดและส่วนลด…</p> : loadError ? (
          <div role="alert" className="p-4 bg-red-50 text-red-700 rounded-lg">{loadError} <button className="underline" onClick={() => window.location.reload()}>ลองใหม่</button></div>
        ) : <>
        <FeeCalculator overnightCfg={overnightCfg} discounts={discounts} />
        <ExcelTester overnightCfg={overnightCfg} discounts={discounts} cards={cards} lostCardFine={lostCardFine} />
        <SimulatorCheckout config={overnightCfg} lostCardFine={lostCardFine} />
        <BatchSeed overnightCfg={overnightCfg} cards={cards} lostCardFine={lostCardFine} />
        </>}
      </div>
    </>
  )
}
