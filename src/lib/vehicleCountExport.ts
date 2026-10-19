import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'

export interface VehicleCountRow { date: string; vehicleType: string; reportType: string; parkingType: string; count: number }
export interface VehicleCountData { summary: VehicleCountRow[]; details: VehicleCountRow[]; from: string; to: string }
const dateLabel = (value: string) => new Date(value).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Bangkok' })
const tableRows = (rows: VehicleCountRow[]) => rows.map(row => [dateLabel(row.date), row.vehicleType, row.reportType, row.parkingType, row.count] as (string | number)[])

export function exportVehicleCountExcel(data: VehicleCountData) {
  const rows: (string | number)[][] = [
    ['รายงานจำนวนรถทั้งหมด'],
    [`ช่วงวันที่ ${dateLabel(data.from)} - ${dateLabel(data.to)}`], [],
    ['สรุปจำนวนรถ'], ['วันที่', 'ประเภทรถ', 'ประเภทรายการ', 'ประเภทการจอด', 'จำนวนคัน'],
    ...tableRows(data.summary),
  ]
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!cols'] = [{ wch: 16 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 14 }]
  const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'จำนวนรถทั้งหมด')
  XLSX.writeFile(workbook, `vehicle-count_${data.from.slice(0, 10)}_to_${data.to.slice(0, 10)}.xlsx`)
}

export function exportVehicleCountPDF(data: VehicleCountData) {
  const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 2200
  const ctx = canvas.getContext('2d')!; const font = getComputedStyle(document.body).fontFamily
  ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#111827'; ctx.textAlign = 'center'
  ctx.font = `bold 42px ${font}`; ctx.fillText('รายงานจำนวนรถทั้งหมด', 800, 65); ctx.font = `22px ${font}`; ctx.fillText(`ช่วงวันที่ ${dateLabel(data.from)} - ${dateLabel(data.to)}`, 800, 105)
  const drawTable = (title: string, rows: VehicleCountRow[], startY: number) => {
    const headers = ['วันที่', 'ประเภทรถ', 'ประเภทรายการ', 'ประเภทการจอด', 'จำนวนคัน']; const widths = [220, 360, 300, 300, 220]; const x0 = 70; const rowH = 48
    ctx.textAlign = 'left'; ctx.font = `bold 26px ${font}`; ctx.fillText(title, x0, startY); let y = startY + 18
    const draw = (values: (string | number)[], header = false) => { let x = x0; ctx.font = `${header ? 'bold ' : ''}20px ${font}`; values.forEach((value, i) => { ctx.fillStyle = header ? '#E5E7EB' : 'white'; ctx.fillRect(x, y, widths[i], rowH); ctx.strokeStyle = '#64748B'; ctx.strokeRect(x, y, widths[i], rowH); ctx.fillStyle = '#111827'; ctx.textAlign = i === 4 ? 'right' : 'left'; ctx.fillText(String(value), x + (i === 4 ? widths[i] - 12 : 8), y + 30); x += widths[i] }); y += rowH }
    draw(headers, true); for (const row of rows) draw([dateLabel(row.date), row.vehicleType, row.reportType, row.parkingType, row.count]); return y + 28
  }
  drawTable('สรุปจำนวนรถ', data.summary, 160)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true }); doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297); doc.save(`vehicle-count_${data.from.slice(0, 10)}_to_${data.to.slice(0, 10)}.pdf`)
}
