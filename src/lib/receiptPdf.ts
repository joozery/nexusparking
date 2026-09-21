'use client'

export async function downloadReceiptPdf(sessionId: string) {
  const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/receipt`, { cache: 'no-store' })
  const s = await res.json()
  if (!res.ok) throw new Error(s.error ?? 'โหลดใบเสร็จไม่สำเร็จ')
  const { jsPDF } = await import('jspdf')
  await document.fonts.ready
  const money = (value: number) => Number(value ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 }) + ' บาท'
  const date = (value: string) => new Date(value).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
  const lines = [
    'A20 Park', 'ใบเสร็จรับเงินค่าจอดรถ', `เลขที่ ${s._id}`,
    `ทะเบียน ${s.plate}`, `บัตร ${s.cardUid}`,
    `เวลาเข้า ${date(s.entryTime)}`, `เวลาออก ${date(s.exitTime)}`,
    `ค่าจอดรถ ${money(s.fee)}`, `ส่วนลด ${money(s.discountAmount)}`,
    `ค่าปรับ ${money(s.fineAmount)}`, `ค่าบัตรหาย ${money(s.lostFine)}`,
    `ยอดรับสุทธิ ${money(s.totalFee)}`,
    `ชำระโดย ${s.paymentMethod === 'qr' ? 'โอน / QR' : 'เงินสด'}`,
    'ขอบคุณที่ใช้บริการ',
  ]
  // Browser text rendering preserves Thai vowels and tone marks in the PDF image.
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 1500
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('สร้างใบเสร็จ PDF ไม่สำเร็จ')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#111'
  lines.forEach((line, index) => {
    ctx.font = `${index < 2 || index === 11 ? 'bold ' : ''}36px sans-serif`
    ctx.fillText(line, 70, 110 + index * 88, 1060)
  })
  const pdf = new jsPDF({ unit: 'mm', format: [100, 125] })
  pdf.setProperties({ title: `Receipt ${s._id}`, author: 'A20 Park' })
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 100, 125)
  pdf.save(`receipt-${s._id}.pdf`)
}
