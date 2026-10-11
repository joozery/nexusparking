import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'

export interface RevenueSummaryDailyRow {
  _id: string
  total: number
  count: number
  lostFines: number
  lostCardCount: number
  cash?: number
  transfer?: number
  lostFineCash?: number
  lostFineTransfer?: number
  lostFineRefunds?: number
  lostFineRefundCount?: number
}

export interface RevenueSummaryData {
  startDate: string
  endDate: string
  daily: RevenueSummaryDailyRow[]
  summary: { total: number; count: number; cash: number; transfer: number; lostFines: number; lostCardCount: number; lostFineRefunds: number; lostFineRefundCount: number }
}

const money = (value: number) => Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dateLabel = (value: string) => new Date(value).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })

// The export total must reconcile with the daily rows shown in the export.
// The API summary can include refund adjustments at a different level.
function displayedParkingTotals(data: RevenueSummaryData) {
  return data.daily.reduce((totals, row) => {
    totals.cash += (row.cash ?? 0) - (row.lostFineCash ?? 0)
    totals.transfer += (row.transfer ?? 0) - (row.lostFineTransfer ?? 0)
    totals.total += row.total - row.lostFines
    return totals
  }, { cash: 0, transfer: 0, total: 0 })
}

function rows(data: RevenueSummaryData) {
  const parking = data.daily.map(row => ['ค่าจอดรถ', dateLabel(row._id), row.count, row.total - row.lostFines])
  const lost = data.daily.filter(row => row.lostFines > 0).map(row => ['บัตรหาย', dateLabel(row._id), '', row.lostFines])
  const parkingWithPayment = data.daily.map(row => ['ค่าจอดรถ', dateLabel(row._id), row.count, (row.cash ?? 0) - (row.lostFineCash ?? 0), (row.transfer ?? 0) - (row.lostFineTransfer ?? 0), row.total - row.lostFines])
  const totals = [
    ['ค่าจอดรถ', data.summary.count, data.summary.total - data.summary.lostFines],
    ['บัตรหาย', '', data.summary.lostFines],
    ['รวมทั้งหมด', data.summary.count, data.summary.total],
  ]
  totals[0][2] = data.summary.total
  const lostWithCount = data.daily.filter(row => row.lostFines > 0)
    .map(row => ['\u0e1a\u0e31\u0e15\u0e23\u0e2b\u0e32\u0e22', dateLabel(row._id), row.lostCardCount, row.lostFines])
  const refunds = data.daily.some(row => (row.lostFineRefunds ?? 0) > 0)
    ? data.daily.filter(row => (row.lostFineRefunds ?? 0) > 0)
      .map(row => ['\u0e04\u0e37\u0e19\u0e04\u0e48\u0e32\u0e1b\u0e23\u0e31\u0e1a\u0e1a\u0e31\u0e15\u0e23\u0e2b\u0e32\u0e22', dateLabel(row._id), row.lostFineRefundCount ?? 0, -(row.lostFineRefunds ?? 0)])
    : [['\u0e04\u0e37\u0e19\u0e04\u0e48\u0e32\u0e1b\u0e23\u0e31\u0e1a\u0e1a\u0e31\u0e15\u0e23\u0e2b\u0e32\u0e22', '', data.summary.lostFineRefundCount, -(data.summary.lostFineRefunds ?? 0)]]
  const lostRows = lostWithCount.length
    ? [...lostWithCount, ['รวมบัตรหาย', '', data.summary.lostCardCount, data.summary.lostFines]]
    : []
  const refundRows = (data.summary.lostFineRefundCount ?? 0) > 0
    ? [...refunds, ['รวมคืนค่าปรับบัตรหาย', '', data.summary.lostFineRefundCount, -(data.summary.lostFineRefunds ?? 0)]]
    : []
  const totalsWithCount = [...totals]
  void parking
  void lost
  totalsWithCount.splice(1, 1)
  totalsWithCount.splice(1, 0, ['\u0e04\u0e48\u0e32\u0e1b\u0e23\u0e31\u0e1a\u0e1a\u0e31\u0e15\u0e23\u0e2b\u0e32\u0e22', data.summary.lostCardCount, data.summary.lostFines])
  totalsWithCount.splice(2, 0, ['\u0e04\u0e37\u0e19\u0e04\u0e48\u0e32\u0e1b\u0e23\u0e31\u0e1a\u0e1a\u0e31\u0e15\u0e23\u0e2b\u0e32\u0e22', data.summary.lostFineRefundCount, -(data.summary.lostFineRefunds ?? 0)])
  return { parking: parkingWithPayment, lost: lostRows, refunds: refundRows, totals: totalsWithCount }
}

export function exportRevenueSummaryExcel(data: RevenueSummaryData) {
  const parkingTotals = displayedParkingTotals(data)
  data = { ...data, summary: { ...data.summary, cash: parkingTotals.cash, transfer: parkingTotals.transfer, total: parkingTotals.total } }
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
  if (grouped.refunds.length) sheetRows.splice(sheetRows.length - (grouped.totals.length + 2), 0, [], ['ประเภทการคืนค่าปรับบัตรหาย', 'วันที่', 'จำนวนรถ/คัน', 'เป็นเงิน (บาท)'], ...grouped.refunds)
  sheetRows[3] = ['ประเภทรายการ', 'วันที่', 'จำนวนรถ/คัน', 'เงินสด', 'เงินโอน', 'เป็นเงิน (บาท)']
  const parkingTotalIndex = 4 + grouped.parking.length
  sheetRows[parkingTotalIndex] = ['รวมค่าจอดรถ', '', data.summary.count, data.summary.cash, data.summary.transfer, data.summary.total]
  const ws = XLSX.utils.aoa_to_sheet(sheetRows)
  ws['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 20 }]
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'รายงานสรุป')
  XLSX.writeFile(wb, `revenue-summary_${data.startDate.slice(0, 10)}_to_${data.endDate.slice(0, 10)}.xlsx`)
}

export function exportRevenueSummaryPDF(data: RevenueSummaryData) {
  const parkingTotals = displayedParkingTotals(data)
  data = { ...data, summary: { ...data.summary, cash: parkingTotals.cash, transfer: parkingTotals.transfer, total: parkingTotals.total } }
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
    const columnCount = Math.max(headers.length, body[0]?.length ?? 0)
    const widths = columnCount === 6 ? [260, 240, 240, 220, 220, 300] : headers.length === 4 ? [320, 330, 300, 360] : [650, 300, 360]
    const renderedHeaders = columnCount === 6 ? [...headers.slice(0, 3), 'เงินสด', 'เงินโอน', headers[3]] : headers
    const renderedBody = columnCount === 6
      ? body.map(row => row.length === 4 ? [row[0], row[1], row[2], data.summary.cash, data.summary.transfer, row[3]] : row)
      : body
    const drawRow = (values: (string | number)[], header = false) => {
      let x = 80; ctx.font = `${header ? 'bold ' : ''}22px ${font}`
      values.forEach((value, i) => {
        ctx.fillStyle = header ? '#E5E7EB' : '#fff'; ctx.fillRect(x, y, widths[i], 52)
        ctx.strokeStyle = '#4B5563'; ctx.strokeRect(x, y, widths[i], 52)
        ctx.fillStyle = '#111827'; ctx.fillText(String(value ?? ''), x + 12, y + 33); x += widths[i]
      }); y += 52
    }
    drawRow(renderedHeaders, true); renderedBody.forEach(row => drawRow(row)); y += 35
  }
  table('ค่าจอดรถ', ['ประเภทรายการ', 'วันที่', 'จำนวนรถ/คัน', 'เป็นเงิน (บาท)'], [...grouped.parking, ['รวมค่าจอดรถ', '', data.summary.count, money(data.summary.total)]])
  if (grouped.lost.length) table('บัตรหาย', ['ประเภทรายการ', 'วันที่', 'จำนวนรถ/คัน', 'เป็นเงิน (บาท)'], grouped.lost.map(row => [row[0], row[1], row[2], money(Number(row[3]))]))
  if (grouped.refunds.length) table('คืนค่าปรับบัตรหาย', ['ประเภทรายการ', 'วันที่', 'จำนวนรถ/คัน', 'เป็นเงิน (บาท)'], grouped.refunds.map(row => [row[0], row[1], row[2], money(Number(row[3]))]))
  table('สรุปรวม', ['ประเภทรายการ', 'จำนวนรถ/คัน', 'เป็นเงิน (บาท)'], grouped.totals.map(row => [row[0], row[1], money(Number(row[2]))]))
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297)
  doc.save(`revenue-summary_${data.startDate.slice(0, 10)}_to_${data.endDate.slice(0, 10)}.pdf`)
}
