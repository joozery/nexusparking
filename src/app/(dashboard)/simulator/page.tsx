'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  FlaskConical, Car, Bike, Moon, Plus, Trash2,
  Play, RefreshCw, CheckCircle2, AlertTriangle, X, Info,
} from 'lucide-react'
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
  normal:    { bg: 'rgba(29,78,216,0.04)',   border: 'rgba(29,78,216,0.12)',   label: 'ปกติ',      color: '#1D4ED8' },
  outside:   { bg: 'rgba(217,119,6,0.05)',   border: 'rgba(217,119,6,0.15)',   label: 'นอกช่วง',   color: '#B45309' },
  overnight: { bg: 'rgba(109,40,217,0.05)',  border: 'rgba(109,40,217,0.15)', label: 'ค้างคืน',   color: '#6D28D9' },
}

const TYPE_META: Record<CardType, { label: string; icon: typeof Car; color: string }> = {
  car:        { label: 'รถยนต์',       icon: Car,  color: '#1D4ED8' },
  motorcycle: { label: 'มอเตอร์ไซค์', icon: Bike, color: '#6D28D9' },
  overnight:  { label: 'ค้างคืน',     icon: Moon, color: '#B45309' },
}

// ── types ─────────────────────────────────────────────────────────────────────

interface SeedRow {
  id:            string
  plate:         string
  cardType:      CardType
  entryTime:     string
  exitTime:      string
  paymentMethod: 'cash' | 'qr'
}

// ── Fee Calculator ────────────────────────────────────────────────────────────

function FeeCalculator({ overnightCfg }: { overnightCfg: OvernightConfig | null }) {
  const [cardType,   setCardType]   = useState<CardType>('car')
  const [entryTime,  setEntryTime]  = useState(nowLocal())
  const [exitTime,   setExitTime]   = useState('')

  const breakdown = useMemo(() => {
    if (!entryTime || !exitTime) return null
    const entry = new Date(entryTime)
    const exit  = new Date(exitTime)
    if (isNaN(entry.getTime()) || isNaN(exit.getTime()) || exit <= entry) return null
    return calcFeeBreakdown(cardType, entry, exit, overnightCfg ?? undefined)
  }, [cardType, entryTime, exitTime, overnightCfg])

  const showDaytimeNote = exitTime && overnightCfg && exitIsDaytime(exitTime, overnightCfg) && cardType !== 'overnight'

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
                <tr style={{ background: '#F0F2F8', borderTop: '2px solid #E8ECF4' }}>
                  <td colSpan={3} className="px-3 py-3 font-black text-slate-700 text-xs">รวมทั้งหมด</td>
                  <td className="px-3 py-3 text-right text-lg font-black" style={{ color: '#1D4ED8' }}>
                    ฿{breakdown.total}
                  </td>
                </tr>
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

  const formExitIsDaytime = exitTime && overnightCfg && exitIsDaytime(exitTime, overnightCfg) && cardType !== 'overnight'

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SimulatorPage() {
  const [overnightCfg, setOvernightCfg] = useState<OvernightConfig | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(s => { if (s?.rates?.overnight) setOvernightCfg(s.rates.overnight) })
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
        <FeeCalculator overnightCfg={overnightCfg} />
        <BatchSeed overnightCfg={overnightCfg} />
      </div>
    </>
  )
}
