const LINE_PUSH_API = 'https://api.line.me/v2/bot/message/push'

export async function sendLineMessage(
  channelToken: string,
  targets: string[],
  message: string,
): Promise<void> {
  if (!channelToken || targets.length === 0) return
  await Promise.allSettled(
    targets.map(to =>
      fetch(LINE_PUSH_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${channelToken}`,
        },
        body: JSON.stringify({ to, messages: [{ type: 'text', text: message }] }),
      }),
    ),
  )
}

function thaiTime(date: Date): string {
  return date.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function buildShiftStartMessage(params: {
  operatorName: string
  startTime: Date
  openingFloat: number
  openingBreakdown: Record<string, number>
  carryoverByType: { car: number; motorcycle: number }
  carryoverByBilling: { carNormal: number; carOvernight: number; motorcycleNormal: number; motorcycleOvernight: number }
  temporaryCardsRemaining: { car: number; motorcycle: number }
}): string {
  const { operatorName, startTime, openingFloat, carryoverByBilling } = params
  const money = (amount: number) => amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return [
    '🟢 เปิดกะการทำงาน',
    `พนักงาน: ${operatorName}`,
    `เวลา: ${thaiTime(startTime)}`,
    '',
    `เงินต้นกะ: ${money(openingFloat)} บาท`,
    '',
    'จำนวนรถค้างในลาน',
    `รถยนต์: ${carryoverByBilling.carNormal} คัน`,
    `ค้างคืนรถยนต์: ${carryoverByBilling.carOvernight} คัน`,
    `รถจักรยานยนต์: ${carryoverByBilling.motorcycleNormal} คัน`,
    `ค้างคืนรถจักรยานยนต์: ${carryoverByBilling.motorcycleOvernight} คัน`,
    '',
    'จำนวนบัตรจอดรถคงเหลือ',
    `รถยนต์: ${params.temporaryCardsRemaining.car} ใบ`,
    `รถจักรยานยนต์: ${params.temporaryCardsRemaining.motorcycle} ใบ`,
  ].join('\n')
}

export function buildShiftEndMessage(params: {
  cardRefunds?: { amount: number; paymentMethod: string }[]
  operatorName: string
  startTime: Date
  endTime: Date
  checkinsCount: number
  checkoutsCount: number
  checkinsByType?: { car: number; motorcycle: number }
  checkoutsByType?: { car: number; motorcycle: number }
  checkoutsByBilling?: { carNormal: number; carOvernight: number; motorcycleNormal: number; motorcycleOvernight: number }
  cashAmount: number
  qrAmount: number
  totalAmount: number
  openingFloat: number
  closingFloat: number
  closingBreakdown: Record<string, number>
  closingCarCount: number
  closingByType: { car: number; motorcycle: number }
  closingByBilling?: { carNormal: number; carOvernight: number; motorcycleNormal: number; motorcycleOvernight: number }
  discountTotal?: number
  queuedByType: { car: number; motorcycle: number }
  lostCardsCount: number
  lostCardsFineTotal: number
  otherFines: { name: string; count: number; total: number }[]
  temporaryCardsRemaining: { car: number; motorcycle: number }
}): string {
  const {
    operatorName, startTime, endTime,
    checkinsCount, checkoutsCount, checkinsByType, checkoutsByType, checkoutsByBilling,
    cashAmount, qrAmount, totalAmount,
    openingFloat, closingFloat, closingByType, closingByBilling, discountTotal = 0,
  } = params
  const dur = Math.round((endTime.getTime() - startTime.getTime()) / 60000)
  const h = Math.floor(dur / 60)
  const m = dur % 60
  const money = (amount: number) => amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fineTotal = params.otherFines.reduce((sum, fine) => sum + fine.total, 0)
  const refundCash = params.cardRefunds?.filter(r => r.paymentMethod === 'cash').reduce((n, r) => n + r.amount, 0) ?? 0
  const refundQr = params.cardRefunds?.filter(r => r.paymentMethod === 'qr').reduce((n, r) => n + r.amount, 0) ?? 0
  return [
    '🔴 ปิดกะการทำงาน',
    `พนักงาน: ${operatorName}`,
    `เวลาเปิดกะ: ${thaiTime(startTime)}`,
    `เวลาปิดกะ: ${thaiTime(endTime)}`,
    `ระยะเวลา: ${h} ชม. ${m} นาที`,
    '',
    `เงินต้นกะ: ${money(openingFloat)} บาท`,
    '',
    `เงินปิดกะ: ${money(closingFloat)} บาท`,
    '',
    'ค่าปรับในกะนี้:',
    ...(params.otherFines.length ? params.otherFines.map(fine => `${fine.name}: ${fine.count} รายการ = ${money(fine.total)} บาท`) : ['ไม่มีค่าปรับ']),
    `รวมค่าปรับ: ${money(fineTotal)} บาท`,
    '',
    'ส่วนลดในกะนี้:',
    ...(discountTotal > 0 ? [`ส่วนลดรวม: ${money(discountTotal)} บาท`] : ['ไม่มีส่วนลด']),
    `รวมส่วนลด: ${money(discountTotal)} บาท`,
    '',
    `บัตรหายในกะนี้: ${params.lostCardsCount} ใบ`,
    `รวมค่าปรับบัตรหาย: ${money(params.lostCardsFineTotal)} บาท`,
    `คืนค่าปรับบัตรหาย: ${params.cardRefunds?.length ?? 0} ใบ`,
    `คืนเงินสด: ${money(refundCash)} บาท`,
    `คืนเงินโอน: ${money(refundQr)} บาท`,
    '',
    `รวมสุทธิ: ${money(totalAmount)} บาท`,
    `เงินสดสุทธิ: ${money(cashAmount)} บาท`,
    `เงินโอนสุทธิ: ${money(qrAmount)} บาท`,
    '',
    'รถเข้า:',
    `รถยนต์: ${checkinsByType?.car ?? checkinsCount} คัน`,
    `รถจักรยานยนต์: ${checkinsByType?.motorcycle ?? 0} คัน`,
    '',
    'รถออก:',
    `รถยนต์: ${checkoutsByBilling?.carNormal ?? checkoutsByType?.car ?? checkoutsCount} คัน`,
    `ค้างคืนรถยนต์: ${checkoutsByBilling?.carOvernight ?? 0} คัน`,
    `รถจักรยานยนต์: ${checkoutsByBilling?.motorcycleNormal ?? checkoutsByType?.motorcycle ?? 0} คัน`,
    `ค้างคืนรถจักรยานยนต์: ${checkoutsByBilling?.motorcycleOvernight ?? 0} คัน`,
    '',
    'รถเข้าคิวรอในกะนี้:',
    `รถยนต์: ${params.queuedByType.car} คัน`,
    `รถจักรยานยนต์: ${params.queuedByType.motorcycle} คัน`,
    '',
    'จำนวนรถค้างในลาน',
    `รถยนต์: ${closingByBilling?.carNormal ?? closingByType.car} คัน`,
    `ค้างคืนรถยนต์: ${closingByBilling?.carOvernight ?? 0} คัน`,
    `รถจักรยานยนต์: ${closingByBilling?.motorcycleNormal ?? closingByType.motorcycle} คัน`,
    `ค้างคืนรถจักรยานยนต์: ${closingByBilling?.motorcycleOvernight ?? 0} คัน`,
    '',
    'จำนวนบัตรจอดรถคงเหลือ',
    `รถยนต์: ${params.temporaryCardsRemaining.car} ใบ`,
    `รถจักรยานยนต์: ${params.temporaryCardsRemaining.motorcycle} ใบ`,
  ].join('\n')
}
