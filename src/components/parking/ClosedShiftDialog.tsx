'use client'
import { useState } from 'react'
import { vehicleCountLines, type ShiftVehicleCounts } from '@/lib/shiftVehicleCounts'
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
  async function issue(pdf: boolean) {
    if (busy) return
    setBusy(true); setMessage('')
    try {
      if (pdf) {
        const { jsPDF } = await import('jspdf')
        await document.fonts.ready
        const logo = new Image(); logo.src = '/logo/receipt-logo.png'; await logo.decode()
        const date = (v: string) => new Date(v).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
        const lines = opening ? ['ใบเปิดกะทำงาน', `พนักงาน ${shift.operatorName}`, `เปิดกะ ${date(shift.startTime)}`,
          `รถค้างจากกะก่อน ${shift.carryoverCars ?? 0} คัน`, ...vehicleCountLines("ค้าง", shift.carryoverByType), `เงินต้นกะ ${shift.openingFloat.toLocaleString('th-TH')} บาท`,
          ...Object.entries(shift.openingBreakdown ?? {}).filter(([, n]) => n > 0).sort((a, b) => Number(b[0]) - Number(a[0])).map(([d, n]) => `${Number(d).toLocaleString('th-TH')} บาท × ${n} = ${(Number(d) * n).toLocaleString('th-TH')} บาท`),
          'ผู้รับเงิน __________________'] : ['ใบปิดกะทำงาน', `พนักงาน ${shift.operatorName}`, `เปิดกะ ${date(shift.startTime)}`, `ปิดกะ ${date(shift.endTime)}`,
          `รถเข้า ${shift.checkinsCount} คัน`, `รถออก ${shift.checkoutsCount} คัน`, `รถค้างในลาน ${shift.closingCarCount} คัน`,
          ...vehicleCountLines("เข้า", shift.checkinsByType), ...vehicleCountLines("ออก", shift.checkoutsByType), ...vehicleCountLines("ค้าง", shift.closingByType),
          `เงินต้นกะ ${shift.openingFloat.toLocaleString('th-TH')} บาท`, `เงินส่งคืน ${shift.closingFloat.toLocaleString('th-TH')} บาท`,
          ...Object.entries(shift.closingBreakdown ?? {}).filter(([, n]) => n > 0).sort((a, b) => Number(b[0]) - Number(a[0])).map(([d, n]) => `${Number(d).toLocaleString('th-TH')} บาท × ${n} = ${(Number(d) * n).toLocaleString('th-TH')} บาท`),
          'ผู้ส่งเงิน __________________', 'ผู้รับเงิน __________________']
        const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 1500
        const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('สร้าง PDF ไม่สำเร็จ')
        ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height)
        const logoWidth = 400
        const logoHeight = logoWidth * logo.naturalHeight / logo.naturalWidth
        ctx.drawImage(logo, (canvas.width - logoWidth) / 2, 25, logoWidth, logoHeight)
        ctx.fillStyle = '#111'; ctx.textAlign = 'center'
        const textTop = 25 + logoHeight + 30
        const rowHeight = (canvas.height - 45 - textTop) / lines.length
        const fontSize = Math.min(48, Math.floor(rowHeight * 0.72))
        ctx.textBaseline = 'middle'
        lines.forEach((line, i) => {
          ctx.font = `${i === 0 ? 'bold ' : ''}${fontSize}px sans-serif`
          ctx.fillText(line, 600, textTop + (i + 0.5) * rowHeight, 1080)
        })
        const doc = new jsPDF({ unit: 'mm', format: [80, 100] })
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 80, 100)
        doc.save(`shift-${opening ? 'open' : 'close'}-${shift._id}.pdf`)
      } else {
        const res = await fetch(`/api/shifts/${shift._id}/print?kind=${opening ? 'open' : 'close'}`, { method: 'POST' })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.success) throw new Error(data?.error ?? 'พิมพ์ไม่สำเร็จ กรุณาตรวจเครื่องพิมพ์')
        setMessage(`พิมพ์${title}แล้ว`)
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'ดำเนินการไม่สำเร็จ') }
    finally { setBusy(false) }
  }
  return <Dialog open><DialogContent showCloseButton={false} onEscapeKeyDown={e => e.preventDefault()} onInteractOutside={e => e.preventDefault()}>
    <DialogHeader><DialogTitle className="px-5 pt-5">{opening ? 'เปิดกะเรียบร้อย' : 'ปิดกะเรียบร้อย'} — {title}</DialogTitle></DialogHeader>
    <DialogBody className="space-y-4 pt-4">
      <p>{shift.operatorName}</p><p>{opening ? 'เงินต้นกะ' : 'เงินส่งคืน'} ฿{(opening ? shift.openingFloat : shift.closingFloat).toLocaleString('th-TH')}</p>
      <ShiftVehicleSummary incoming={shift.checkinsByType} outgoing={shift.checkoutsByType} remaining={opening ? shift.carryoverByType : shift.closingByType} opening={opening} />
      <p className="text-sm text-slate-500">ดาวน์โหลด{title} หรือพิมพ์ซ้ำได้</p>
      {message && <p role="status">{message}</p>}
      <div className="flex gap-2"><button disabled={busy} className="rounded-lg border p-3 disabled:opacity-40" onClick={() => issue(false)}>พิมพ์{title}</button><button disabled={busy} className="rounded-lg border p-3 disabled:opacity-40" onClick={() => issue(true)}>ดาวน์โหลด PDF</button></div>
      <button disabled={busy} className={`w-full rounded-lg ${opening ? 'bg-emerald-600' : 'bg-red-600'} p-3 font-bold text-white disabled:opacity-40`} onClick={onLogout}>{opening ? 'เริ่มทำงาน' : 'เสร็จสิ้น / ออกจากระบบ'}</button>
    </DialogBody>
  </DialogContent></Dialog>
}
