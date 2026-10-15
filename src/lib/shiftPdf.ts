'use client'

import type { VehicleCounts } from './shiftVehicleCounts'

interface ShiftPdfData {
  _id: string
  operatorName: string
  startTime: string
  endTime?: string
  openingFloat: number
  closingFloat: number
  checkinsCount: number
  checkoutsCount: number
  checkinsByType?: VehicleCounts
  checkoutsByType?: VehicleCounts
  carryoverByType?: VehicleCounts
  carryoverByBilling?: { carNormal: number; carOvernight: number; motorcycleNormal: number; motorcycleOvernight: number }
  closingByBilling?: { carNormal: number; carOvernight: number; motorcycleNormal: number; motorcycleOvernight: number }
  closingByType?: VehicleCounts
  openingCardsByType?: VehicleCounts
  closingCardsByType?: VehicleCounts
  openingBreakdown?: Record<string, number>
  closingBreakdown?: Record<string, number>
}

export async function downloadShiftPdf(shift: ShiftPdfData, opening: boolean) {
  const { jsPDF } = await import('jspdf')
  await document.fonts.ready
  const logo = new Image()
  logo.src = '/logo/receipt-logo.png'
  await logo.decode()

  const money = (value: number) => `${Number(value ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`
  const date = (value?: string) => value ? new Date(value).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-'
  const count = (counts: VehicleCounts | undefined, type: keyof VehicleCounts) => counts?.[type] ?? 0
  const breakdownLines = (value?: Record<string, number>) => {
    const entries = Object.entries(value ?? {})
      .filter(([, amount]) => Number(amount) > 0)
      .sort(([a], [b]) => Number(b) - Number(a))
    if (!entries.length) return ['-']

    const rows = entries.map(([denom, amount]) => {
      const unit = Number(denom)
      const count = Number(amount)
      const left = `${unit.toLocaleString('th-TH')}*${count.toLocaleString('th-TH')}`
      const total = (unit * count).toLocaleString('th-TH')
      return { left, total }
    })
    const width = Math.max(...rows.map(row => row.left.length))
    return rows.map(row => `${row.left.padEnd(width, ' ')} = ${row.total}`)
  }
  const remaining = opening ? shift.carryoverByType : shift.closingByType
  const carryoverByBilling = shift.carryoverByBilling
  const closingByBilling = shift.closingByBilling
  const cardsRemaining = opening ? shift.openingCardsByType : shift.closingCardsByType
  const lines = opening ? [
    'A20 Park', 'ใบเปิดกะ', `พนักงาน ${shift.operatorName}`,
    `เวลาเปิดกะ ${date(shift.startTime)}`, '---',
    `เงินต้นกะ ${money(shift.openingFloat)}`,
    'รายละเอียด', ...breakdownLines(shift.openingBreakdown), '---',
    'จำนวนรถค้างในลาน',
    `รถยนต์ ${carryoverByBilling?.carNormal ?? count(remaining, 'car')} คัน`,
    `ค้างคืนรถยนต์ ${carryoverByBilling?.carOvernight ?? 0} คัน`,
    `รถจักรยานยนต์ ${carryoverByBilling?.motorcycleNormal ?? count(remaining, 'motorcycle')} คัน`,
    `ค้างคืนรถจักรยานยนต์ ${carryoverByBilling?.motorcycleOvernight ?? 0} คัน`,
    '---',
    'จำนวนบัตรจอดรถคงเหลือ',
    `รถยนต์ ${count(cardsRemaining, 'car')} ใบ`,
    `รถจักรยานยนต์ ${count(cardsRemaining, 'motorcycle')} ใบ`,
    '', '',
    'ลงชื่อ ____________________',
  ] : [
    'A20 Park', 'ใบปิดกะ', `พนักงาน ${shift.operatorName}`,
    `เวลาเปิดกะ ${date(shift.startTime)}`, `เวลาปิดกะ ${date(shift.endTime)}`, '---',
    `เงินส่งคืน ${money(shift.closingFloat)}`,
    'รายละเอียด', ...breakdownLines(shift.closingBreakdown), '---',
    'จำนวนรถยนต์ค้างในลาน',
    `รถยนต์ ${closingByBilling?.carNormal ?? count(remaining, 'car')} คัน`,
    `ค้างคืนรถยนต์ ${closingByBilling?.carOvernight ?? 0} คัน`,
    `รถจักรยานยนต์ ${closingByBilling?.motorcycleNormal ?? count(remaining, 'motorcycle')} คัน`,
    `ค้างคืนรถจักรยานยนต์ ${closingByBilling?.motorcycleOvernight ?? 0} คัน`,
    '---',
    'จำนวนบัตรจอดรถคงเหลือ',
    `รถยนต์ ${count(cardsRemaining, 'car')} ใบ`,
    `รถจักรยานยนต์ ${count(cardsRemaining, 'motorcycle')} ใบ`,
  ]

  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 1800
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('สร้างใบกะ PDF ไม่สำเร็จ')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const logoWidth = 500
  const logoTop = 25
  const logoHeight = logoWidth * logo.naturalHeight / logo.naturalWidth
  ctx.drawImage(logo, (canvas.width - logoWidth) / 2, logoTop, logoWidth, logoHeight)
  ctx.fillStyle = '#111'
  const fontFor = (line: string, index: number) => `${index < 2 ? 'bold ' : ''}48px ${line.includes(' = ') ? 'monospace' : 'sans-serif'}`
  const isHeading = (line: string) => ['รายละเอียด', 'จำนวนรถค้างในลาน', 'จำนวนรถยนต์ค้างในลาน', 'จำนวนบัตรจอดรถคงเหลือ'].includes(line)
  const isSignature = (line: string) => line.startsWith('ลงชื่อ ')
  const metrics = lines.map((line, index) => {
    if (line === '---') return { ascent: 1, height: 2 }
    if (!line) return { ascent: 0, height: 0 }
    ctx.font = fontFor(line, index)
    const size = ctx.measureText(line)
    return { ascent: size.actualBoundingBoxAscent, height: size.actualBoundingBoxAscent + size.actualBoundingBoxDescent }
  })
  const contentTop = logoTop + logoHeight + 20
  const contentBottom = canvas.height - 35
  const rowGap = (contentBottom - contentTop - metrics.reduce((sum, row) => sum + row.height, 0)) / Math.max(1, lines.length - 1)
  let cursorY = contentTop
  lines.forEach((line, index) => {
    const y = cursorY + metrics[index].ascent
    cursorY += metrics[index].height + rowGap
    if (line === '---') {
      ctx.save(); ctx.setLineDash([12, 8]); ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(1140, y); ctx.stroke(); ctx.restore()
      return
    }
    if (!line) return
    ctx.font = fontFor(line, index)
    if (index < 2) {
      ctx.textAlign = 'center'; ctx.fillText(line, 600, y, 1080)
    } else if (isHeading(line)) {
      ctx.textAlign = 'left'; ctx.fillText(line, 60, y, 1080)
    } else if (isSignature(line)) {
      ctx.textAlign = 'right'; ctx.fillText(line, 1140, y, 1080)
    } else if (line.includes(' = ')) {
      // Keep the whole denomination row left-aligned so the padded '=' stays
      // in one column instead of right-aligning the result independently.
      ctx.textAlign = 'left'; ctx.fillText(line, 60, y, 1080)
    } else {
      const split = line.indexOf(' ')
      ctx.textAlign = 'left'; ctx.fillText(line.slice(0, split), 60, y, 420)
      ctx.textAlign = 'right'; ctx.fillText(line.slice(split + 1), 1140, y, 620)
    }
  })
  const pdf = new jsPDF({ unit: 'mm', format: [80, 120] })
  pdf.setProperties({ title: opening ? 'Opening Shift' : 'Closing Shift', author: 'A20 Park' })
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 80, 120)
  pdf.save(`${opening ? 'opening' : 'closing'}-shift-${shift._id}.pdf`)
}
