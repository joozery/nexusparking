'use client'

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

const icons = { car: Car, motorcycle: Bike, overnight: Moon }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  step: 'scan' | 'confirm'
  cardType: CardType
  plate: string
  customEntryTime?: string
  onSimulateScan: () => void
  onSelectType: (type: CardType) => void
  onPlateChange: (plate: string) => void
  onCustomEntryTimeChange?: (v: string) => void
  onBack: () => void
  onConfirm: () => void
}

export function CheckInDialog({
  open, onOpenChange, step, cardType, plate,
  customEntryTime, onCustomEntryTimeChange,
  onSimulateScan, onSelectType, onPlateChange, onBack, onConfirm,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" showCloseButton>

        <DialogHeader className="bg-gradient-to-r from-blue-600 to-blue-500">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-white/20 shrink-0">
              <LogIn className="size-4 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white text-sm">รถเข้า — Check In</DialogTitle>
              <DialogDescription className="text-blue-100 text-xs mt-0">แตะบัตรที่เครื่องอ่าน แล้วกรอกทะเบียน</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-3 py-3">
          {step === 'scan' ? (
            <div className="flex flex-col items-center gap-3">
              <div
                onClick={onSimulateScan}
                className="w-full cursor-pointer flex flex-col items-center gap-2 p-5 rounded-lg border-2 border-dashed border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 transition-all active:scale-[0.98]"
              >
                <div className="flex size-12 items-center justify-center rounded-lg bg-blue-600 shadow-md shadow-blue-500/30 animate-pulse">
                  <CreditCard className="size-6 text-white" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-blue-800">รอการสแกนบัตร...</p>
                  <p className="text-xs text-blue-500 mt-0.5">แตะบัตรที่เครื่องอ่านบัตร (Card Reader)</p>
                  <p className="text-[10px] text-blue-400 mt-1.5 border border-blue-200 px-2 py-0.5 rounded-full bg-white/60 inline-block">คลิกจำลองการสแกน</p>
                </div>
              </div>

              <div className="w-full grid grid-cols-3 gap-2">
                {(['car', 'motorcycle', 'overnight'] as CardType[]).map((t) => {
                  const m = cardMeta[t]
                  const Icon = icons[t]
                  return (
                    <button key={t} onClick={() => onSelectType(t)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all hover:border-current ${m.bg} ${m.color}`}>
                      <Icon className="size-4" />
                      <span className="text-[10px] font-bold">{m.label}</span>
                    </button>
                  )
                })}
              </div>
              <p className="text-[10px] text-slate-400">หรือเลือกประเภทบัตรด้านบน</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-xs text-slate-600 font-medium">ประเภทบัตร</span>
                <CardBadge type={cardType} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="plate-in" className="text-xs">เลขทะเบียน 4 ตัวท้าย</Label>
                <Input
                  id="plate-in"
                  placeholder="เช่น 1234"
                  maxLength={4}
                  value={plate}
                  onChange={(e) => onPlateChange(e.target.value.replace(/\D/g, ''))}
                  className="text-xl font-mono text-center tracking-[0.4em] h-10"
                />
                <p className="text-[10px] text-slate-400">กรอกเฉพาะตัวเลข 4 หลักท้าย</p>
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
                    <span className="text-[10px] font-bold flex-1" style={{ color: customEntryTime ? '#6D28D9' : '#94A3B8' }}>
                      {customEntryTime ? 'กำหนดเวลาเข้าเอง' : 'ใช้เวลาจริง (คลิกเพื่อกำหนดเอง)'}
                    </span>
                    {customEntryTime && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(109,40,217,0.1)', color: '#6D28D9' }}>SIM</span>
                    )}
                  </button>
                  {customEntryTime && (
                    <div className="px-3 pb-2.5 pt-1" style={{ background: 'rgba(109,40,217,0.03)' }}>
                      <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">วัน-เวลาเข้า (วินาทีได้)</label>
                      <input type="datetime-local" step="1" value={customEntryTime}
                        onChange={e => onCustomEntryTimeChange(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg text-xs text-slate-800 outline-none"
                        style={{ border: '1.5px solid rgba(109,40,217,0.3)', background: 'white' }}
                        onFocus={e => e.currentTarget.style.borderColor = '#6D28D9'}
                        onBlur={e => e.currentTarget.style.borderColor = 'rgba(109,40,217,0.3)'} />
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                <p className="text-[10px] text-emerald-700 font-medium">เมื่อยืนยัน: กล้องถ่ายภาพ + ไม้กั้นเปิดอัตโนมัติ</p>
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          {step === 'scan' ? (
            <DialogClose asChild>
              <Button variant="outline" size="sm">ยกเลิก</Button>
            </DialogClose>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={onBack}>← ย้อนกลับ</Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
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
