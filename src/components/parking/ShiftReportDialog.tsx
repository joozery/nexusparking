'use client'

import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody } from '@/components/ui/dialog'

interface Report {
  operatorName: string
  startTime: string
  count: number
  cash: number
  qr: number
  total: number
  sessions: { _id: string; plate: string; cardUid: string; exitTime: string; totalFee: number; paymentMethod: string }[]
}

export function ShiftReportDialog({ onClose }: { onClose: () => void }) {
  const { success, error: toastError } = useToast()
  const receiptBusy = useRef(false)
  const [receiptAction, setReceiptAction] = useState<string | null>(null)
  async function receipt(id: string, kind: 'print' | 'pdf') {
    if (receiptBusy.current) return
    receiptBusy.current = true
    setReceiptAction(`${id}:${kind}`)
    try {
      if (kind === 'pdf') {
        const { downloadReceiptPdf } = await import('@/lib/receiptPdf')
        await downloadReceiptPdf(id)
      } else {
        const res = await fetch(`/api/sessions/${encodeURIComponent(id)}/print`, { method: 'POST' })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error ?? 'กรุณาตรวจสอบเครื่องพิมพ์')
        success('พิมพ์ใบเสร็จแล้ว')
      }
    } catch (e) {
      toastError(kind === 'pdf' ? 'สร้าง PDF ไม่สำเร็จ' : 'พิมพ์ไม่สำเร็จ', e instanceof Error ? e.message : 'กรุณาลองใหม่')
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
      .then(async res => { const data = await res.json(); if (!res.ok) throw new Error(data.error ?? 'โหลดรายงานไม่สำเร็จ'); return data })
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
            <thead><tr className="border-b"><th className="p-2">ทะเบียน / บัตร</th><th className="p-2">เวลาออก</th><th className="p-2">ใบเสร็จ</th></tr></thead>
            <tbody>{report.sessions.map(s => <tr key={s._id} className="border-b"><td className="p-2"><strong>{s.plate}</strong><p className="text-xs text-slate-500">{s.cardUid}</p></td><td className="p-2">{new Date(s.exitTime).toLocaleString('th-TH')}</td><td className="p-2"><div className="flex gap-2 whitespace-nowrap">
              <button disabled={receiptAction !== null} onClick={() => receipt(s._id, 'print')} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40">{receiptAction === `${s._id}:print` ? 'กำลังพิมพ์…' : 'พิมพ์ใบเสร็จ'}</button>
              <button disabled={receiptAction !== null} onClick={() => receipt(s._id, 'pdf')} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40">{receiptAction === `${s._id}:pdf` ? 'กำลังสร้าง…' : 'PDF'}</button>
            </div></td></tr>)}</tbody>
          </table></div>}
        </>}
      </DialogBody>
    </DialogContent>
  </Dialog>
}
