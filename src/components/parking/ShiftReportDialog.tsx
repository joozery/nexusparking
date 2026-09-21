'use client'

import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody } from '@/components/ui/dialog'

interface Report {
  refunds?: { sessionId: string; plate: string; amount: number; paymentMethod: string; refundedAt: string }[]
  operatorName: string
  startTime: string
  count: number
  cash: number
  qr: number
  total: number
  sessions: { _id: string; plate: string; cardUid: string; cardType: 'car' | 'motorcycle' | 'overnight'; entryTime: string; exitTime: string; totalFee: number; paymentMethod: string }[]
}

export function ShiftReportDialog({ onClose }: { onClose: () => void }) {
  const { success, error: toastError } = useToast()
  const receiptBusy = useRef(false)
  const [receiptAction, setReceiptAction] = useState<string | null>(null)
  async function receipt(id: string) {
    if (receiptBusy.current) return
    receiptBusy.current = true
    setReceiptAction(id)
    try {
        const res = await fetch(`/api/sessions/${encodeURIComponent(id)}/print`, { method: 'POST' })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error ?? 'กรุณาตรวจสอบเครื่องพิมพ์')
        success('พิมพ์ใบเสร็จแล้ว')
    } catch (e) {
      toastError('พิมพ์ไม่สำเร็จ', e instanceof Error ? e.message : 'กรุณาลองใหม่')
    } finally {
      receiptBusy.current = false
      setReceiptAction(null)
    }
  }
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/shifts/current/report', { cache: 'no-store', signal: controller.signal })
      .then(async res => {
        const data = await res.json().catch(() => null)
        if (!res.ok || !data || !Array.isArray(data.sessions)) {
          throw new Error(data?.error ?? `โหลดรายงานไม่สำเร็จ (HTTP ${res.status}) กรุณาตรวจการเชื่อมต่อแล้วกดรีเฟรช`)
        }
        return data
      })
      .then(setReport)
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'โหลดรายงานไม่สำเร็จ') })
    return () => controller.abort()
  }, [version])
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>รายงานรถออกกะนี้ — F3</DialogTitle>
        <DialogDescription>{report ? `${report.operatorName} · เริ่มกะ ${new Date(report.startTime).toLocaleString('th-TH')}` : 'รายการรถออกที่บันทึกผูกกับกะปัจจุบัน'}</DialogDescription>
      </DialogHeader>
      <DialogBody className="overflow-y-auto space-y-4">
        <button className="rounded-lg border px-3 py-2 text-sm" onClick={() => { setReport(null); setError(''); setVersion(v => v + 1) }}>รีเฟรชรายงาน</button>
        {error ? <p role="alert" className="text-red-600">{error}</p> : !report ? <p role="status">กำลังโหลดรายงาน…</p> : <>
          {report.sessions.length === 0 ? <p className="py-6 text-center text-slate-500">ยังไม่มีรายการรถออกในกะนี้</p> : <div className="overflow-x-auto"><table className="w-full text-sm text-left">
            <thead><tr className="border-b"><th className="p-2">ทะเบียน</th><th className="p-2">ประเภทรถ</th><th className="p-2">เวลาออก</th><th className="p-2">ใบเสร็จ</th></tr></thead>
            <tbody>{report.sessions.map(s => <tr key={s._id} className="border-b"><td className="p-2"><strong>{s.plate}</strong></td><td className="p-2 whitespace-nowrap">{{ car: 'รถยนต์', motorcycle: 'รถจักรยานยนต์', overnight: 'รถยนต์ (ค้างคืน)' }[s.cardType] ?? '—'}</td><td className="p-2">{new Date(s.exitTime).toLocaleString('th-TH')}</td><td className="p-2"><div className="flex gap-2 whitespace-nowrap">
              <button disabled={receiptAction !== null} onClick={() => receipt(s._id)} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40">{receiptAction === s._id ? 'กำลังพิมพ์…' : 'พิมพ์ใบเสร็จ'}</button>
            </div></td></tr>)}</tbody>
          </table></div>}
          {!!report.refunds?.length && <section className="space-y-2">
            <h3 className="font-bold">คืนค่าปรับบัตรหายในกะนี้</h3>
            <table className="w-full text-sm text-left"><thead><tr className="border-b"><th className="p-2">ทะเบียน</th><th className="p-2">เวลาคืน</th><th className="p-2">คืนโดย</th><th className="p-2">ยอดคืน</th></tr></thead>
              <tbody>{report.refunds.map(r => <tr key={r.sessionId} className="border-b"><td className="p-2">{r.plate}</td><td className="p-2">{new Date(r.refundedAt).toLocaleString('th-TH')}</td><td className="p-2">{r.paymentMethod === 'cash' ? 'เงินสด' : 'โอน / QR'}</td><td className="p-2">฿{r.amount.toLocaleString()}</td></tr>)}</tbody>
            </table>
          </section>}
        </>}
      </DialogBody>
    </DialogContent>
  </Dialog>
}
