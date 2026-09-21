'use client'

import { useState, useEffect, useRef } from 'react'
import { CreditCard, LogOut, Banknote, Smartphone, Tag, ChevronDown, Timer, Moon, CheckCircle2, Printer, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogBody, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { type CardType } from './types'
import { calcFeeBreakdown, type OvernightConfig } from '@/lib/calcFee'
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

interface FineOption {
  _id: string
  name: string
  amount: number
  description?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  step: 'scan' | 'payment' | 'done'
  plate?: string
  cardType: CardType
  hours: number
  fee: number
  paidAmount?: number
  entryTime?: Date | null
  customExitTime?: string
  scannedExitTime?: string
  overnightCfg?: OvernightConfig
  printing?: boolean
  lostCardFine?: number
  checkoutSource: 'card' | 'plate'
  onCustomExitTimeChange?: (v: string) => void
  onSimulateScan?: () => void
  onBack: () => void
  onConfirm: (paymentMethod: PaymentMethod, discountId?: string, dailyDiscountId?: string, isLostCard?: boolean, fineId?: string) => void
  onPrintReceipt?: () => void
  onDownloadPdf?: () => void
  downloadingPdf?: boolean
  onDone?: () => void
}

function calcDiscountAmount(discount: DiscountOption | null, fee: number): number {
  if (!discount) return 0
  if (discount.discountType === 'fixed') return Math.min(discount.discountValue, fee)
  const pct = Math.floor(fee * discount.discountValue / 100)
  return discount.maxDiscount ? Math.min(pct, discount.maxDiscount) : pct
}

function fmtDuration(entryTime: Date | null | undefined, exitTime: Date | null | undefined, fallbackHours: number): string {
  if (entryTime && exitTime) {
    const seconds = Math.max(0, Math.floor((exitTime.getTime() - entryTime.getTime()) / 1000))
    const minutes = Math.floor(seconds / 60)
    return `${Math.floor(minutes / 1440)} วัน ${Math.floor((minutes % 1440) / 60)} ชั่วโมง ${minutes % 60} นาที ${seconds % 60} วินาที`
  }
  return `${Math.floor(fallbackHours / 24)} วัน ${fallbackHours % 24} ชั่วโมง 0 นาที 0 วินาที`
}

export function CheckOutDialog({
  open, onOpenChange, step, plate, cardType, hours, fee, paidAmount, printing, lostCardFine = 300, checkoutSource,
  entryTime, customExitTime, scannedExitTime, overnightCfg, onCustomExitTimeChange,
  onSimulateScan, onConfirm, onPrintReceipt, onDone, onDownloadPdf, downloadingPdf,
}: Props) {
  const isMoto = cardType === 'motorcycle'
  const theme = {
    headerGrad:  isMoto ? 'from-sky-600 to-sky-500' : 'from-yellow-600 to-yellow-500',
    headerDesc:  isMoto ? 'text-sky-100' : 'text-yellow-100',
    doneBg:      isMoto ? 'bg-sky-100' : 'bg-yellow-100',
    doneIcon:    isMoto ? 'text-sky-600' : 'text-yellow-600',
    doneTitle:   isMoto ? 'text-sky-800' : 'text-yellow-800',
    scanBorder:  isMoto ? 'border-sky-200' : 'border-yellow-200',
    scanBg:      isMoto ? 'bg-sky-50' : 'bg-yellow-50',
    scanHoverBg: isMoto ? 'hover:bg-sky-100' : 'hover:bg-yellow-100',
    scanHoverBd: isMoto ? 'hover:border-sky-400' : 'hover:border-yellow-400',
    scanIconBg:  isMoto ? 'bg-sky-600' : 'bg-yellow-600',
    scanIconSh:  isMoto ? 'shadow-sky-500/30' : 'shadow-yellow-500/30',
    scanTitle:   isMoto ? 'text-sky-800' : 'text-yellow-800',
    scanSub:     isMoto ? 'text-sky-500' : 'text-yellow-500',
    scanHint:    isMoto ? 'text-sky-400' : 'text-yellow-400',
    scanHintBd:  isMoto ? 'border-sky-200' : 'border-yellow-200',
    panelBorder: isMoto ? 'border-sky-200' : 'border-yellow-200',
    panelHeadBg: isMoto ? 'bg-sky-50' : 'bg-yellow-50',
    panelIcon:   isMoto ? 'text-sky-500' : 'text-yellow-500',
    panelDur:    isMoto ? 'text-sky-700' : 'text-yellow-700',
    panelDivider: isMoto ? 'border-sky-100' : 'border-yellow-100',
    totalLabel:  isMoto ? 'text-sky-100' : 'text-yellow-100',
    strike:      isMoto ? 'text-sky-300' : 'text-yellow-300',
    hex600: isMoto ? '#0284C7' : '#CA8A04',
    hex500: isMoto ? '#0EA5E9' : '#EAB308',
    rgb600: isMoto ? '2,132,199' : '202,138,4',
  }
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [discounts, setDiscounts] = useState<DiscountOption[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [dailySelectedId, setDailySelectedId] = useState<string>('')
  const [fines, setFines] = useState<FineOption[]>([])
  const [selectedFineId, setSelectedFineId] = useState<string>('')
  const [cashReceived, setCashReceived] = useState('')
  const cashInputRef = useRef<HTMLInputElement>(null)
  const entryTimestamp = entryTime?.getTime()
  useEffect(() => {
    if (!open || step !== 'payment' || paymentMethod !== 'cash') return
    // Allow the dialog focus trap to mount before focusing the payment input.
    const timer = setTimeout(() => cashInputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [open, step, paymentMethod, plate, entryTimestamp])
  const [isLostCard, setIsLostCard] = useState(checkoutSource === 'plate')
  const lostContext = `${open}:${plate}:${entryTime?.getTime()}:${checkoutSource}`
  const [previousLostContext, setPreviousLostContext] = useState(lostContext)
  if (previousLostContext !== lostContext) {
    setPreviousLostContext(lostContext)
    setIsLostCard(checkoutSource === 'plate')
  }

  const storeDiscounts = discounts.filter(d => d.discountType !== 'per_day')
  const dailyDiscounts = discounts.filter(d => d.discountType === 'per_day')

  const selectedDiscount = storeDiscounts.find(d => d._id === selectedId) ?? null
  const discountAmount = calcDiscountAmount(selectedDiscount, fee)

  const [currentTime, setCurrentTime] = useState(() => Date.now())
  useEffect(() => {
    if (!open || step !== 'payment' || customExitTime || scannedExitTime) return
    const timer = setTimeout(() => setCurrentTime(Date.now()), 0)
    return () => clearTimeout(timer)
  }, [open, step, plate, entryTimestamp, customExitTime, scannedExitTime])
  const exitTimeDate = customExitTime ? new Date(customExitTime) : scannedExitTime ? new Date(scannedExitTime) : new Date(currentTime)
  const exitForCalc = exitTimeDate
  const breakdown = entryTime
    ? calcFeeBreakdown(cardType, entryTime, exitForCalc, overnightCfg)
    : null
  const nights = breakdown?.segments.filter(s => s.kind === 'overnight').length ?? 0

  const selectedDailyDiscount = dailyDiscounts.find(d => d._id === dailySelectedId) ?? null
  const dailyDiscountAmount = selectedDailyDiscount ? selectedDailyDiscount.discountValue * nights : 0

  const selectedFine = fines.find(f => f._id === selectedFineId) ?? null
  const fineAmount = selectedFine?.amount ?? 0

  const totalDiscountAmount = discountAmount + dailyDiscountAmount
  const finalFee = Math.max(0, fee - totalDiscountAmount) + fineAmount + (isLostCard ? lostCardFine : 0)
  const cashNum = parseFloat(cashReceived) || 0
  const change = cashNum - finalFee

  const durationStr = fmtDuration(entryTime, exitTimeDate, hours)

  useEffect(() => {
    if (open) {
      fetch('/api/discounts?active=1')
        .then(r => r.json())
        .then(d => setDiscounts(Array.isArray(d) ? d : []))
        .catch(() => {})
      fetch('/api/fines?active=1')
        .then(r => r.json())
        .then(f => setFines(Array.isArray(f) ? f : []))
        .catch(() => {})
    }
  }, [open])

  // ทะเบียนนี้เคยมีประวัติบัตรหายไหม — เตือน operator ก่อนปล่อยรถออก
  const [lostHistory, setLostHistory] = useState<{ _id: string; exitTime?: string; totalFee: number }[]>([])
  useEffect(() => {
    if (open && plate) {
      fetch(`/api/sessions?plate=${encodeURIComponent(plate)}&status=lost&limit=5`)
        .then(r => r.ok ? r.json() : null)
        .then(d => setLostHistory(d?.sessions ?? []))
        .catch(() => setLostHistory([]))
    } else {
      setLostHistory([])
    }
  }, [open, plate])

  function handleClose(o: boolean) {
    if (!o) { setPaymentMethod('cash'); setSelectedId(''); setDailySelectedId(''); setSelectedFineId(''); setCashReceived('') }
    onOpenChange(o)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto" showCloseButton
        onOpenAutoFocus={e => {
          if (step === 'payment' && paymentMethod === 'cash') {
            e.preventDefault()
            cashInputRef.current?.focus()
          }
        }}>

        {/* Header */}
        <DialogHeader className={`bg-gradient-to-r ${theme.headerGrad}`}>
          <div className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-white/20 shrink-0">
              <LogOut className="size-3.5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white text-lg">ขาออก</DialogTitle>
              <DialogDescription className={`${theme.headerDesc} text-base mt-0`}>คำนวณค่าบริการและรับชำระเงิน</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="px-6 py-6">
          {step === 'done' ? (
            /* ── Done step — payment confirmed, offer optional receipt print ── */
            <div className="flex flex-col items-center gap-3 py-6">
              <div className={`flex size-14 items-center justify-center rounded-full ${theme.doneBg}`}>
                <CheckCircle2 className={`size-8 ${theme.doneIcon}`} />
              </div>
              <div className="text-center">
                <p className={`text-base font-bold ${theme.doneTitle}`}>รับชำระเงินเรียบร้อย</p>
                <p className="text-2xl font-black text-slate-800 tabular-nums mt-1">฿{paidAmount ?? fee}</p>
                <p className="text-base text-slate-400 mt-1">ลิ้นชักเปิดแล้ว — พิมพ์ใบเสร็จเฉพาะถ้าลูกค้าต้องการ</p>
              </div>
            </div>
          ) : step === 'scan' ? (
            /* ── Scan step ── */
            <div
              onClick={onSimulateScan}
              className={`w-full cursor-pointer flex flex-col items-center gap-2 p-8 rounded-lg border-2 border-dashed ${theme.scanBorder} ${theme.scanBg} ${theme.scanHoverBg} ${theme.scanHoverBd} transition-all active:scale-[0.98]`}
            >
              <div className={`flex size-14 items-center justify-center rounded-xl ${theme.scanIconBg} shadow-md ${theme.scanIconSh} animate-pulse`}>
                <CreditCard className="size-7 text-white" />
              </div>
              <div className="text-center">
                <p className={`text-base font-bold ${theme.scanTitle}`}>รอการสแกนบัตร...</p>
                <p className={`text-base ${theme.scanSub} mt-0.5`}>รับบัตรจากลูกค้าแล้วแตะที่เครื่องอ่านบัตร</p>
                {onSimulateScan && <p className={`text-sm ${theme.scanHint} mt-2 border ${theme.scanHintBd} px-2 py-0.5 rounded-full bg-white/60 inline-block`}>คลิกจำลองการสแกน</p>}
              </div>
            </div>
          ) : (
            /* ── Payment step — 2-panel layout ── */
            <div className="space-y-2">

              {/* ทะเบียนนี้เคยมีประวัติบัตรหาย — โชว์บัตรทั้ง 2 ใบให้ operator เช็คก่อนปล่อยรถ */}
              {lostHistory.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                  <p className="text-base font-bold text-amber-800 flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5" /> ทะเบียนนี้เคยมีประวัติบัตรหาย {lostHistory.length} ครั้ง
                  </p>
                  <div className="mt-1 space-y-0.5">
                    {lostHistory.map(h => (
                      <p key={h._id} className="text-sm text-amber-700 tabular-nums">
                        {h.exitTime
                          ? new Date(h.exitTime).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })
                          : '—'}
                        {' '}· ปรับ ฿{h.totalFee}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-[1.15fr_1fr] gap-6">

              {/* ═══ LEFT PANEL — info + breakdown ═══ */}
              <div className="space-y-2">

                <div className={'rounded-lg border overflow-hidden text-base ' + theme.panelBorder}>
                  <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-3 p-4 text-base font-medium text-slate-700 [&>dd]:m-0 [&>dd]:break-words [&>dd]:tabular-nums">
                    <dt>ทะเบียน</dt><dd>{plate || '—'}</dd>
                    <dt>ประเภทรถ</dt><dd>{{ car: 'รถยนต์', motorcycle: 'รถจักรยานยนต์', overnight: 'รถยนต์ (ค้างคืน)' }[cardType]}</dd>
                    <dt>เวลาเข้าจอด</dt><dd>{entryTime ? entryTime.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</dd>
                    <dt>ออกเวลา</dt><dd>{exitTimeDate.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</dd>
                    <dt>จอดเป็นเวลา</dt><dd>{durationStr}</dd>
                    <dt>คิดค่าจอด</dt><dd>{onCustomExitTimeChange && !customExitTime ? 'กรุณากำหนดเวลาออก' : '฿' + fee.toLocaleString('th-TH')}</dd>
                    {discountAmount > 0 && <><dt>ส่วนลด</dt><dd>{selectedDiscount?.name} −฿{discountAmount.toLocaleString('th-TH')}</dd></>}
                    {dailyDiscountAmount > 0 && <><dt>ส่วนลดรายวัน</dt><dd>{selectedDailyDiscount?.name} ×{nights} −฿{dailyDiscountAmount.toLocaleString('th-TH')}</dd></>}
                    {fineAmount > 0 && <><dt>{selectedFine?.name || 'ค่าปรับอื่น'}</dt><dd>฿{fineAmount.toLocaleString('th-TH')}</dd></>}
                    {isLostCard && <><dt>ค่าปรับบัตรหาย</dt><dd>฿{lostCardFine.toLocaleString('th-TH')}</dd></>}
                  </dl>
                  <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 px-4 py-3 text-base font-semibold text-white" style={{ background: theme.hex600 }}>
                    <span>ยอดชำระ</span><span className="tabular-nums">฿{finalFee.toLocaleString('th-TH')}</span>
                  </div>
                </div>

                {/* Plate lookup is a dedicated lost-card path; card taps never enter it. */}
                {checkoutSource === 'plate' && (
                  <div
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left"
                    style={{ background: 'rgba(217,119,6,0.1)', border: '1.5px solid rgba(217,119,6,0.4)' }}
                  >
                    <input aria-label="ยืนยันบัตรหาย" type="checkbox" checked={isLostCard} onChange={e => setIsLostCard(e.target.checked)} />
                    <AlertTriangle className="size-3.5 shrink-0 text-amber-700" />
                    <span className="text-sm font-bold flex-1 text-amber-800">
                      ยืนยันว่าบัตรหาย — เพิ่ม ฿{lostCardFine}
                    </span>
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
                      <span className="text-sm font-bold flex-1" style={{ color: customExitTime ? '#6D28D9' : '#94A3B8' }}>
                        {customExitTime ? 'กำหนดเวลาออกเอง' : 'ใช้เวลาจริง (กดเพื่อกำหนดเอง)'}
                      </span>
                      {customExitTime && (
                        <span className="text-sm font-black px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(109,40,217,0.1)', color: '#6D28D9' }}>SIM</span>
                      )}
                    </button>
                    {customExitTime && (
                      <div className="px-2.5 pb-2 pt-1" style={{ background: 'rgba(109,40,217,0.03)' }}>
                        <input type="datetime-local" step="1" value={customExitTime}
                          onChange={e => onCustomExitTimeChange(e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg text-base text-slate-800 outline-none"
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
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1.5">วิธีชำระเงิน</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button type="button" onClick={() => { setPaymentMethod('cash'); setCashReceived('') }}
                      className="flex flex-col items-center justify-center gap-1 h-20 rounded-xl text-base font-bold transition-all"
                      style={paymentMethod === 'cash'
                        ? { background: theme.hex600, color: 'white', boxShadow: `0 2px 8px rgba(${theme.rgb600},0.35)` }
                        : { background: '#F1F5F9', color: '#64748B', border: '1.5px solid #E2E8F0' }}>
                      <Banknote className="size-5" />
                      เงินสด
                    </button>
                    <button type="button" onClick={() => { setPaymentMethod('qr'); setCashReceived('') }}
                      className="flex flex-col items-center justify-center gap-1 h-20 rounded-xl text-base font-bold transition-all"
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
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">รับเงิน (฿)</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder={`≥ ฿${finalFee}`}
                      ref={cashInputRef}
                      value={cashReceived}
                      onChange={e => setCashReceived(toAsciiNumber(e.target.value))}
                      className="w-full h-14 px-3 rounded-lg text-xl font-black text-slate-800 outline-none tabular-nums"
                      style={{ border: '1.5px solid #E2E8F0', background: 'white' }}
                      onFocus={e => e.currentTarget.style.borderColor = theme.hex600}
                      onBlur={e => e.currentTarget.style.borderColor = '#E2E8F0'}
                    />
                    {cashReceived !== '' && (
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg"
                        style={{ background: change >= 0 ? 'rgba(5,150,105,0.07)' : 'rgba(220,38,38,0.06)', border: `1px solid ${change >= 0 ? 'rgba(5,150,105,0.2)' : 'rgba(220,38,38,0.2)'}` }}>
                        <span className="text-base font-bold" style={{ color: change >= 0 ? '#059669' : '#DC2626' }}>
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
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                      <Tag className="size-3" /> ส่วนลดร้านค้า
                    </p>
                    <div className="relative">
                      <select
                        value={selectedId}
                        onChange={e => setSelectedId(e.target.value)}
                        className="w-full h-12 rounded-lg pl-2.5 pr-7 text-base font-semibold text-slate-700 outline-none appearance-none cursor-pointer"
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
                    <p className="text-sm font-bold uppercase tracking-widest mb-1 flex items-center gap-1" style={{ color: '#6D28D9' }}>
                      <Moon className="size-3" /> ส่วนลดรายคืน
                      {nights > 0 && <span className="font-normal text-slate-400 normal-case">({nights} คืน)</span>}
                    </p>
                    <div className="relative">
                      <select
                        value={dailySelectedId}
                        onChange={e => setDailySelectedId(e.target.value)}
                        className="w-full h-12 rounded-lg pl-2.5 pr-7 text-base font-semibold text-slate-700 outline-none appearance-none cursor-pointer"
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

                {fines.length > 0 && (
                  <div>
                    <p className="text-sm font-bold uppercase tracking-widest mb-1 flex items-center gap-1" style={{ color: '#DC2626' }}>
                      <AlertTriangle className="size-3" /> ค่าปรับ
                    </p>
                    <div className="relative">
                      <select
                        value={selectedFineId}
                        onChange={e => setSelectedFineId(e.target.value)}
                        className="w-full h-12 rounded-lg pl-2.5 pr-7 text-base font-semibold text-slate-700 outline-none appearance-none cursor-pointer"
                        style={{ border: selectedFineId ? '2px solid #DC2626' : '1.5px solid #E2E8F0', background: selectedFineId ? 'rgba(220,38,38,0.04)' : '#F8FAFF' }}
                      >
                        <option value="">— ไม่มีค่าปรับ —</option>
                        {fines.map(f => (
                          <option key={f._id} value={f._id}>
                            {f.name} (+฿{f.amount})
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="size-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>
            </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter className="[&_button]:h-12 [&_button]:text-base">
          {step === 'done' ? (
            <>
              <Button variant="outline" size="sm" className="flex-1" disabled={printing} onClick={onPrintReceipt}>
                <Printer className="size-3.5" /> {printing ? 'กำลังพิมพ์...' : 'พิมพ์ใบเสร็จ'}
              </Button>
              {onDownloadPdf && <Button variant="outline" size="sm" className="flex-1" disabled={downloadingPdf} onClick={onDownloadPdf}>
                {downloadingPdf ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลด PDF'}
              </Button>}
              <Button size="sm" className="flex-1 text-white font-bold" style={{ background: theme.hex600 }} onClick={onDone}>
                เสร็จสิ้น
              </Button>
            </>
          ) : step === 'scan' ? (
            <DialogClose asChild><Button variant="outline" size="sm">ยกเลิก</Button></DialogClose>
          ) : (
            <>
              <Button
                size="sm"
                className="flex-1 text-white font-bold"
                disabled={
                  (!!onCustomExitTimeChange && !customExitTime) ||
                  (paymentMethod === 'cash' && cashReceived !== '' && change < 0)
                }
                style={paymentMethod === 'qr' ? { background: '#7C3AED' } : { background: theme.hex600 }}
                onClick={() => onConfirm(paymentMethod, selectedId || undefined, dailySelectedId || undefined, isLostCard, selectedFineId || undefined)}
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
