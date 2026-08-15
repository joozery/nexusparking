'use client'

import { useState, useEffect } from 'react'
import { CreditCard, LogOut, Clock, Banknote, Smartphone, Tag, ChevronDown, Timer, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogBody, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { CardBadge } from './CardBadge'
import { type CardType } from './types'
import { calcFeeBreakdown, type OvernightConfig, type AfterHoursConfig } from '@/lib/calcFee'
import { toAsciiNumber } from '@/lib/thaiInput'

export type PaymentMethod = 'cash' | 'qr'

interface DiscountOption {
  _id: string
  name: string
  discountType: 'fixed' | 'percent' | 'per_day'
  discountValue: number
  maxDiscount?: number
  description?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  step: 'scan' | 'payment'
  cardType: CardType
  hours: number
  fee: number
  entryTime?: Date | null
  customExitTime?: string
  overnightCfg?: OvernightConfig
  afterHoursCfg?: AfterHoursConfig
  onCustomExitTimeChange?: (v: string) => void
  onSimulateScan: () => void
  onBack: () => void
  onConfirm: (paymentMethod: PaymentMethod, discountId?: string, dailyDiscountId?: string) => void
}

function calcDiscountAmount(discount: DiscountOption | null, fee: number): number {
  if (!discount) return 0
  if (discount.discountType === 'fixed') return Math.min(discount.discountValue, fee)
  const pct = Math.floor(fee * discount.discountValue / 100)
  return discount.maxDiscount ? Math.min(pct, discount.maxDiscount) : pct
}

function fmtDuration(entryTime: Date | null | undefined, exitTime: Date | null | undefined, fallbackHours: number): string {
  if (entryTime && exitTime) {
    const sec = Math.max(0, Math.floor((exitTime.getTime() - entryTime.getTime()) / 1000))
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return `${h} ชม. ${String(m).padStart(2, '0')} น. ${String(s).padStart(2, '0')} วิ`
  }
  return `${fallbackHours} ชั่วโมง`
}

export function CheckOutDialog({
  open, onOpenChange, step, cardType, hours, fee,
  entryTime, customExitTime, overnightCfg, afterHoursCfg, onCustomExitTimeChange,
  onSimulateScan, onBack, onConfirm,
}: Props) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [discounts, setDiscounts] = useState<DiscountOption[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [dailySelectedId, setDailySelectedId] = useState<string>('')
  const [cashReceived, setCashReceived] = useState('')

  const storeDiscounts = discounts.filter(d => d.discountType !== 'per_day')
  const dailyDiscounts = discounts.filter(d => d.discountType === 'per_day')

  const selectedDiscount = storeDiscounts.find(d => d._id === selectedId) ?? null
  const discountAmount = calcDiscountAmount(selectedDiscount, fee)

  const exitTimeDate = customExitTime ? new Date(customExitTime) : null
  const exitForCalc = exitTimeDate ?? new Date()
  const breakdown = entryTime
    ? calcFeeBreakdown(cardType, entryTime, exitForCalc, overnightCfg, afterHoursCfg)
    : null
  const isOvernightSession = breakdown?.segments.some(s => s.kind === 'overnight') ?? false
  const hasAfterHours = breakdown?.segments.some(s => s.kind === 'after-hours') ?? false
  const nights = breakdown?.segments.filter(s => s.kind === 'overnight').length ?? 0

  const selectedDailyDiscount = dailyDiscounts.find(d => d._id === dailySelectedId) ?? null
  const dailyDiscountAmount = selectedDailyDiscount ? selectedDailyDiscount.discountValue * nights : 0

  const totalDiscountAmount = discountAmount + dailyDiscountAmount
  const finalFee = Math.max(0, fee - totalDiscountAmount)
  const cashNum = parseFloat(cashReceived) || 0
  const change = cashNum - finalFee

  const durationStr = fmtDuration(entryTime, exitTimeDate, hours)

  useEffect(() => {
    if (open) {
      fetch('/api/discounts?active=1')
        .then(r => r.json())
        .then(d => setDiscounts(Array.isArray(d) ? d : []))
        .catch(() => {})
    }
  }, [open])

  function handleClose(o: boolean) {
    if (!o) { setPaymentMethod('cash'); setSelectedId(''); setDailySelectedId(''); setCashReceived('') }
    onOpenChange(o)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl" showCloseButton>

        {/* Header */}
        <DialogHeader className="bg-gradient-to-r from-emerald-600 to-emerald-500">
          <div className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-white/20 shrink-0">
              <LogOut className="size-3.5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white text-sm">ขาออก</DialogTitle>
              <DialogDescription className="text-emerald-100 text-xs mt-0">คำนวณค่าบริการและรับชำระเงิน</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="py-3">
          {step === 'scan' ? (
            /* ── Scan step ── */
            <div
              onClick={onSimulateScan}
              className="w-full cursor-pointer flex flex-col items-center gap-2 p-8 rounded-lg border-2 border-dashed border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400 transition-all active:scale-[0.98]"
            >
              <div className="flex size-14 items-center justify-center rounded-xl bg-emerald-600 shadow-md shadow-emerald-500/30 animate-pulse">
                <CreditCard className="size-7 text-white" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-emerald-800">รอการสแกนบัตร...</p>
                <p className="text-xs text-emerald-500 mt-0.5">รับบัตรจากลูกค้าแล้วแตะที่เครื่องอ่านบัตร</p>
                <p className="text-[10px] text-emerald-400 mt-2 border border-emerald-200 px-2 py-0.5 rounded-full bg-white/60 inline-block">คลิกจำลองการสแกน</p>
              </div>
            </div>
          ) : (
            /* ── Payment step — 2-panel layout ── */
            <div className="grid grid-cols-[1.15fr_1fr] gap-3">

              {/* ═══ LEFT PANEL — info + breakdown ═══ */}
              <div className="space-y-2">

                {/* Card type + entry time */}
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-medium">บัตร</span>
                    <CardBadge type={cardType} />
                  </div>
                  <div className="flex flex-col justify-center px-2.5 py-2 rounded-lg bg-blue-50 border border-blue-200">
                    <span className="text-[10px] text-blue-400 flex items-center gap-1"><Clock className="size-3" /> ขาเข้า</span>
                    {entryTime ? (
                      <span className="text-[11px] font-black text-blue-800 tabular-nums leading-tight">
                        {entryTime.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        {' '}{entryTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    ) : <span className="text-[11px] text-blue-300">—</span>}
                  </div>
                </div>

                {/* Fee breakdown */}
                {onCustomExitTimeChange && !customExitTime ? (
                  <div className="rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 py-5">
                    <Timer className="size-4 text-slate-300" />
                    <p className="text-xs font-bold text-slate-400">กรุณากำหนดเวลาออก</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-emerald-200 overflow-hidden">
                    <div className="bg-emerald-50 px-2.5 py-1.5 flex items-center gap-1.5">
                      <Clock className="size-3 text-emerald-500" />
                      <span className="text-[11px] font-semibold text-emerald-700">{durationStr}</span>
                    </div>
                    <div className="px-2.5 py-2 space-y-1 border-t border-emerald-100">
                      {(isOvernightSession || hasAfterHours) && breakdown ? (
                        breakdown.segments.map((seg, i) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span style={{
                              color: seg.kind === 'overnight' ? '#7C3AED'
                                   : seg.kind === 'after-hours' ? '#DC2626'
                                   : '#64748B',
                            }}>
                              {seg.kind === 'overnight' ? '🌙 ' : seg.kind === 'after-hours' ? '⚠️ ' : ''}{seg.rateLabel}
                            </span>
                            <span className="font-bold tabular-nums" style={{
                              color: seg.kind === 'overnight' ? '#7C3AED'
                                   : seg.kind === 'after-hours' ? '#DC2626'
                                   : '#334155',
                            }}>
                              ฿{seg.fee}
                            </span>
                          </div>
                        ))
                      ) : (
                        <>
                          {cardType === 'car' && <>
                            <div className="flex justify-between text-xs text-slate-600"><span>ชั่วโมงแรก</span><span className="tabular-nums">฿30</span></div>
                            {hours > 1 && <div className="flex justify-between text-xs text-slate-600"><span>{hours - 1} ชม. × ฿20</span><span className="tabular-nums">฿{(hours - 1) * 20}</span></div>}
                          </>}
                          {cardType === 'motorcycle' && <>
                            <div className="flex justify-between text-xs text-slate-600"><span>ชั่วโมงแรก</span><span className="tabular-nums">฿20</span></div>
                            {hours > 1 && <div className="flex justify-between text-xs text-slate-600"><span>{hours - 1} ชม. × ฿10</span><span className="tabular-nums">฿{(hours - 1) * 10}</span></div>}
                          </>}
                          {cardType === 'overnight' && (
                            <div className="flex justify-between text-xs text-slate-600">
                              <span>ค้างคืน ({overnightCfg?.windowStart ?? '18:00'}–{overnightCfg?.windowEnd ?? '07:00'})</span>
                              <span className="tabular-nums">฿{overnightCfg?.flatRate ?? 100}</span>
                            </div>
                          )}
                        </>
                      )}
                      {discountAmount > 0 && (
                        <div className="flex justify-between text-xs font-semibold pt-0.5 border-t border-dashed border-slate-100" style={{ color: '#EA580C' }}>
                          <span className="flex items-center gap-1"><Tag className="size-3" />{selectedDiscount?.name}</span>
                          <span className="tabular-nums">-฿{discountAmount}</span>
                        </div>
                      )}
                      {dailyDiscountAmount > 0 && (
                        <div className="flex justify-between text-xs font-semibold" style={{ color: '#7C3AED' }}>
                          <span className="flex items-center gap-1"><Moon className="size-3" />{selectedDailyDiscount?.name} ×{nights}</span>
                          <span className="tabular-nums">-฿{dailyDiscountAmount}</span>
                        </div>
                      )}
                    </div>
                    <div className="px-2.5 py-2 flex items-center justify-between"
                      style={{ background: totalDiscountAmount > 0 ? 'linear-gradient(135deg,#059669,#10B981)' : '#059669' }}>
                      <div>
                        <span className="text-emerald-100 text-[11px] font-semibold">ยอดชำระ</span>
                        {totalDiscountAmount > 0 && (
                          <p className="text-emerald-300 text-[10px] line-through tabular-nums">฿{fee}</p>
                        )}
                      </div>
                      <span className="text-2xl font-black text-white tabular-nums">฿{finalFee}</span>
                    </div>
                  </div>
                )}

                {/* Sim: custom exit time */}
                {onCustomExitTimeChange && (
                  <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left"
                      style={{ background: customExitTime ? 'rgba(109,40,217,0.05)' : '#FAFBFF' }}
                      onClick={() => onCustomExitTimeChange(customExitTime ? '' : new Date().toISOString().slice(0, 19))}
                    >
                      <Timer className="size-3 shrink-0" style={{ color: customExitTime ? '#6D28D9' : '#94A3B8' }} />
                      <span className="text-[10px] font-bold flex-1" style={{ color: customExitTime ? '#6D28D9' : '#94A3B8' }}>
                        {customExitTime ? 'กำหนดเวลาออกเอง' : 'ใช้เวลาจริง (กดเพื่อกำหนดเอง)'}
                      </span>
                      {customExitTime && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(109,40,217,0.1)', color: '#6D28D9' }}>SIM</span>
                      )}
                    </button>
                    {customExitTime && (
                      <div className="px-2.5 pb-2 pt-1" style={{ background: 'rgba(109,40,217,0.03)' }}>
                        <input type="datetime-local" step="1" value={customExitTime}
                          onChange={e => onCustomExitTimeChange(e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg text-xs text-slate-800 outline-none"
                          style={{ border: '1.5px solid rgba(109,40,217,0.3)', background: 'white' }}
                          onFocus={e => e.currentTarget.style.borderColor = '#6D28D9'}
                          onBlur={e => e.currentTarget.style.borderColor = 'rgba(109,40,217,0.3)'} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ═══ RIGHT PANEL — payment + discount ═══ */}
              <div className="space-y-2.5">

                {/* Payment method */}
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">วิธีชำระเงิน</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button type="button" onClick={() => { setPaymentMethod('cash'); setCashReceived('') }}
                      className="flex flex-col items-center justify-center gap-1 h-14 rounded-xl text-xs font-bold transition-all"
                      style={paymentMethod === 'cash'
                        ? { background: '#059669', color: 'white', boxShadow: '0 2px 8px rgba(5,150,105,0.35)' }
                        : { background: '#F1F5F9', color: '#64748B', border: '1.5px solid #E2E8F0' }}>
                      <Banknote className="size-5" />
                      เงินสด
                    </button>
                    <button type="button" onClick={() => { setPaymentMethod('qr'); setCashReceived('') }}
                      className="flex flex-col items-center justify-center gap-1 h-14 rounded-xl text-xs font-bold transition-all"
                      style={paymentMethod === 'qr'
                        ? { background: '#7C3AED', color: 'white', boxShadow: '0 2px 8px rgba(124,58,237,0.35)' }
                        : { background: '#F1F5F9', color: '#64748B', border: '1.5px solid #E2E8F0' }}>
                      <Smartphone className="size-5" />
                      โอนเงิน
                    </button>
                  </div>
                </div>

                {/* Cash received + change */}
                {paymentMethod === 'cash' && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">รับเงิน (฿)</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder={`≥ ฿${finalFee}`}
                      value={cashReceived}
                      onChange={e => setCashReceived(toAsciiNumber(e.target.value))}
                      className="w-full h-10 px-3 rounded-lg text-xl font-black text-slate-800 outline-none tabular-nums"
                      style={{ border: '1.5px solid #E2E8F0', background: 'white' }}
                      onFocus={e => e.currentTarget.style.borderColor = '#059669'}
                      onBlur={e => e.currentTarget.style.borderColor = '#E2E8F0'}
                    />
                    {cashReceived !== '' && (
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg"
                        style={{ background: change >= 0 ? 'rgba(5,150,105,0.07)' : 'rgba(220,38,38,0.06)', border: `1px solid ${change >= 0 ? 'rgba(5,150,105,0.2)' : 'rgba(220,38,38,0.2)'}` }}>
                        <span className="text-xs font-bold" style={{ color: change >= 0 ? '#059669' : '#DC2626' }}>
                          {change >= 0 ? 'เงินทอน' : 'รับไม่พอ'}
                        </span>
                        <span className="text-lg font-black tabular-nums" style={{ color: change >= 0 ? '#059669' : '#DC2626' }}>
                          ฿{Math.abs(change)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Discounts */}
                {storeDiscounts.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                      <Tag className="size-3" /> ส่วนลดร้านค้า
                    </p>
                    <div className="relative">
                      <select
                        value={selectedId}
                        onChange={e => setSelectedId(e.target.value)}
                        className="w-full h-9 rounded-lg pl-2.5 pr-7 text-xs font-semibold text-slate-700 outline-none appearance-none cursor-pointer"
                        style={{ border: selectedId ? '2px solid #EA580C' : '1.5px solid #E2E8F0', background: selectedId ? 'rgba(234,88,12,0.04)' : '#F8FAFF' }}
                      >
                        <option value="">— ไม่มีส่วนลด —</option>
                        {storeDiscounts.map(d => (
                          <option key={d._id} value={d._id}>
                            {d.name} ({d.discountType === 'fixed' ? `฿${d.discountValue}` : `${d.discountValue}%`})
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="size-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                )}

                {dailyDiscounts.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1" style={{ color: '#6D28D9' }}>
                      <Moon className="size-3" /> ส่วนลดรายคืน
                      {nights > 0 && <span className="font-normal text-slate-400 normal-case">({nights} คืน)</span>}
                    </p>
                    <div className="relative">
                      <select
                        value={dailySelectedId}
                        onChange={e => setDailySelectedId(e.target.value)}
                        className="w-full h-9 rounded-lg pl-2.5 pr-7 text-xs font-semibold text-slate-700 outline-none appearance-none cursor-pointer"
                        style={{ border: dailySelectedId ? '2px solid #7C3AED' : '1.5px solid #E2E8F0', background: dailySelectedId ? 'rgba(124,58,237,0.04)' : '#F8FAFF' }}
                      >
                        <option value="">— ไม่ใช้ส่วนลด —</option>
                        {dailyDiscounts.map(d => (
                          <option key={d._id} value={d._id}>
                            {d.name} ฿{d.discountValue}/คืน{nights > 0 ? ` ×${nights}=฿${d.discountValue * nights}` : ''}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="size-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          {step === 'scan' ? (
            <DialogClose asChild><Button variant="outline" size="sm">ยกเลิก</Button></DialogClose>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={onBack}>← สแกนใหม่</Button>
              <Button
                size="sm"
                className="flex-1 text-white font-bold"
                disabled={
                  (!!onCustomExitTimeChange && !customExitTime) ||
                  (paymentMethod === 'cash' && cashReceived !== '' && change < 0)
                }
                style={paymentMethod === 'qr' ? { background: '#7C3AED' } : { background: '#059669' }}
                onClick={() => onConfirm(paymentMethod, selectedId || undefined, dailySelectedId || undefined)}
              >
                {paymentMethod === 'cash'
                  ? <><Banknote className="size-4" /> รับเงินสด ฿{finalFee}</>
                  : <><Smartphone className="size-4" /> ยืนยันรับโอน ฿{finalFee}</>}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
