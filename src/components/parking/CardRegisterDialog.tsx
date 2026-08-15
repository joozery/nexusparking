'use client'

import { useState } from 'react'
import { CreditCard, Car, Bike, Moon, UserRound, Hash, CalendarDays, Banknote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogBody, DialogFooter,
} from '@/components/ui/dialog'
import { type CardType } from './types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  uid: string
  monthlyDeposit?: number
  monthlyFee?: number
  onRegistered: (card: { uid: string; type: CardType; plate: string }) => void
}

const TYPE_OPTIONS: { value: CardType; label: string; icon: typeof Car; color: string; bg: string }[] = [
  { value: 'car',        label: 'รถยนต์',       icon: Car,  color: '#1D4ED8', bg: 'rgba(29,78,216,0.08)'  },
  { value: 'motorcycle', label: 'มอเตอร์ไซค์', icon: Bike, color: '#0891B2', bg: 'rgba(8,145,178,0.08)'  },
  { value: 'overnight',  label: 'ค้างคืน',     icon: Moon, color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
]

export function CardRegisterDialog({ open, onOpenChange, uid, monthlyDeposit = 500, monthlyFee = 300, onRegistered }: Props) {
  const [type,       setType]       = useState<CardType>('car')
  const [ownerName,  setOwnerName]  = useState('')
  const [plate,      setPlate]      = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [label,      setLabel]      = useState('')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  function reset() {
    setType('car'); setOwnerName(''); setPlate(''); setExpiryDate(''); setLabel(''); setError('')
  }

  async function handleSave() {
    if (!plate || plate.length < 2) { setError('กรุณากรอกเลขทะเบียน'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, type, label, ownerName, plate, expiryDate: expiryDate || null }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error ?? 'ลงทะเบียนไม่สำเร็จ')
        return
      }
      reset()
      onOpenChange(false)
      onRegistered({ uid, type, plate })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="sm:max-w-sm" showCloseButton onOpenAutoFocus={e => e.preventDefault()}>

        <DialogHeader style={{ background: 'linear-gradient(135deg,#4C1D95,#7C3AED)' }}>
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-white/20 shrink-0">
              <CreditCard className="size-4 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white text-sm">ลงทะเบียนบัตรใหม่</DialogTitle>
              <DialogDescription className="text-purple-200 text-xs mt-0">บัตรนี้ยังไม่มีในระบบ</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-3 py-3">

          {/* UID — read-only */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
            <Hash className="size-3.5 text-slate-400 shrink-0" />
            <span className="text-[10px] text-slate-400 font-medium shrink-0">UID</span>
            <span className="text-xs font-mono text-slate-700 truncate">{uid}</span>
          </div>

          {/* ประเภทบัตร */}
          <div className="space-y-1.5">
            <Label className="text-xs">ประเภทบัตร</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {TYPE_OPTIONS.map(({ value, label: lbl, icon: Icon, color, bg }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all text-[10px] font-bold"
                  style={type === value
                    ? { borderColor: color, color, background: bg }
                    : { borderColor: '#E2E8F0', color: '#94A3B8', background: 'white' }}
                >
                  <Icon className="size-4" />
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* ชื่อเจ้าของ */}
          <div className="space-y-1">
            <Label htmlFor="reg-owner" className="text-xs flex items-center gap-1">
              <UserRound className="size-3" /> ชื่อเจ้าของ
            </Label>
            <Input id="reg-owner" placeholder="เช่น สมชาย ใจดี" value={ownerName}
              onChange={e => setOwnerName(e.target.value)} className="h-9 text-sm" />
          </div>

          {/* เลขทะเบียน */}
          <div className="space-y-1">
            <Label htmlFor="reg-plate" className="text-xs">เลขทะเบียน 4 ตัวท้าย *</Label>
            <Input
              id="reg-plate"
              autoFocus
              placeholder="เช่น 1234"
              maxLength={4}
              value={plate}
              onChange={e => setPlate(e.target.value.replace(/[^0-9๐-๙]/g, '').replace(/[๐-๙]/g, c => String(c.codePointAt(0)! - 0x0E50)))}
              className="h-9 text-xl font-mono text-center tracking-[0.4em]"
            />
          </div>

          {/* ฉลาก */}
          <div className="space-y-1">
            <Label htmlFor="reg-label" className="text-xs">ฉลาก / หมายเหตุ</Label>
            <Input id="reg-label" placeholder="เช่น P1-23" value={label}
              onChange={e => setLabel(e.target.value)} className="h-9 text-sm" />
          </div>

          {/* วันหมดอายุ (รายเดือน) */}
          <div className="space-y-1">
            <Label htmlFor="reg-expiry" className="text-xs flex items-center gap-1">
              <CalendarDays className="size-3" /> วันหมดอายุ
              <span className="text-slate-400 font-normal">(ถ้าเป็นรายเดือน)</span>
            </Label>
            <Input id="reg-expiry" type="date" value={expiryDate}
              onChange={e => setExpiryDate(e.target.value)} className="h-9 text-sm" />
          </div>

          {/* ยอดเรียกเก็บ — แสดงเมื่อเป็นบัตรรายเดือน (มีวันหมดอายุ) */}
          {expiryDate && (
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(124,58,237,0.25)' }}>
              <div className="px-3 py-2 flex items-center gap-1.5" style={{ background: 'rgba(124,58,237,0.06)', borderBottom: '1px solid rgba(124,58,237,0.1)' }}>
                <Banknote className="size-3.5" style={{ color: '#7C3AED' }} />
                <span className="text-[10px] font-black text-purple-800">ยอดเรียกเก็บวันนี้</span>
              </div>
              <div className="px-3 py-2 space-y-1.5">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>ค่ามัดจำบัตร</span>
                  <span className="font-bold tabular-nums">฿{monthlyDeposit}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>ค่าบัตรรายเดือน</span>
                  <span className="font-bold tabular-nums">฿{monthlyFee}</span>
                </div>
                <div className="flex justify-between text-sm font-black pt-1 border-t border-dashed border-purple-100" style={{ color: '#7C3AED' }}>
                  <span>รวม</span>
                  <span className="tabular-nums">฿{monthlyDeposit + monthlyFee}</span>
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => { reset(); onOpenChange(false) }}>
            ยกเลิก
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
            onClick={handleSave}
            disabled={saving || plate.length < 2}
          >
            <CreditCard className="size-3.5" />
            {saving ? 'กำลังบันทึก...' : 'ลงทะเบียน'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
