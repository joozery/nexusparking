import type { Workbook } from 'exceljs'

export interface HistoryExportRow {
  _id: string
  cardUid: string
  cardType: string
  plate: string
  entryTime: string
  exitTime?: string
  durationMin: number
  fee: number
  discountName?: string
  discountAmount: number
  fineName?: string
  fineAmount?: number
  lostFine: number
  lostCard?: boolean
  totalFee: number
  paymentMethod: string
  status: string
  note?: string
  entryPhotoPath?: string
  exitPhotoPath?: string
  transactionType?: 'parking' | 'refund'
  refundedAt?: string
  refundAmount?: number
  originalSessionId?: string
  refundOperatorName?: string
  operatorName?: string
}
type Photo = { data: string; width: number; height: number } | { message: string }
export interface HistoryExportOptions {
  includePhotos: boolean
  description: string
  signal: AbortSignal
  onProgress: (message: string) => void
  reportKind?: 'history' | 'revenue'
}
const TYPES: Record<string, string> = { car: 'รถยนต์', motorcycle: 'รถจักรยานยนต์', overnight: 'ค้างคืน' }
const STATUS: Record<string, string> = { active: 'อยู่ในลาน', completed: 'เสร็จสิ้น', lost: 'บัตรหาย', void: 'ยกเลิก' }
export const historyDate = (value?: string) => value ? new Date(value).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '—'
const historyDateOnly = (value?: string) => value ? new Date(value).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }) : ''
const historyTimeOnly = (value?: string) => value ? new Date(value).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : ''
export function historyValues(r: HistoryExportRow) {
  const refund = r.transactionType === 'refund'
  return [r.plate, refund ? 'คืนค่าปรับบัตรหาย' : TYPES[r.cardType] ?? r.cardType, r.cardUid,
    historyDateOnly(r.entryTime), historyTimeOnly(r.entryTime), historyDateOnly(r.exitTime), historyTimeOnly(r.exitTime),
    refund ? 0 : r.fee, r.discountName ?? '', r.discountAmount ?? 0, r.fineName ?? '', r.fineAmount ?? 0,
    refund ? 'TRUE' : r.lostCard || r.lostFine > 0 ? 'TRUE' : 'FALSE', refund ? -(r.refundAmount ?? 0) : r.lostFine ?? 0,
    r.fineAmount && r.fineAmount > 0 ? 'TRUE' : 'FALSE', r.fineAmount ?? 0,
    r.paymentMethod === 'qr' ? 'เงินโอน' : 'เงินสด', refund ? -(r.refundAmount ?? 0) : r.totalFee,
    refund ? `${r.note ?? 'คืนค่าปรับบัตรหาย'}${r.originalSessionId ? ` · อ้างอิง ${r.originalSessionId}` : ''}${r.refundOperatorName ? ` · ผู้คืนเงิน ${r.refundOperatorName}` : ''}` : r.note ?? '']
}
const HEADERS = ['ทะเบียน', 'ประเภท (car/motorcycle/overnight)', 'เลขบัตร UID', 'วันที่เข้า (DD/MM/YYYY)', 'เวลาเข้า (HH:MM:SS)', 'วันที่ออก (DD/MM/YYYY)', 'เวลาออก (HH:MM:SS)', 'ค่าจอดรถ (บาท)', 'ชื่อส่วนลดร้านค้า (ไม่มีบัตร)', 'ส่วนลดร้านค้า (บาท)', 'ชื่อค่าปรับนอกเวลา', 'ค่าปรับนอกเวลา (บาท)', 'บัตรหาย (true/false)', 'ค่าปรับบัตรหาย (บาท)', 'ค่าปรับนอกเวลา (true/false)', 'ค่าปรับนอกเวลา (บาท)', 'Cash/QR', 'จำนวนเงินสุทธิ (บาท)', 'หมายเหตุ/รายการ']
const REVENUE_HEADERS = ['ทะเบียน', 'ประเภท (car/motorcycle/overnight)', 'เลขบัตร UID', 'วันที่เข้า (DD/MM/YYYY)', 'เวลาเข้า (HH:MM:SS)', 'วันที่ออก (DD/MM/YYYY)', 'เวลาออก (HH:MM:SS)', 'ค่าจอดรถ (บาท)', 'ชื่อค่าปรับ', 'ค่าปรับ (บาท)', 'ชื่อส่วนลดรายคน / โรงแรม', 'ส่วนลดรายคน / โรงแรม (บาท)', 'บัตรหาย (true/false)', 'ค่าปรับบัตรหาย (บาท)', 'Cash/QR', 'จำนวนเงินสุทธิ (บาท)', 'หมายเหตุ/รายการ']
const OPERATOR_HEADER = '\u0e0a\u0e37\u0e48\u0e2d\u0e1e\u0e19\u0e31\u0e01\u0e07\u0e32\u0e19'
const exportHeaders = (options: HistoryExportOptions) => options.reportKind === 'revenue' ? [...REVENUE_HEADERS, OPERATOR_HEADER] : HEADERS
const exportValues = (row: HistoryExportRow, options: HistoryExportOptions) => options.reportKind === 'revenue'
  ? (() => { const values = historyValues(row); return [values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[10], values[11], values[8], values[9], values[12], values[13], values[16], values[17], values[18], row.transactionType === 'refund' ? row.refundOperatorName ?? '' : row.operatorName ?? ''] })()
  : historyValues(row)
const pause = () => new Promise<void>(resolve => setTimeout(resolve, 0))

async function photo(r: HistoryExportRow, type: 'entry' | 'exit', signal: AbortSignal): Promise<Photo> {
  signal.throwIfAborted()
  const label = type === 'entry' ? 'ขาเข้า' : 'ขาออก'
  if (!(type === 'entry' ? r.entryPhotoPath : r.exitPhotoPath)) return { message: `ไม่มีภาพ${label}` }
  const response = await fetch(`/api/sessions/${encodeURIComponent(r._id)}/photo?type=${type}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]) })
  if (response.status === 404) return { message: `ไม่พบไฟล์ภาพ${label}` }
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`โหลดภาพ${label}ของ ${r.plate} ไม่สำเร็จ กรุณาลองใหม่`)
  const blob = await response.blob()
  signal.throwIfAborted()
  const bitmap = await createImageBitmap(blob)
  try {
    const ratio = Math.min(1, 720 / bitmap.width, 480 / bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio))
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return { data: canvas.toDataURL('image/jpeg', 0.8), width: canvas.width, height: canvas.height }
  } finally { bitmap.close() }
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = name
  document.body.appendChild(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

/** Kept independent of the browser so embedded images and numeric cells can be tested. */
export async function buildHistoryWorkbook(workbook: Workbook, rows: HistoryExportRow[], options: HistoryExportOptions,
  loadPhoto: (r: HistoryExportRow, type: 'entry' | 'exit', signal: AbortSignal) => Promise<Photo> = photo) {
  const sheet = workbook.addWorksheet('ประวัติรายการ')
  const baseHeaders = exportHeaders(options)
  const headers = options.includePhotos ? [...baseHeaders, 'ภาพขาเข้า', 'ภาพขาออก'] : baseHeaders
  sheet.columns = headers.map((header, i) => ({ header, width: i >= baseHeaders.length ? 34 : [0, 2, 4, 5, 8, 10, 16].includes(i) ? 28 : 18 }))
  sheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 2 }]
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF78600B' } }
  sheet.getRow(1).height = 28
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length + 1), column: headers.length } }
  const info = workbook.addWorksheet('ข้อมูลรายงาน')
  info.columns = [{ width: 25 }, { width: 90 }]
  info.addRows([['รายงาน', 'ประวัติรายการจอดรถ'], ['ตัวกรอง', options.description], ['จำนวนรายการ', rows.length], ['สร้างเมื่อ', historyDate(new Date().toISOString())], ['รูปภาพ', options.includePhotos ? 'ภาพขาเข้าและขาออกของแต่ละรายการ' : 'ไม่แนบรูปภาพ']])
  for (let i = 0; i < rows.length; i++) {
    options.signal.throwIfAborted()
    const r = rows[i], row = sheet.addRow(exportValues(r, options))
    row.alignment = { vertical: 'middle', wrapText: true }
    row.height = options.includePhotos ? 120 : 36
    for (const col of (options.reportKind === 'revenue' ? [8, 9, 11, 13, 15, 17] : [8, 10, 12, 14, 16, 18])) row.getCell(col).numFmt = '#,##0.00'
    if (options.includePhotos && r.transactionType !== 'refund') {
      for (const [index, type] of (['entry', 'exit'] as const).entries()) {
        const image = await loadPhoto(r, type, options.signal)
        options.signal.throwIfAborted()
        const column = baseHeaders.length + index
        if ('message' in image) row.getCell(column + 1).value = image.message
        else {
          const scale = Math.min(220 / image.width, 140 / image.height)
          const id = workbook.addImage({ base64: image.data, extension: 'jpeg' })
          sheet.addImage(id, { tl: { col: column + 0.05, row: row.number - 1 + 0.05 }, ext: { width: image.width * scale, height: image.height * scale }, editAs: 'oneCell' })
        }
      }
    }
    options.onProgress(`สร้าง Excel ${i + 1} / ${rows.length} รายการ`)
    if (i % 20 === 0) await pause()
  }
  return workbook
}

export async function exportHistoryExcel(rows: HistoryExportRow[], options: HistoryExportOptions) {
  const { Workbook } = await import('exceljs')
  const workbook = await buildHistoryWorkbook(new Workbook(), rows, options)
  options.signal.throwIfAborted()
  options.onProgress('กำลังจัดเก็บไฟล์ Excel…')
  const buffer = await workbook.xlsx.writeBuffer()
  options.signal.throwIfAborted()
  download(new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `parking-history_${Date.now()}.xlsx`)
}

export async function exportHistoryPDF(rows: HistoryExportRow[], options: HistoryExportOptions) {
  const { jsPDF } = await import('jspdf')
  await document.fonts.ready
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3', compress: true })
  const canvas = document.createElement('canvas'); canvas.width = 3000; canvas.height = 2100
  const ctx = canvas.getContext('2d')!
  const font = getComputedStyle(document.body).fontFamily
  const widths = options.reportKind === 'revenue'
    ? [100, 175, 155, 125, 110, 125, 110, 115, 180, 125, 220, 145, 130, 140, 105, 145, 220]
    : [100, 175, 155, 125, 110, 125, 110, 115, 220, 125, 180, 125, 130, 140, 155, 140, 105, 145, 220]
  const renderedWidths = options.reportKind === 'revenue' ? [...widths, 150] : widths
  const left = 35, top = 185, headerHeight = 105, rowHeight = 62, bottom = 2025
  const pageRows = Math.max(1, Math.floor((bottom - top - headerHeight) / rowHeight))
  const wrap = (value: string, maxWidth: number, size: number) => {
    ctx.font = `${size}px ${font}`
    const parts = String(value).split(' ')
    const lines: string[] = []
    let line = ''
    for (const part of parts) {
      const candidate = line ? `${line} ${part}` : part
      if (ctx.measureText(candidate).width > maxWidth && line) { lines.push(line); line = part } else line = candidate
    }
    if (line || !lines.length) lines.push(line)
    return lines.slice(0, 3)
  }
  const drawPage = (pageRowsData: HistoryExportRow[], pageIndex: number) => {
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#111827'; ctx.font = `bold 38px ${font}`
    ctx.fillText('รายงานรายการจอดรถ', left, 55)
    ctx.font = `22px ${font}`
    ctx.fillText(`${rows.length.toLocaleString('th-TH')} รายการ · ${options.description}`, left, 95)
    let x = left
    const drawCell = (value: string, width: number, y: number, height: number, header = false, yellow = false) => {
      ctx.fillStyle = header ? '#E5E7EB' : yellow ? '#FFC000' : 'white'
      ctx.fillRect(x, y, width, height)
      ctx.strokeStyle = '#4B5563'; ctx.lineWidth = 1; ctx.strokeRect(x, y, width, height)
      ctx.fillStyle = '#111827'; const size = header ? 18 : 17
      const lines = wrap(value, width - 12, size)
      ctx.font = `${header ? 'bold ' : ''}${size}px ${font}`
      lines.forEach((line, index) => ctx.fillText(line, x + 6, y + 25 + index * 22))
      x += width
    }
    x = left
    exportHeaders(options).forEach((header, index) => drawCell(header, renderedWidths[index], top, headerHeight, true))
    pageRowsData.forEach((row, rowIndex) => {
      x = left
      const values = exportValues(row, options)
      values.forEach((value, index) => drawCell(String(value ?? ''), renderedWidths[index], top + headerHeight + rowIndex * rowHeight, rowHeight, false, (options.reportKind === 'revenue' ? [7, 9, 11, 13, 15] : [7, 9, 11, 13, 15, 17]).includes(index)))
    })
    ctx.fillStyle = '#6B7280'; ctx.font = `18px ${font}`
    ctx.fillText(`หน้า ${pageIndex + 1}`, left, 2070)
  }
  for (let offset = 0, page = 0; offset < rows.length; offset += pageRows, page++) {
    options.signal.throwIfAborted()
    drawPage(rows.slice(offset, offset + pageRows), page)
    if (page > 0) doc.addPage()
    doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 420, 297)
    options.onProgress(`สร้าง PDF ${Math.min(offset + pageRows, rows.length)} / ${rows.length} รายการ`)
    await pause()
  }
  options.onProgress('กำลังจัดเก็บไฟล์ PDF…')
  const blob = doc.output('blob')
  options.signal.throwIfAborted()
  download(blob, `parking-history_${Date.now()}.pdf`)
}
