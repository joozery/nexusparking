import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'

export interface RevenueSummaryDailyRow {
  _id: string
  total: number
  count: number
  lostFines: number
}

export interface RevenueSummaryData {
  startDate: string
  endDate: string
  daily: RevenueSummaryDailyRow[]
  summary: { total: number; count: number; lostFines: number }
}

const money = (value: number) => Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dateLabel = (value: string) => new Date(value).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })

function rows(data: RevenueSummaryData) {
  const parking = data.daily.map(row => ['ค่าจอดรถ', dateLabel(row._id), row.count, row.total - row.lostFines])
  const lost = data.daily.filter(row => row.lostFines > 0).map(row => ['บัตรหาย', dateLabel(row._id), '', row.lostFines])
  const totals = [
    ['ค่าจอดรถ', data.summary.count, data.summary.total - data.summary.lostFines],
    ['บัตรหาย', '', data.summary.lostFines],
    ['รวมทั้งหมด', data.summary.count, data.summary.total],
  ]
  return { parking, lost, totals }
}

export function exportRevenueSummaryExcel(data: RevenueSummaryData) {
  const grouped = rows(data)
  const sheetRows: (string | number)[][] = [
    ['รายงานสรุป'],
    [`ช่วงวันที่ ${dateLabel(data.startDate)} - ${dateLabel(data.endDate)}`],
    [],
    ['ประเภทรายการ', 'วันที่', 'จำนวนรถ/คัน', 'เป็นเงิน (บาท)'],
    ...grouped.parking,
    ['รวมค่าจอดรถ', data.summary.count, data.summary.total],
  ]
  if (grouped.lost.length) sheetRows.push([], ['ประเภทรายการ', 'วันที่', 'จำนวนรถ/คัน', 'เป็นเงิน (บาท)'], ...grouped.lost)
  sheetRows.push([], ['ประเภทรายการ', 'จำนวนรถ/คัน', 'เป็นเงิน (บาท)'], ...grouped.totals)
  const ws = XLSX.utils.aoa_to_sheet(sheetRows)
  ws['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 20 }]
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'รายงานสรุป')
  XLSX.writeFile(wb, `revenue-summary_${data.startDate.slice(0, 10)}_to_${data.endDate.slice(0, 10)}.xlsx`)
}

export function exportRevenueSummaryPDF(data: RevenueSummaryData) {
  const grouped = rows(data)
  const canvas = document.createElement('canvas')
  canvas.width = 1600; canvas.height = 2200
  const ctx = canvas.getContext('2d')!
  const font = getComputedStyle(document.body).fontFamily
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#111827'; ctx.textAlign = 'center'; ctx.font = `bold 46px ${font}`
  ctx.fillText('รายงานสรุป', 800, 75)
  ctx.font = `24px ${font}`
  ctx.fillText(`ช่วงวันที่ ${dateLabel(data.startDate)} - ${dateLabel(data.endDate)}`, 800, 120)
  ctx.textAlign = 'left'
  let y = 185
  const table = (title: string, headers: string[], body: (string | number)[][]) => {
    ctx.fillStyle = '#111827'; ctx.font = `bold 28px ${font}`; ctx.fillText(title, 80, y); y += 24
    const widths = headers.length === 4 ? [320, 330, 300, 360] : [650, 300, 360]
    const drawRow = (values: (string | number)[], header = false) => {
      let x = 80; ctx.font = `${header ? 'bold ' : ''}22px ${font}`
      values.forEach((value, i) => {
        ctx.fillStyle = header ? '#E5E7EB' : '#fff'; ctx.fillRect(x, y, widths[i], 52)
        ctx.strokeStyle = '#4B5563'; ctx.strokeRect(x, y, widths[i], 52)
        ctx.fillStyle = '#111827'; ctx.fillText(String(value ?? ''), x + 12, y + 33); x += widths[i]
      }); y += 52
    }
    drawRow(headers, true); body.forEach(row => drawRow(row)); y += 35
  }
  table('ค่าจอดรถ', ['ประเภทรายการ', 'วันที่', 'จำนวนรถ/คัน', 'เป็นเงิน (บาท)'], [...grouped.parking, ['รวมค่าจอดรถ', '', data.summary.count, money(data.summary.total)]])
  if (grouped.lost.length) table('บัตรหาย', ['ประเภทรายการ', 'วันที่', 'จำนวนรถ/คัน', 'เป็นเงิน (บาท)'], grouped.lost.map(row => [row[0], row[1], row[2], money(Number(row[3]))]))
  table('สรุปรวม', ['ประเภทรายการ', 'จำนวนรถ/คัน', 'เป็นเงิน (บาท)'], grouped.totals.map(row => [row[0], row[1], money(Number(row[2]))]))
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297)
  doc.save(`revenue-summary_${data.startDate.slice(0, 10)}_to_${data.endDate.slice(0, 10)}.pdf`)
}
