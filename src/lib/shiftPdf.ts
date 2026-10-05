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
  const breakdown = (value?: Record<string, number>) => Object.entries(value ?? {}).map(([denom, amount]) => `${denom} บาท x ${amount}`).join(', ') || '-'
  const remaining = opening ? shift.carryoverByType : shift.closingByType
  const cardsRemaining = opening ? shift.openingCardsByType : shift.closingCardsByType
  const lines = opening ? [
    'A20 Park', 'ใบเปิดกะ', `พนักงาน ${shift.operatorName}`,
    `เวลาเปิดกะ ${date(shift.startTime)}`, '---',
    `เงินต้นกะ ${money(shift.openingFloat)}`,
    `รายละเอียดธนบัตร ${breakdown(shift.openingBreakdown)}`, '---',
    `รถยนต์ค้าง ${count(remaining, 'car')} คัน`,
    `รถจักรยานยนต์ค้าง ${count(remaining, 'motorcycle')} คัน`,
    `บัตรจอดรถคงเหลือ รถยนต์ ${count(cardsRemaining, 'car')} ใบ`,
    `บัตรจอดรถคงเหลือ รถจักรยานยนต์ ${count(cardsRemaining, 'motorcycle')} ใบ`,
  ] : [
    'A20 Park', 'ใบปิดกะ', `พนักงาน ${shift.operatorName}`,
    `เวลาเปิดกะ ${date(shift.startTime)}`, `เวลาปิดกะ ${date(shift.endTime)}`, '---',
    `รถเข้า ${shift.checkinsCount} คัน`, `รถออก ${shift.checkoutsCount} คัน`,
    `เงินส่งคืน ${money(shift.closingFloat)}`,
    `รายละเอียดธนบัตร ${breakdown(shift.closingBreakdown)}`, '---',
    `รถยนต์ค้าง ${count(remaining, 'car')} คัน`,
    `รถจักรยานยนต์ค้าง ${count(remaining, 'motorcycle')} คัน`,
    `บัตรจอดรถคงเหลือ รถยนต์ ${count(cardsRemaining, 'car')} ใบ`,
    `บัตรจอดรถคงเหลือ รถจักรยานยนต์ ${count(cardsRemaining, 'motorcycle')} ใบ`,
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
  const fontFor = (line: string, index: number) => `${index < 2 ? 'bold ' : ''}48px sans-serif`
  const metrics = lines.map((line, index) => {
    if (line === '---') return { ascent: 1, height: 2 }
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
    ctx.font = fontFor(line, index)
    if (index < 2) {
      ctx.textAlign = 'center'; ctx.fillText(line, 600, y, 1080)
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
