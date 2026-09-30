'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Search, ChevronLeft, ChevronRight, Camera, ImageOff, X, FileSpreadsheet, FileText } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/Toast'
import type { HistoryExportRow } from '@/lib/sessionHistoryExport'

interface SessionRow extends HistoryExportRow {
  _id:            string
  cardUid:        string
  cardType:       'car' | 'motorcycle' | 'overnight'
  plate:          string
  entryTime:      string
  exitTime?:      string
  durationMin:    number
  fee:            number
  lostFine:       number
  totalFee:       number
  status:         'active' | 'completed' | 'lost'
  paymentMethod:  'cash' | 'qr'
  operatorId?:    string
  shiftId?:       string
  discountName?:  string
  discountAmount: number
  note?:          string
  isSimulated?:   boolean
  entryPhotoPath?: string
  exitPhotoPath?:  string
}

const STATUS_META: Record<SessionRow['status'], { label: string; color: string; bg: string }> = {
  active:    { label: 'อยู่ในลาน', color: '#059669', bg: 'rgba(5,150,105,0.1)' },
  completed: { label: 'เสร็จสิ้น', color: '#A16207', bg: 'rgba(161,98,7,0.1)' },
  lost:      { label: 'บัตรหาย',   color: '#DC2626', bg: 'rgba(220,38,38,0.1)' },
}

const CARD_TYPE_LABEL: Record<string, string> = { car: 'รถยนต์', motorcycle: 'รถจักรยานยนต์', overnight: 'ค้างคืน' }

function fmtDT(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}
const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`

const LIMIT = 20

export function SessionHistory() {
  const { success, error: toastError } = useToast()
  const [rows,    setRows]    = useState<SessionRow[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(false)

  const [plate,    setPlate]    = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')
  const [includePhotos, setIncludePhotos] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState('')
  const [pendingExport, setPendingExport] = useState<{ rows: HistoryExportRow[]; format: 'pdf' | 'excel'; description: string; photos: boolean } | null>(null)
  const exportController = useRef<AbortController | null>(null)
  const listController = useRef<AbortController | null>(null)
  useEffect(() => () => { exportController.current?.abort(); listController.current?.abort() }, [])

  async function prepareExport(format: 'pdf' | 'excel') {
    const controller = new AbortController()
    exportController.current = controller
    setExporting(true); setProgress('กำลังรวบรวมทุกรายการตามตัวกรอง…')
    const description = `ทะเบียน: ${plate || 'ทั้งหมด'} · วันที่เข้า: ${dateFrom || 'ไม่จำกัด'} ถึง ${dateTo || 'ไม่จำกัด'}`
    try {
      const qs = new URLSearchParams()
      if (plate) qs.set('plate', plate)
      if (dateFrom) qs.set('dateFrom', dateFrom)
      if (dateTo) qs.set('dateTo', dateTo)
      const response = await fetch(`/api/reports/history?${qs}`, { signal: controller.signal })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'โหลดรายการไม่สำเร็จ')
      controller.signal.throwIfAborted()
      if (!data.sessions?.length) throw new Error('ไม่มีรายการที่ตรงกับตัวกรอง')
      setPendingExport({ rows: data.sessions, format, description, photos: includePhotos })
    } catch (error) {
      if (!controller.signal.aborted) toastError('ส่งออกไม่สำเร็จ', error instanceof Error ? error.message : 'กรุณาลองใหม่')
    } finally { setExporting(false); setProgress('') }
  }

  async function confirmExport() {
    if (!pendingExport) return
    const task = pendingExport
    setPendingExport(null); setExporting(true); setProgress('กำลังเตรียมไฟล์…')
    const controller = new AbortController()
    exportController.current = controller
    try {
      const { exportHistoryExcel, exportHistoryPDF } = await import('@/lib/sessionHistoryExport')
      const options = { includePhotos: task.photos, description: task.description, signal: controller.signal, onProgress: setProgress }
      await (task.format === 'excel' ? exportHistoryExcel(task.rows, options) : exportHistoryPDF(task.rows, options))
      success('สร้างไฟล์สำเร็จ', `${task.rows.length.toLocaleString()} รายการ ${task.photos ? 'พร้อมภาพขาเข้าและขาออก' : 'ไม่แนบรูปภาพ'}`)
    } catch (error) {
      if (!controller.signal.aborted) toastError('ส่งออกไม่สำเร็จ', error instanceof Error ? error.message : 'กรุณาลองใหม่')
    } finally { setExporting(false); setProgress('') }
  }

  const [selected,  setSelected]  = useState<SessionRow | null>(null)
  const [zoomPhoto, setZoomPhoto] = useState<{ sessionId: string; type: 'entry' | 'exit'; label: string } | null>(null)

  const fetchRows = useCallback(async (p: number) => {
    listController.current?.abort()
    const controller = new AbortController()
    listController.current = controller
    setLoading(true)
    try {
      const qs = new URLSearchParams({ page: String(p), limit: String(LIMIT) })
      if (plate)    qs.set('plate',    plate)
      if (dateFrom) qs.set('dateFrom', dateFrom)
      if (dateTo)   qs.set('dateTo',   dateTo)
      const response = await fetch(`/api/sessions?${qs}`, { signal: controller.signal })
      if (!response.ok) throw new Error('โหลดรายการไม่สำเร็จ')
      const data = await response.json()
      controller.signal.throwIfAborted()
      setRows(data.sessions ?? [])
      setTotal(data.total ?? 0)
      setPage(p)
    } catch {
      if (!controller.signal.aborted) { setRows([]); setTotal(0) }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [plate, dateFrom, dateTo])

  useEffect(() => {
    const timer = setTimeout(() => { void fetchRows(1) }, 200)
    return () => { clearTimeout(timer); listController.current?.abort() }
  }, [fetchRows])

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <div className="space-y-4">

      {/* ── filters ── */}
      <div className="bg-white rounded-xl p-4 flex flex-wrap items-end gap-3" style={{ border: '1px solid #E8ECF4' }}>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">ทะเบียนรถ</label>
          <input value={plate} onChange={e => setPlate(e.target.value)} placeholder="เช่น 1234"
            className="h-9 px-3 rounded-lg text-xs outline-none w-32"
            style={{ border: '1.5px solid #E8ECF4', background: '#FAFBFF' }} />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">ตั้งแต่</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="h-9 px-3 rounded-lg text-xs outline-none"
            style={{ border: '1.5px solid #E8ECF4', background: '#FAFBFF' }} />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">ถึง</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="h-9 px-3 rounded-lg text-xs outline-none"
            style={{ border: '1.5px solid #E8ECF4', background: '#FAFBFF' }} />
        </div>
        <button onClick={() => fetchRows(1)}
          className="h-9 px-4 rounded-lg text-xs font-bold text-black flex items-center gap-1.5 hover:opacity-90"
          style={{ background: '#EAB308' }}>
          <Search className="size-3.5" /> ค้นหา
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={includePhotos} disabled={exporting}
              onChange={e => setIncludePhotos(e.target.checked)} className="size-4" />
            แนบภาพขาเข้าและขาออก
          </label>
          <button onClick={() => prepareExport('excel')} disabled={exporting || loading || total === 0}
            className="h-9 px-3 border rounded-lg text-sm font-semibold flex items-center gap-2 text-emerald-700 disabled:opacity-40">
            <FileSpreadsheet className="size-4" /> Excel
          </button>
          <button onClick={() => prepareExport('pdf')} disabled={exporting || loading || total === 0}
            className="h-9 px-3 border rounded-lg text-sm font-semibold flex items-center gap-2 text-red-700 disabled:opacity-40">
            <FileText className="size-4" /> PDF
          </button>
        </div>
        <p className="w-full text-xs text-slate-500">ส่งออกทุกรายการตามตัวกรองวันที่เข้าและทะเบียน ไม่จำกัดเฉพาะหน้าปัจจุบัน</p>
        {exporting && <div className="w-full flex items-center gap-3 text-sm">
          <span role="status">{progress}</span>
          <button className="underline text-red-700" onClick={() => exportController.current?.abort()}>ยกเลิก</button>
        </div>}
      </div>

      <Dialog open={!!pendingExport} onOpenChange={open => { if (!open) setPendingExport(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>ส่งออกประวัติรายการ {pendingExport?.format === 'excel' ? 'Excel' : 'PDF'}</DialogTitle></DialogHeader>
          <DialogBody className="space-y-4 pb-5">
            <p className="font-semibold">ทั้งหมด {pendingExport?.rows.length.toLocaleString()} รายการ</p>
            <p className="text-sm text-slate-600">{pendingExport?.description}</p>
            <p className="text-sm">{pendingExport?.photos ? 'แนบภาพขาเข้าและขาออก หากไม่มีภาพจะแสดงข้อความแทน การแนบรูปจำนวนมากอาจใช้เวลาสร้างไฟล์นานขึ้น' : 'ส่งออกเฉพาะข้อมูล ไม่แนบรูปภาพ'}</p>
            <div className="flex gap-3">
              <button onClick={confirmExport} className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-bold">สร้างไฟล์และดาวน์โหลด</button>
              <button onClick={() => setPendingExport(null)} className="rounded-lg border px-4 py-2 text-sm">ยกเลิก</button>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* ── table ── */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F8FAFF', borderBottom: '1px solid #E8ECF4' }}>
                {['เวลาเข้า', 'ทะเบียน', 'ประเภท', 'เวลาออก', 'ยอดชำระ', 'สถานะ', 'ภาพ'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const st = STATUS_META[r.status]
                return (
                  <tr key={r._id} onClick={() => setSelected(r)}
                    className="cursor-pointer hover:bg-yellow-50/50 transition-colors"
                    style={{ background: i % 2 === 0 ? 'white' : '#FAFBFF', borderBottom: '1px solid #F1F5F9' }}>
                    <td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">{fmtDT(r.entryTime)}</td>
                    <td className="px-4 py-2.5 text-xs font-bold text-slate-800 whitespace-nowrap">{r.plate}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">{CARD_TYPE_LABEL[r.cardType]}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">{fmtDT(r.exitTime)}</td>
                    <td className="px-4 py-2.5 text-xs font-bold whitespace-nowrap" style={{ color: '#A16207' }}>{baht(r.totalFee)}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        {r.entryPhotoPath ? <Camera className="size-3.5" style={{ color: '#059669' }} /> : <ImageOff className="size-3.5 text-slate-200" />}
                        {r.exitPhotoPath  ? <Camera className="size-3.5" style={{ color: '#EA580C' }} /> : <ImageOff className="size-3.5 text-slate-200" />}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && !loading && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-xs text-slate-300">ไม่มีข้อมูล</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* pagination */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #F1F5F9' }}>
          <span className="text-[10px] text-slate-400">{total} รายการ · หน้า {page}/{totalPages}</span>
          <div className="flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => fetchRows(page - 1)}
              className="size-7 rounded-lg flex items-center justify-center disabled:opacity-30 hover:bg-slate-100">
              <ChevronLeft className="size-3.5" />
            </button>
            <button disabled={page >= totalPages} onClick={() => fetchRows(page + 1)}
              className="size-7 rounded-lg flex items-center justify-center disabled:opacity-30 hover:bg-slate-100">
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── detail dialog ── */}
      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader className="px-5 pt-5 pb-3">
                <DialogTitle>รายละเอียดรายการ — {selected.plate}</DialogTitle>
              </DialogHeader>
              <DialogBody className="px-5 pb-5 space-y-4">
                {/* photos */}
                <div className="grid grid-cols-2 gap-3">
                  {(['entry', 'exit'] as const).map(type => {
                    const has = type === 'entry' ? selected.entryPhotoPath : selected.exitPhotoPath
                    return (
                      <div key={type}
                        onClick={() => has && setZoomPhoto({ sessionId: selected._id, type, label: type === 'entry' ? 'ภาพขาเข้า' : 'ภาพขาออก' })}
                        className="rounded-xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center"
                        style={{ cursor: has ? 'pointer' : 'default' }}>
                        {has ? (
                          <img src={`/api/sessions/${selected._id}/photo?type=${type}`} alt={type} className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 text-slate-600">
                            <ImageOff className="size-6" />
                            <span className="text-[10px]">ไม่มีภาพ{type === 'entry' ? 'ขาเข้า' : 'ขาออก'}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* backend detail fields */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-xs rounded-xl p-3.5"
                  style={{ background: '#FAFBFF', border: '1px solid #E8ECF4' }}>
                  {[
                    ['เลขบัตร/UID', selected.cardUid],
                    ['ประเภท', CARD_TYPE_LABEL[selected.cardType]],
                    ['เวลาเข้า', fmtDT(selected.entryTime)],
                    ['เวลาออก', fmtDT(selected.exitTime)],
                    ['ระยะเวลา', `${selected.durationMin} นาที`],
                    ['ค่าจอด', baht(selected.fee)],
                    ['ค่าปรับบัตรหาย', baht(selected.lostFine)],
                    ['ส่วนลด', selected.discountName ? `${selected.discountName} (-${baht(selected.discountAmount)})` : '—'],
                    ['ยอดชำระสุทธิ', baht(selected.totalFee)],
                    ['ชำระโดย', selected.paymentMethod === 'qr' ? 'QR' : 'เงินสด'],
                    ['สถานะ', STATUS_META[selected.status].label],
                    ['พนักงาน (Operator ID)', selected.operatorId ?? '—'],
                    ['กะการทำงาน (Shift ID)', selected.shiftId ?? '—'],
                    ['หมายเหตุ', selected.note ?? '—'],
                    ['ข้อมูลจำลอง', selected.isSimulated ? 'ใช่' : 'ไม่'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-[9px] font-black text-slate-400 uppercase">{label}</p>
                      <p className="text-slate-700 font-semibold break-all">{value}</p>
                    </div>
                  ))}
                </div>
              </DialogBody>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── fullscreen photo zoom ── */}
      {zoomPhoto && (
        <div className="fixed inset-0 z-[300] flex flex-col bg-black" onClick={() => setZoomPhoto(null)}>
          <div className="shrink-0 flex items-center justify-between px-4 py-2.5" style={{ background: 'rgba(0,0,0,0.9)' }}>
            <span className="text-white text-sm font-bold">{zoomPhoto.label}</span>
            <button onClick={() => setZoomPhoto(null)} className="text-white/60 hover:text-white transition-colors">
              <X className="size-5" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            <img src={`/api/sessions/${zoomPhoto.sessionId}/photo?type=${zoomPhoto.type}`}
              alt={zoomPhoto.label}
              className="max-w-full max-h-full object-contain"
              onClick={e => e.stopPropagation()} />
          </div>
        </div>
      )}
    </div>
  )
}
