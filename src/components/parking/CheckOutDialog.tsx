'use client'

import { CreditCard, LogOut, Clock, ReceiptText, Banknote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogBody, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { CardBadge } from './CardBadge'
import { type CardType } from './types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  step: 'scan' | 'payment'
  cardType: CardType
  hours: number
  fee: number
  onSimulateScan: () => void
  onBack: () => void
  onConfirm: () => void
}

export function CheckOutDialog({
  open, onOpenChange, step, cardType, hours, fee,
  onSimulateScan, onBack, onConfirm,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" showCloseButton>

        <DialogHeader className="bg-gradient-to-r from-emerald-600 to-emerald-500">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-white/20 shrink-0">
              <LogOut className="size-4 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white text-sm">รถออก — Check Out</DialogTitle>
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
                    <div className="flex justify-between text-xs text-slate-600"><span>ค้างคืนเหมาจ่าย (18:00–07:00)</span><span>฿100</span></div>
                  )}
                </div>
                <div className="bg-emerald-600 px-3 py-2.5 flex items-center justify-between">
                  <span className="text-emerald-100 text-xs font-semibold">ยอดชำระทั้งสิ้น</span>
                  <span className="text-xl font-black text-white tabular-nums">฿{fee}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
                <ReceiptText className="size-3.5 text-blue-600 shrink-0" />
                <p className="text-[10px] text-blue-700 font-medium">ลิ้นชักเงินเปิด + ไม้กั้นเปิด + กล้องถ่ายภาพอัตโนมัติ</p>
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
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1" onClick={onConfirm}>
                <Banknote className="size-3.5" />
                รับเงิน ฿{fee} — เปิดลิ้นชัก
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
