'use client'
import { useState } from 'react'
import { type ShiftVehicleCounts } from '@/lib/shiftVehicleCounts'
import { ShiftVehicleSummary } from './ShiftVehicleSummary'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog'

export interface ClosedShift extends ShiftVehicleCounts {
  _id: string; operatorName: string; startTime: string; endTime: string
  checkinsCount: number; checkoutsCount: number; closingCarCount: number
  openingFloat: number; closingFloat: number
  closingBreakdown: Record<string, number>
  openingBreakdown?: Record<string, number>
  carryoverCars?: number
}

export function ClosedShiftDialog({ shift, onLogout, opening = false }: { shift: ClosedShift; onLogout: () => void; opening?: boolean }) {
  const title = opening ? 'ใบเปิดกะ' : 'ใบปิดกะ'
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function issue() {
    if (busy) return
    setBusy(true); setMessage('')
    try {

        const res = await fetch(`/api/shifts/${shift._id}/print?kind=${opening ? 'open' : 'close'}`, { method: 'POST' })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.success) throw new Error(data?.error ?? 'พิมพ์ไม่สำเร็จ กรุณาตรวจเครื่องพิมพ์')
        setMessage(`พิมพ์${title}แล้ว`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'ดำเนินการไม่สำเร็จ') }
    finally { setBusy(false) }
  }
  return <Dialog open><DialogContent showCloseButton={false} onEscapeKeyDown={e => e.preventDefault()} onInteractOutside={e => e.preventDefault()}>
    <DialogHeader><DialogTitle className="px-5 pt-5">{opening ? 'เปิดกะเรียบร้อย' : 'ปิดกะเรียบร้อย'} — {title}</DialogTitle></DialogHeader>
    <DialogBody className="space-y-4 pt-4">
      <p>{shift.operatorName}</p><p>{opening ? 'เงินต้นกะ' : 'เงินส่งคืน'} ฿{(opening ? shift.openingFloat : shift.closingFloat).toLocaleString('th-TH')}</p>
      <ShiftVehicleSummary incoming={shift.checkinsByType} outgoing={shift.checkoutsByType} remaining={opening ? shift.carryoverByType : shift.closingByType} opening={opening} />
      <p className="text-sm text-slate-500">พิมพ์{title}ซ้ำได้</p>
      {message && <p role="status">{message}</p>}
      <div className="flex gap-2"><button disabled={busy} className="rounded-lg border p-3 disabled:opacity-40" onClick={() => issue()}>พิมพ์{title}</button></div>
      <button disabled={busy} className={`w-full rounded-lg ${opening ? 'bg-emerald-600' : 'bg-red-600'} p-3 font-bold text-white disabled:opacity-40`} onClick={onLogout}>{opening ? 'เริ่มทำงาน' : 'เสร็จสิ้น / ออกจากระบบ'}</button>
    </DialogBody>
  </DialogContent></Dialog>
}
