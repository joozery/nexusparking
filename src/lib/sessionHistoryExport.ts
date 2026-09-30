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
}
type Photo = { data: string; width: number; height: number } | { message: string }
export interface HistoryExportOptions {
  includePhotos: boolean
  description: string
  signal: AbortSignal
  onProgress: (message: string) => void
}
const TYPES: Record<string, string> = { car: 'รถยนต์', motorcycle: 'รถจักรยานยนต์', overnight: 'ค้างคืน' }
const STATUS: Record<string, string> = { active: 'อยู่ในลาน', completed: 'เสร็จสิ้น', lost: 'บัตรหาย', void: 'ยกเลิก' }
export const historyDate = (value?: string) => value ? new Date(value).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '—'
export function historyValues(r: HistoryExportRow) {
  return [r._id, r.plate, r.cardUid, TYPES[r.cardType] ?? r.cardType, historyDate(r.entryTime), historyDate(r.exitTime),
    r.durationMin, r.fee, r.discountName ?? '', r.discountAmount ?? 0, r.fineName ?? '', r.fineAmount ?? 0,
    r.lostFine ?? 0, r.totalFee, r.paymentMethod === 'qr' ? 'QR' : 'เงินสด',
    r.lostCard || r.lostFine > 0 ? `${STATUS[r.status] ?? r.status} (บัตรหาย)` : STATUS[r.status] ?? r.status, r.note ?? '']
}
const HEADERS = ['รหัสรายการ', 'ทะเบียน', 'เลขบัตร/UID', 'ประเภทรถ', 'เวลาเข้า (ไทย)', 'เวลาออก (ไทย)', 'ระยะเวลา (นาที)', 'ค่าจอด', 'ชื่อส่วนลด', 'ส่วนลด', 'ชื่อค่าปรับ', 'ค่าปรับทั่วไป', 'ค่าปรับบัตรหาย', 'ยอดสุทธิ', 'ชำระโดย', 'สถานะ', 'หมายเหตุ']
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
  const headers = options.includePhotos ? [...HEADERS, 'ภาพขาเข้า', 'ภาพขาออก'] : HEADERS
  sheet.columns = headers.map((header, i) => ({ header, width: i >= HEADERS.length ? 34 : [0, 2, 4, 5, 8, 10, 16].includes(i) ? 28 : 18 }))
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
    const r = rows[i], row = sheet.addRow(historyValues(r))
    row.alignment = { vertical: 'middle', wrapText: true }
    row.height = options.includePhotos ? 120 : 36
    for (const col of [8, 10, 12, 13, 14]) row.getCell(col).numFmt = '#,##0.00'
    if (options.includePhotos) {
      for (const [index, type] of (['entry', 'exit'] as const).entries()) {
        const image = await loadPhoto(r, type, options.signal)
        options.signal.throwIfAborted()
        const column = HEADERS.length + index
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
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  // Browser text shaping preserves Thai vowels/tone marks; each PDF page is rendered at ~150dpi.
  const canvas = document.createElement('canvas'); canvas.width = 1240; canvas.height = 1754
  const ctx = canvas.getContext('2d')!
  const font = getComputedStyle(document.body).fontFamily
  let y = 0, page = 0
  function startPage() {
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#1e293b'; ctx.font = `bold 32px ${font}`
    ctx.fillText('ประวัติรายการจอดรถ', 55, 65)
    ctx.font = `20px ${font}`
    ctx.fillText(`${rows.length.toLocaleString()} รายการ · เวลาในประเทศไทย · ${options.includePhotos ? 'แนบภาพขาเข้าและขาออก' : 'ไม่แนบรูปภาพ'}`, 55, 105)
    y = 145
    line(options.description)
    y += 15
  }
  function flushPage() {
    ctx.fillStyle = '#64748b'; ctx.font = `18px ${font}`
    ctx.fillText(`หน้า ${page + 1}`, 55, 1718)
    if (page > 0) doc.addPage()
    doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297)
    page++
  }
  function ensure(height: number) { if (y + height > 1650) { flushPage(); startPage() } }
  function line(value: string) {
    ctx.font = `22px ${font}`; ctx.fillStyle = '#1e293b'
    let text = ''
    for (const { segment } of new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(value)) {
      if (segment === '\n' || ctx.measureText(text + segment).width > 1120) {
        ensure(32); ctx.fillText(text, 55, y); y += 32; text = segment === '\n' ? '' : segment
      } else text += segment
    }
    ensure(32); ctx.fillText(text, 55, y); y += 32
  }
  startPage()
  for (let i = 0; i < rows.length; i++) {
    options.signal.throwIfAborted()
    const r = rows[i], v = historyValues(r)
    ensure(options.includePhotos ? 580 : 350)
    line(`${i + 1}. ทะเบียน ${r.plate} · ${v[3]} · ${v[15]}`)
    line(`เข้า: ${v[4]}     ออก: ${v[5]}     ระยะเวลา: ${r.durationMin} นาที`)
    line(`ค่าจอด: ${r.fee} บาท     ส่วนลด: ${r.discountAmount ?? 0} บาท (${r.discountName || 'ไม่มี'})`)
    line(`ค่าปรับทั่วไป: ${r.fineAmount ?? 0} บาท (${r.fineName || 'ไม่มี'})     ค่าปรับบัตรหาย: ${r.lostFine ?? 0} บาท`)
    line(`ยอดสุทธิ: ${r.totalFee} บาท     ชำระโดย: ${v[14]}`)
    line(`เลขบัตร: ${r.cardUid}     รหัสรายการ: ${r._id}`)
    if (r.note) line(`หมายเหตุ: ${r.note}`)
    if (options.includePhotos) {
      ensure(310)
      for (const [index, type] of (['entry', 'exit'] as const).entries()) {
        const image = await photo(r, type, options.signal)
        options.signal.throwIfAborted()
        const x = 55 + index * 575
        ctx.fillStyle = '#1e293b'; ctx.font = `20px ${font}`
        ctx.fillText(`${type === 'entry' ? 'ภาพขาเข้า' : 'ภาพขาออก'} · ${r.plate}`, x, y)
        ctx.fillStyle = '#f1f5f9'; ctx.fillRect(x, y + 15, 545, 245)
        if ('message' in image) {
          ctx.fillStyle = '#64748b'; ctx.fillText(image.message, x + 20, y + 140)
        } else {
          const element = new Image(); element.src = image.data; await element.decode()
          const ratio = Math.min(545 / image.width, 245 / image.height)
          const w = image.width * ratio, h = image.height * ratio
          ctx.drawImage(element, x + (545 - w) / 2, y + 15 + (245 - h) / 2, w, h)
        }
      }
      y += 285
    }
    ctx.strokeStyle = '#cbd5e1'; ctx.beginPath(); ctx.moveTo(55, y); ctx.lineTo(1180, y); ctx.stroke(); y += 30
    options.onProgress(`สร้าง PDF ${i + 1} / ${rows.length} รายการ`)
    await pause()
  }
  options.signal.throwIfAborted()
  flushPage()
  options.onProgress('กำลังจัดเก็บไฟล์ PDF…')
  const blob = doc.output('blob')
  options.signal.throwIfAborted()
  download(blob, `parking-history_${Date.now()}.pdf`)
}
