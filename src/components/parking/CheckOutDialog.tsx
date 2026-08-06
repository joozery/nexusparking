'use client'

import { useState, useEffect } from 'react'
import { CreditCard, LogOut, Clock, Banknote, Smartphone, Tag, ChevronDown, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogBody, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { CardBadge } from './CardBadge'
import { type CardType } from './types'

export type PaymentMethod = 'cash' | 'qr'

interface DiscountOption {
  _id: string
  name: string
  discountType: 'fixed' | 'percent'
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
  customExitTime?: string
  onCustomExitTimeChange?: (v: string) => void
  onSimulateScan: () => void
  onBack: () => void
  onConfirm: (paymentMethod: PaymentMethod, discountId?: string) => void
}

function calcDiscountAmount(discount: DiscountOption | null, fee: number): number {
  if (!discount) return 0
  if (discount.discountType === 'fixed') return Math.min(discount.discountValue, fee)
  const pct = Math.floor(fee * discount.discountValue / 100)
  return discount.maxDiscount ? Math.min(pct, discount.maxDiscount) : pct
}

export function CheckOutDialog({
  open, onOpenChange, step, cardType, hours, fee,
  customExitTime, onCustomExitTimeChange,
  onSimulateScan, onBack, onConfirm,
}: Props) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [discounts, setDiscounts] = useState<DiscountOption[]>([])
  const [selectedId, setSelectedId] = useState<string>('')

  const selectedDiscount = discounts.find(d => d._id === selectedId) ?? null
  const discountAmount = calcDiscountAmount(selectedDiscount, fee)
  const finalFee = Math.max(0, fee - discountAmount)

  useEffect(() => {
    if (open) {
      fetch('/api/discounts?active=1')
        .then(r => r.json())
        .then(d => setDiscounts(Array.isArray(d) ? d : []))
        .catch(() => {})
    }
  }, [open])

  function handleClose(o: boolean) {
    if (!o) { setPaymentMethod('cash'); setSelectedId('') }
    onOpenChange(o)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm" showCloseButton>

        <DialogHeader className="bg-gradient-to-r from-emerald-600 to-emerald-500">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-white/20 shrink-0">
              <LogOut className="size-4 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white text-sm">ขาออก</DialogTitle>
              <DialogDescription className="text-emerald-100 text-xs mt-0">คำนวณค่าบริการและรับชำระเงิน</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-3 py-3">
          {step === 'scan' ? (
            <div
              onClick={onSimulateScan}
              className="w-full cursor-pointer flex flex-col items-center gap-2 p-5 rounded-lg border-2 border-dashed border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400 transition-all active:scale-[0.98]"
            >
              <div className="flex size-12 items-center justify-center rounded-lg bg-emerald-600 shadow-md shadow-emerald-500/30 animate-pulse">
                <CreditCard className="size-6 text-white" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-emerald-800">รอการสแกนบัตร...</p>
                <p className="text-xs text-emerald-500 mt-0.5">รับบัตรจากลูกค้าแล้วแตะที่เครื่องอ่านบัตร</p>
                <p className="text-[10px] text-emerald-400 mt-1.5 border border-emerald-200 px-2 py-0.5 rounded-full bg-white/60 inline-block">คลิกจำลองการสแกน</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-xs text-slate-600 font-medium">ประเภทบัตร</span>
                <CardBadge type={cardType} />
              </div>

              {/* Fee breakdown */}
              <div className="rounded-lg border border-emerald-200 overflow-hidden">
                <div className="bg-emerald-50 px-3 py-2 flex items-center gap-2">
                  <Clock className="size-3.5 text-emerald-600" />
                  <span className="text-xs font-semibold text-emerald-800">ระยะเวลาจอด: {hours} ชั่วโมง</span>
                </div>
                <div className="px-3 py-2 space-y-1.5 border-t border-emerald-100">
                  {cardType === 'car' && <>
                    <div className="flex justify-between text-xs text-slate-600"><span>ชั่วโมงแรก</span><span>฿30</span></div>
                    {hours > 1 && <div className="flex justify-between text-xs text-slate-600"><span>{hours - 1} ชม.ถัดไป × ฿20</span><span>฿{(hours - 1) * 20}</span></div>}
                  </>}
                  {cardType === 'motorcycle' && <>
                    <div className="flex justify-between text-xs text-slate-600"><span>ชั่วโมงแรก</span><span>฿20</span></div>
                    {hours > 1 && <div className="flex justify-between text-xs text-slate-600"><span>{hours - 1} ชม.ถัดไป × ฿10</span><span>฿{(hours - 1) * 10}</span></div>}
                  </>}
                  {cardType === 'overnight' && (
                    <div className="flex justify-between text-xs text-slate-600"><span>ค้างคืน (22:00–07:00)</span><span>฿100</span></div>
                  )}
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-xs font-semibold" style={{ color: '#EA580C' }}>
                      <span className="flex items-center gap-1"><Tag className="size-3" />{selectedDiscount?.name}</span>
                      <span>-฿{discountAmount}</span>
                    </div>
                  )}
                </div>
                <div className="px-3 py-2.5 flex items-center justify-between"
                  style={{ background: finalFee < fee ? 'linear-gradient(135deg,#059669,#10B981)' : '#059669' }}>
                  <div>
                    <span className="text-emerald-100 text-xs font-semibold">ยอดชำระทั้งสิ้น</span>
                    {discountAmount > 0 && (
                      <p className="text-emerald-200 text-[10px] line-through">฿{fee}</p>
                    )}
                  </div>
                  <span className="text-xl font-black text-white tabular-nums">฿{finalFee}</span>
                </div>
              </div>

              {/* Custom exit time (sim mode) */}
              {onCustomExitTimeChange && (
                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2 text-left"
                    style={{ background: customExitTime ? 'rgba(109,40,217,0.05)' : '#FAFBFF' }}
                    onClick={() => onCustomExitTimeChange(customExitTime ? '' : new Date().toISOString().slice(0, 19))}
                  >
                    <Timer className="size-3.5 shrink-0" style={{ color: customExitTime ? '#6D28D9' : '#94A3B8' }} />
                    <span className="text-[10px] font-bold flex-1" style={{ color: customExitTime ? '#6D28D9' : '#94A3B8' }}>
                      {customExitTime ? 'กำหนดเวลาออกเอง' : 'ใช้เวลาจริง (คลิกเพื่อกำหนดเอง)'}
                    </span>
                    {customExitTime && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(109,40,217,0.1)', color: '#6D28D9' }}>SIM</span>
                    )}
                  </button>
                  {customExitTime && (
                    <div className="px-3 pb-2.5 pt-1" style={{ background: 'rgba(109,40,217,0.03)' }}>
                      <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">วัน-เวลาออก (วินาทีได้)</label>
                      <input type="datetime-local" step="1" value={customExitTime}
                        onChange={e => onCustomExitTimeChange(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg text-xs text-slate-800 outline-none"
                        style={{ border: '1.5px solid rgba(109,40,217,0.3)', background: 'white' }}
                        onFocus={e => e.currentTarget.style.borderColor = '#6D28D9'}
                        onBlur={e => e.currentTarget.style.borderColor = 'rgba(109,40,217,0.3)'} />
                    </div>
                  )}
                </div>
              )}

              {/* Discount dropdown */}
              {discounts.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <Tag className="size-3" /> ส่วนลดร้านค้า
                  </p>
                  <div className="relative">
                    <select
                      value={selectedId}
                      onChange={e => setSelectedId(e.target.value)}
                      className="w-full h-10 rounded-xl pl-3 pr-8 text-sm font-semibold text-slate-700 outline-none appearance-none cursor-pointer"
                      style={{ border: selectedId ? '2px solid #EA580C' : '1.5px solid #E2E8F0', background: selectedId ? 'rgba(234,88,12,0.04)' : '#F8FAFF' }}
                    >
                      <option value="">— ไม่มีส่วนลด —</option>
                      {discounts.map(d => (
                        <option key={d._id} value={d._id}>
                          {d.name} ({d.discountType === 'fixed' ? `ลด ฿${d.discountValue}` : `ลด ${d.discountValue}%`})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="size-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  {selectedDiscount?.description && (
                    <p className="text-[10px] text-slate-400 mt-1 px-1">{selectedDiscount.description}</p>
                  )}
                </div>
              )}

              {/* Payment method */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">วิธีชำระเงิน</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setPaymentMethod('cash')}
                    className="flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-bold transition-all"
                    style={paymentMethod === 'cash'
                      ? { background: '#059669', color: 'white', boxShadow: '0 2px 8px rgba(5,150,105,0.35)' }
                      : { background: '#F1F5F9', color: '#64748B', border: '1.5px solid #E2E8F0' }}>
                    <Banknote className="size-4" /> เงินสด
                  </button>
                  <button type="button" onClick={() => setPaymentMethod('qr')}
                    className="flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-bold transition-all"
                    style={paymentMethod === 'qr'
                      ? { background: '#7C3AED', color: 'white', boxShadow: '0 2px 8px rgba(124,58,237,0.35)' }
                      : { background: '#F1F5F9', color: '#64748B', border: '1.5px solid #E2E8F0' }}>
                    <Smartphone className="size-4" /> โอนเงิน
                  </button>
                </div>
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
                className="flex-1 text-white"
                style={paymentMethod === 'qr' ? { background: '#7C3AED' } : { background: '#059669' }}
                onClick={() => onConfirm(paymentMethod, selectedId || undefined)}
              >
                {paymentMethod === 'cash'
                  ? <><Banknote className="size-3.5" /> รับเงินสด ฿{finalFee}</>
                  : <><Smartphone className="size-3.5" /> ยืนยันรับโอน ฿{finalFee}</>}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
