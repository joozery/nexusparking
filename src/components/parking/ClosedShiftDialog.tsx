'use client'
import { useState } from 'react'
import { type ShiftVehicleCounts } from '@/lib/shiftVehicleCounts'
import { downloadShiftPdf } from '@/lib/shiftPdf'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog'

export interface ClosedShift extends ShiftVehicleCounts {
  _id: string; operatorName: string; startTime: string; endTime: string
  checkinsCount: number; checkoutsCount: number; closingCarCount: number
  openingFloat: number; closingFloat: number
  closingBreakdown: Record<string, number>
  openingBreakdown?: Record<string, number>
  carryoverCars?: number
  carryoverByBilling?: { carNormal: number; carOvernight: number; motorcycleNormal: number; motorcycleOvernight: number }
  closingByBilling?: { carNormal: number; carOvernight: number; motorcycleNormal: number; motorcycleOvernight: number }
  openingCardsByType?: { car: number; motorcycle: number }
  closingCardsByType?: { car: number; motorcycle: number }
}

export function ClosedShiftDialog({ shift, onLogout, opening = false }: { shift: ClosedShift; onLogout: () => void; opening?: boolean }) {
  const title = opening ? 'ใบเปิดกะ' : 'ใบปิดกะ'
  const [busy, setBusy] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
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
  async function downloadPdf() {
    if (pdfBusy) return
    setPdfBusy(true); setMessage('')
    try {
      await downloadShiftPdf(shift, opening)
      setMessage(`ดาวน์โหลด${title} PDF แล้ว`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'สร้าง PDF ไม่สำเร็จ')
    } finally { setPdfBusy(false) }
  }
  const money = (value: number) => value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const openingDenominations = Object.entries(shift.openingBreakdown ?? {})
    .filter(([, count]) => Number(count) > 0)
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([denom, count]) => {
      const unit = Number(denom)
      const quantity = Number(count)
      return {
        left: `${unit.toLocaleString('th-TH')}*${quantity.toLocaleString('th-TH')}`,
        total: (unit * quantity).toLocaleString('th-TH'),
      }
    })
  const closingDenominations = Object.entries(shift.closingBreakdown ?? {})
    .filter(([, count]) => Number(count) > 0)
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([denom, count]) => {
      const unit = Number(denom)
      const quantity = Number(count)
      return {
        left: `${unit.toLocaleString('th-TH')}*${quantity.toLocaleString('th-TH')}`,
        total: (unit * quantity).toLocaleString('th-TH'),
      }
    })
  return <Dialog open><DialogContent className="max-w-2xl max-h-[96vh]" showCloseButton={false} onEscapeKeyDown={e => e.preventDefault()} onInteractOutside={e => e.preventDefault()}>
    <DialogHeader><DialogTitle className="px-5 pt-3">{opening ? 'เปิดกะเรียบร้อย' : 'ปิดกะเรียบร้อย'} — {title}</DialogTitle></DialogHeader>
    <DialogBody className="space-y-2 overflow-visible px-4 pb-2 pt-2">
      {opening ? <>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-500">พนักงาน</span>
            <strong className="text-right text-base text-slate-900">{shift.operatorName}</strong>
          </div>
          <div className="mt-1 flex items-center justify-between gap-4">
            <span className="text-sm text-slate-500">เวลาเปิดกะ</span>
            <strong className="text-right text-sm text-slate-900">{new Date(shift.startTime).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</strong>
          </div>
        </div>

        <section className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">เงินต้นกะ</h3>
            <strong className="text-base text-amber-800">฿{money(shift.openingFloat)}</strong>
          </div>
          <div className="my-1.5 border-t border-dashed border-amber-300" />
          <h4 className="mb-1 font-bold text-slate-800">รายละเอียด</h4>
          {openingDenominations.length ? <div className="space-y-0.5 font-mono text-xs sm:text-sm">
            {openingDenominations.map(row => <div key={`${row.left}-${row.total}`} className="grid grid-cols-[1fr_auto_1fr] gap-2">
              <span>{row.left}</span><span>=</span><span className="text-right">{row.total}</span>
            </div>)}
          </div> : <p className="text-sm text-slate-500">ไม่ได้ระบุรายละเอียดเงิน</p>}
        </section>

        <div className="grid grid-cols-2 gap-2">
          <section className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
            <h3 className="mb-2 font-bold leading-tight text-sm text-slate-900">จำนวนรถค้างในลาน</h3>
            <div className="space-y-1 text-xs sm:text-sm">
              <div className="flex justify-between gap-2"><span>รถยนต์</span><strong>{shift.carryoverByBilling?.carNormal ?? shift.carryoverByType?.car ?? 0} คัน</strong></div>
              <div className="flex justify-between gap-2"><span>ค้างคืนรถยนต์</span><strong>{shift.carryoverByBilling?.carOvernight ?? 0} คัน</strong></div>
              <div className="flex justify-between gap-2"><span>รถจักรยานยนต์</span><strong>{shift.carryoverByBilling?.motorcycleNormal ?? shift.carryoverByType?.motorcycle ?? 0} คัน</strong></div>
              <div className="flex justify-between gap-2"><span>ค้างคืนรถจักรยานยนต์</span><strong>{shift.carryoverByBilling?.motorcycleOvernight ?? 0} คัน</strong></div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
            <h3 className="mb-2 font-bold leading-tight text-sm text-slate-900">จำนวนบัตรจอดรถคงเหลือ</h3>
            <div className="space-y-1 text-xs sm:text-sm">
              <div className="flex justify-between gap-2"><span>รถยนต์</span><strong>{shift.openingCardsByType?.car ?? 0} ใบ</strong></div>
              <div className="flex justify-between gap-2"><span>รถจักรยานยนต์</span><strong>{shift.openingCardsByType?.motorcycle ?? 0} ใบ</strong></div>
            </div>
          </section>
        </div>
      </> : <>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-500">พนักงาน</span>
            <strong className="text-right text-base text-slate-900">{shift.operatorName}</strong>
          </div>
          <div className="mt-1 flex items-center justify-between gap-4">
            <span className="text-sm text-slate-500">เวลาเปิดกะ</span>
            <strong className="text-right text-sm text-slate-900">{new Date(shift.startTime).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</strong>
          </div>
          <div className="mt-2 flex items-center justify-between gap-4">
            <span className="text-sm text-slate-500">เวลาปิดกะ</span>
            <strong className="text-right text-sm text-slate-900">{new Date(shift.endTime).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</strong>
          </div>
        </div>

        <section className="rounded-xl border border-red-200 bg-red-50/70 px-3 py-2">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">เงินส่งคืน</h3>
            <strong className="text-base text-red-800">฿{money(shift.closingFloat)}</strong>
          </div>
          <div className="my-1.5 border-t border-dashed border-red-300" />
          <h4 className="mb-1 font-bold text-slate-800">รายละเอียด</h4>
          {closingDenominations.length ? <div className="space-y-0.5 font-mono text-xs sm:text-sm">
            {closingDenominations.map(row => <div key={`${row.left}-${row.total}`} className="grid grid-cols-[1fr_auto_1fr] gap-2">
              <span>{row.left}</span><span>=</span><span className="text-right">{row.total}</span>
            </div>)}
          </div> : <p className="text-sm text-slate-500">ไม่ได้ระบุรายละเอียดเงิน</p>}
        </section>

        <div className="grid grid-cols-2 gap-2">
          <section className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
            <h3 className="mb-2 font-bold leading-tight text-sm text-slate-900">จำนวนรถยนต์ค้างในลาน</h3>
            <div className="space-y-1 text-xs sm:text-sm">
              <div className="flex justify-between gap-2"><span>รถยนต์</span><strong>{shift.closingByBilling?.carNormal ?? shift.closingByType?.car ?? 0} คัน</strong></div>
              <div className="flex justify-between gap-2"><span>ค้างคืนรถยนต์</span><strong>{shift.closingByBilling?.carOvernight ?? 0} คัน</strong></div>
              <div className="flex justify-between gap-2"><span>รถจักรยานยนต์</span><strong>{shift.closingByBilling?.motorcycleNormal ?? shift.closingByType?.motorcycle ?? 0} คัน</strong></div>
              <div className="flex justify-between gap-2"><span>ค้างคืนรถจักรยานยนต์</span><strong>{shift.closingByBilling?.motorcycleOvernight ?? 0} คัน</strong></div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
            <h3 className="mb-2 font-bold leading-tight text-sm text-slate-900">จำนวนบัตรจอดรถคงเหลือ</h3>
            <div className="space-y-1 text-xs sm:text-sm">
              <div className="flex justify-between gap-2"><span>รถยนต์</span><strong>{shift.closingCardsByType?.car ?? 0} ใบ</strong></div>
              <div className="flex justify-between gap-2"><span>รถจักรยานยนต์</span><strong>{shift.closingCardsByType?.motorcycle ?? 0} ใบ</strong></div>
            </div>
          </section>
        </div>
      </>}
      <p className="text-xs text-slate-500">พิมพ์{title}ซ้ำได้</p>
      {message && <p role="status">{message}</p>}
      <div className="flex flex-wrap gap-2">
        <button disabled={busy || pdfBusy} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40" onClick={() => issue()}>พิมพ์{title}</button>
        <button disabled={busy || pdfBusy} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 disabled:opacity-40" onClick={() => downloadPdf()}>{pdfBusy ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลด PDF'}</button>
      </div>
      <button disabled={busy} className={`w-full rounded-lg ${opening ? 'bg-emerald-600' : 'bg-red-600'} px-3 py-2 font-bold text-white disabled:opacity-40`} onClick={onLogout}>{opening ? 'เริ่มทำงาน' : 'เสร็จสิ้น / ออกจากระบบ'}</button>
    </DialogBody>
  </DialogContent></Dialog>
}
