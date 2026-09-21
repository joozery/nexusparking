'use client'

import { useRef, useEffect } from 'react'
import { CreditCard, LogIn, CheckCircle2, Car, Bike, Moon, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogBody, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { CardBadge } from './CardBadge'
import { type CardType, cardMeta } from './types'
import { toAsciiPlate } from '@/lib/thaiInput'

const icons = { car: Car, motorcycle: Bike, overnight: Moon }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  step: 'scan' | 'confirm'
  cardType: CardType
  plate: string
  duplicateSessions?: { _id: string; cardUid: string; entryTime: string }[]
  customEntryTime?: string
  onSimulateScan?: () => void
  onSelectType: (type: CardType) => void
  onPlateChange: (plate: string) => void
  onCustomEntryTimeChange?: (v: string) => void
  onBack: () => void
  onConfirm: () => void
}

export function CheckInDialog({
  open, onOpenChange, step, cardType, plate, duplicateSessions = [],
  customEntryTime, onCustomEntryTimeChange,
  onSimulateScan, onSelectType, onPlateChange, onBack, onConfirm,
}: Props) {
  const plateRef = useRef<HTMLInputElement>(null)
  const isMoto = cardType === 'motorcycle'
  const theme = {
    header: isMoto ? 'from-sky-600 to-sky-500' : 'from-yellow-600 to-yellow-500',
    description: isMoto ? 'text-sky-100' : 'text-yellow-100',
    scan: isMoto ? 'border-sky-200 bg-sky-50 hover:bg-sky-100 hover:border-sky-400' : 'border-yellow-200 bg-yellow-50 hover:bg-yellow-100 hover:border-yellow-400',
    icon: isMoto ? 'bg-sky-600 shadow-sky-500/30' : 'bg-yellow-600 shadow-yellow-500/30',
    title: isMoto ? 'text-sky-800' : 'text-yellow-800',
    text: isMoto ? 'text-sky-700' : 'text-yellow-700',
    hint: isMoto ? 'text-sky-400 border-sky-200' : 'text-yellow-400 border-yellow-200',
    button: isMoto ? 'bg-sky-600 hover:bg-sky-700' : 'bg-yellow-600 hover:bg-yellow-700',
  }

  // Focus plate input whenever we land on the confirm step (card tap or simulate)
  useEffect(() => {
    if (open && step === 'confirm') {
      const t = setTimeout(() => plateRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [open, step])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-3xl max-h-[90vh] overflow-y-auto"
        showCloseButton
        onOpenAutoFocus={e => {
          // Prevent Radix from picking an arbitrary first element;
          // we handle focus ourselves via the useEffect above.
          e.preventDefault()
        }}
      >

        <DialogHeader className={`bg-gradient-to-r ${theme.header}`}>
          <div className="flex items-center gap-4 px-6 py-5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-black/10 shrink-0">
              <LogIn className="size-4 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white text-lg">ขาเข้า</DialogTitle>
              <DialogDescription className={`${theme.description} text-base mt-0`}>แตะบัตรที่เครื่องอ่าน แล้วกรอกทะเบียน</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-5 px-6 py-6">
          {step === 'confirm' && duplicateSessions.length > 0 && <div className="rounded-lg bg-amber-50 p-2 text-base text-amber-900">
            <p className="font-bold">ทะเบียนนี้อยู่ในลานแล้ว {duplicateSessions.length} คัน — ตรวจว่าเป็นรถอีกคันก่อนยืนยัน</p>
            <div className="max-h-40 overflow-y-auto">
              {duplicateSessions.map(s => <div key={s._id} className="flex gap-2 mt-2">
                <img src={`/api/sessions/${s._id}/photo?type=cam-plate`} alt="ภาพตอนเข้า (หากมี)" className="w-20 h-14 object-contain" />
                <span>บัตร {s.cardUid}<br />เข้า {new Date(s.entryTime).toLocaleString('th-TH')}</span>
              </div>)}
            </div>
          </div>}
          {step === 'scan' ? (
            <div className="flex flex-col items-center gap-3">
              <div
                onClick={onSimulateScan}
                className={`w-full cursor-pointer flex flex-col items-center gap-2 p-5 rounded-lg border-2 border-dashed ${theme.scan} transition-all active:scale-[0.98]`}
              >
                <div className={`flex size-12 items-center justify-center rounded-lg shadow-md ${theme.icon} animate-pulse`}>
                  <CreditCard className="size-6 text-white" />
                </div>
                <div className="text-center">
                  <p className={`text-lg font-bold ${theme.title}`}>รอการสแกนบัตร...</p>
                  <p className={`text-base ${theme.text} mt-0.5`}>แตะบัตรที่เครื่องอ่านบัตร (Card Reader)</p>
                  {onSimulateScan && <p className={`text-sm ${theme.hint} mt-1.5 border px-2 py-0.5 rounded-full bg-white/60 inline-block`}>คลิกจำลองการสแกน</p>}
                </div>
              </div>

              <div className="w-full grid grid-cols-2 gap-2">
                {(['car', 'motorcycle'] as CardType[]).map((t) => {
                  const m = cardMeta[t]
                  const Icon = icons[t]
                  return (
                    <button key={t} onClick={() => onSelectType(t)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all hover:border-current ${m.bg} ${m.color}`}>
                      <Icon className="size-4" />
                      <span className="text-sm font-bold">{m.label}</span>
                    </button>
                  )
                })}
              </div>
              <p className="text-sm text-slate-400">หรือเลือกประเภทบัตรด้านบน</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-base text-slate-600 font-medium">ประเภทบัตร</span>
                <span className="[&>span]:text-base"><CardBadge type={cardType} /></span>
              </div>

              <div className="space-y-1">
                <Label htmlFor="plate-in" className="text-base">เลขทะเบียน 4 หลัก</Label>
                <Input
                  ref={plateRef}
                  id="plate-in"
                  placeholder="1234"
                  maxLength={4}
                  value={plate}
                  onChange={(e) => onPlateChange(toAsciiPlate(e.target.value))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && plate.length === 4) onConfirm() }}
                  className="text-3xl font-mono text-center tracking-[0.4em] h-14"
                />
                <p className="text-sm text-slate-400">กรอกเฉพาะตัวเลข 4 หลักท้าย</p>
              </div>

              {/* Custom entry time */}
              {onCustomEntryTimeChange && (
                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-left"
                    style={{ background: customEntryTime ? 'rgba(109,40,217,0.05)' : '#FAFBFF' }}
                    onClick={() => onCustomEntryTimeChange(customEntryTime ? '' : new Date().toISOString().slice(0, 19))}
                  >
                    <Clock className="size-3.5 shrink-0" style={{ color: customEntryTime ? '#6D28D9' : '#94A3B8' }} />
                    <span className="text-sm font-bold flex-1" style={{ color: customEntryTime ? '#6D28D9' : '#94A3B8' }}>
                      {customEntryTime ? 'กำหนดเวลาเข้าเอง' : 'ใช้เวลาจริง (คลิกเพื่อกำหนดเอง)'}
                    </span>
                    {customEntryTime && (
                      <span className="text-sm font-black px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(109,40,217,0.1)', color: '#6D28D9' }}>SIM</span>
                    )}
                  </button>
                  {customEntryTime && (
                    <div className="px-3 pb-2.5 pt-1" style={{ background: 'rgba(109,40,217,0.03)' }}>
                      <label className="text-sm font-black text-slate-400 uppercase block mb-1">วัน-เวลาเข้า (วินาทีได้)</label>
                      <input type="datetime-local" step="1" value={customEntryTime}
                        onChange={e => onCustomEntryTimeChange(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg text-base text-slate-800 outline-none"
                        style={{ border: '1.5px solid rgba(109,40,217,0.3)', background: 'white' }}
                        onFocus={e => e.currentTarget.style.borderColor = '#6D28D9'}
                        onBlur={e => e.currentTarget.style.borderColor = 'rgba(109,40,217,0.3)'} />
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                <p className="text-sm text-emerald-700 font-medium">เมื่อยืนยัน: กล้องถ่ายภาพ + ไม้กั้นเปิดอัตโนมัติ</p>
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          {step === 'scan' ? (
            <DialogClose asChild>
              <Button variant="outline" size="sm" className="h-12 text-base">ยกเลิก</Button>
            </DialogClose>
          ) : (
            <>
              <Button variant="outline" size="sm" className="h-12 text-base" onClick={onBack}>← ย้อนกลับ</Button>
              <Button
                size="sm"
                className={`${theme.button} text-white flex-1 h-12 text-base`}
                disabled={plate.length !== 4}
                onClick={onConfirm}
              >
                <LogIn className="size-3.5" />
                ยืนยัน — เปิดไม้กั้น
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
