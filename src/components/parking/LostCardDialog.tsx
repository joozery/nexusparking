'use client'

import { useState } from 'react'
import { AlertTriangle, ShieldAlert, Banknote, Car, Bike } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogBody, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { calcFeeFromMinutes } from '@/lib/calcFee'

const LOST_FINE = 300

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (plate: string, estimatedHours: number, cardType: 'car' | 'motorcycle') => void
}

export function LostCardDialog({ open, onOpenChange, onConfirm }: Props) {
  const [plate,    setPlate]    = useState('')
  const [hours,    setHours]    = useState(2)
  const [cardType, setCardType] = useState<'car' | 'motorcycle'>('car')

  const parkingFee = calcFeeFromMinutes(cardType, hours * 60)
  const totalFee   = parkingFee + LOST_FINE

  function handleClose(o: boolean) {
    if (!o) { setPlate(''); setHours(2); setCardType('car') }
    onOpenChange(o)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm" showCloseButton>

        <DialogHeader className="bg-gradient-to-r from-amber-500 to-amber-400">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-white/25 shrink-0">
              <AlertTriangle className="size-4 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white text-sm">ทำบัตรจอดรถหาย</DialogTitle>
              <DialogDescription className="text-amber-100 text-xs mt-0">
                ค่าปรับ {LOST_FINE} ฿ + ค่าจอดตามเวลาจริง
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-3 py-3">

          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
            <ShieldAlert className="size-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-800 mb-1">ขั้นตอนกรณีบัตรหาย</p>
              <ol className="list-decimal list-inside space-y-0.5 text-amber-700 text-[10px]">
                <li>สอบถามเวลาเข้าโดยประมาณจากลูกค้า</li>
                <li>คำนวณค่าบริการตามเวลาที่แจ้ง</li>
                <li>เก็บค่าปรับบัตรหาย 300 บาท</li>
                <li>แจ้งหัวหน้าทราบและบันทึกเหตุการณ์</li>
              </ol>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="lost-plate" className="text-xs">ทะเบียน 4 ตัวท้าย</Label>
              <Input
                id="lost-plate"
                placeholder="1234"
                value={plate}
                onChange={e => setPlate(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="text-base font-mono text-center tracking-[0.3em] h-9"
                maxLength={4}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lost-hours" className="text-xs">ชั่วโมง (โดยประมาณ)</Label>
              <Input
                id="lost-hours"
                type="number"
                value={hours}
                onChange={e => setHours(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                max="24"
                className="text-center text-base font-bold h-9"
              />
            </div>
          </div>

          {/* ประเภทยานพาหนะ */}
          <div className="space-y-1">
            <Label className="text-xs">ประเภทยานพาหนะ</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                { key: 'car',        label: 'รถยนต์',       icon: Car  },
                { key: 'motorcycle', label: 'มอเตอร์ไซค์', icon: Bike },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button key={key} type="button"
                  onClick={() => setCardType(key)}
                  className="flex items-center justify-center gap-2 h-9 rounded-lg text-xs font-bold transition-all"
                  style={cardType === key
                    ? { background: '#F59E0B', color: 'white', boxShadow: '0 1px 6px rgba(245,158,11,0.4)' }
                    : { background: '#FEF3C7', color: '#92400E', border: '1.5px solid #FDE68A' }
                  }>
                  <Icon className="size-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Fee summary — คำนวณ dynamic */}
          <div className="rounded-lg border border-amber-200 overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-amber-200">
              <div className="py-2 px-3 bg-amber-50 text-center">
                <p className="text-[10px] text-amber-600 font-medium">ค่าจอดรถ ({hours} ชม.)</p>
                <p className="text-base font-black text-amber-800">฿{parkingFee}</p>
              </div>
              <div className="py-2 px-3 bg-amber-50 text-center">
                <p className="text-[10px] text-amber-600 font-medium">ค่าปรับบัตรหาย</p>
                <p className="text-base font-black text-amber-800">฿{LOST_FINE}</p>
              </div>
            </div>
            <div className="bg-amber-500 px-4 py-2 flex justify-between items-center">
              <span className="text-amber-100 text-xs font-semibold">ยอดรวมทั้งสิ้น</span>
              <span className="text-lg font-black text-white">฿{totalFee}</span>
            </div>
          </div>

        </DialogBody>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">ยกเลิก</Button>
          </DialogClose>
          <Button
            size="sm"
            className="bg-amber-500 hover:bg-amber-600 text-white flex-1"
            disabled={plate.length !== 4}
            onClick={() => onConfirm(plate, hours, cardType)}
          >
            <Banknote className="size-3.5" />
            เก็บเงิน ฿{totalFee} — เปิดลิ้นชัก
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  )
}
