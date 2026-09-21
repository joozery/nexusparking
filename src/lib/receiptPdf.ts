'use client'
import { parkingDuration } from './parkingDuration'

export async function downloadReceiptPdf(sessionId: string) {
  const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/receipt`, { cache: 'no-store' })
  const s = await res.json()
  if (!res.ok) throw new Error(s.error ?? 'โหลดใบเสร็จไม่สำเร็จ')
  const { jsPDF } = await import('jspdf')
  await document.fonts.ready
  const logo = new Image()
  logo.src = '/logo/receipt-logo.png'
  await logo.decode()
  const money = (value: number) => Number(value ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 }) + ' บาท'
  const date = (value: string) => new Date(value).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
  const lines = [
    'A20 Park', 'ใบเสร็จรับเงินค่าจอดรถ',
    `ทะเบียน ${s.plate}`,
    `ประเภทรถ ${{ car: 'รถยนต์', motorcycle: 'รถจักรยานยนต์', overnight: 'รถยนต์ (ค้างคืน)' }[s.cardType as string] ?? s.cardType}`,
    '---',
    `เวลาเข้า ${date(s.entryTime)}`, `เวลาออก ${date(s.exitTime)}`,
    '---',
    `เวลาจอด ${parkingDuration(s.entryTime, s.exitTime)}`,
    `ค่าจอดรถ ${money(s.fee)}`, `ส่วนลด ${money(s.discountAmount)}`,
    `ค่าปรับ ${money(Number(s.fineAmount ?? 0) + Number(s.lostFine ?? 0))}`,
    `ยอดชำระสุทธิ ${money(s.totalFee)}`,
    `ชำระโดย ${s.paymentMethod === 'qr' ? 'โอน / QR' : 'เงินสด'}`,
    '---',
    'หากมีข้อสงสัยหรือต้องการ',
    'สอบถามข้อมูลเพิ่มเติม',
    'โทร.086-555-7634 Line:@A20PARK',
    'ขอบคุณที่ใช้บริการครับ',
  ]
  // Browser text rendering preserves Thai vowels and tone marks in the PDF image.
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 1500 // 80 x 100 mm at 15 pixels per mm
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('สร้างใบเสร็จ PDF ไม่สำเร็จ')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const logoWidth = 500
  const logoTop = 25
  const logoHeight = logoWidth * logo.naturalHeight / logo.naturalWidth
  ctx.drawImage(logo, (canvas.width - logoWidth) / 2, logoTop, logoWidth, logoHeight)
  ctx.fillStyle = '#111'
  const fontFor = (line: string, index: number) => `${index < 2 || line.startsWith('ยอดชำระสุทธิ') ? 'bold ' : ''}52px sans-serif`
  const metrics = lines.map((line, index) => {
    if (line === '---') return { ascent: 1, height: 2 }
    ctx.font = fontFor(line, index)
    const size = ctx.measureText(line)
    return { ascent: size.actualBoundingBoxAscent, height: size.actualBoundingBoxAscent + size.actualBoundingBoxDescent }
  })
  const contentTop = logoTop + logoHeight + 20
  const contentBottom = canvas.height - 45
  const rowGap = (contentBottom - contentTop - metrics.reduce((sum, row) => sum + row.height, 0)) / (lines.length - 1)
  let cursorY = contentTop
  lines.forEach((line, index) => {
    const y = cursorY + metrics[index].ascent
    cursorY += metrics[index].height + rowGap
    if (line === '---') {
      ctx.save()
      ctx.setLineDash([12, 8])
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(60, y)
      ctx.lineTo(1140, y)
      ctx.stroke()
      ctx.restore()
      return
    }
    ctx.font = fontFor(line, index)
    if (index < 2 || index >= lines.length - 4) {
      ctx.textAlign = 'center'
      ctx.fillText(line, 600, y, 1080)
    } else {
      const split = line.indexOf(' ')
      ctx.textAlign = 'left'
      ctx.fillText(line.slice(0, split), 60, y, 330)
      ctx.textAlign = 'right'
      ctx.fillText(line.slice(split + 1), 1140, y, 710)
    }
  })
  const pdf = new jsPDF({ unit: 'mm', format: [80, 100] })
  pdf.setProperties({ title: `Receipt ${s._id}`, author: 'A20 Park' })
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 80, 100)
  pdf.save(`receipt-${s._id}.pdf`)
}
