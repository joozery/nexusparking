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
  temporaryCardsRemaining: { car: number; motorcycle: number }
}): string {
  const { operatorName, startTime, openingFloat, openingBreakdown, carryoverByType } = params
  const money = (amount: number) => amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const denominations = Object.entries(openingBreakdown)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([value, count]) => `${Number(value).toLocaleString('th-TH')} บาท × ${count} = ${money(Number(value) * count)} บาท`)
  return [
    '🟢 เปิดกะการทำงาน',
    `พนักงาน: ${operatorName}`,
    `เวลา: ${thaiTime(startTime)}`,
    '─────────────────',
    `เงินต้นกะ: ${money(openingFloat)} บาท`,
    'รายละเอียดเงินที่กรอก:',
    ...(denominations.length ? denominations : ['ไม่ได้ระบุจำนวนธนบัตร/เหรียญ']),
    '─────────────────',
    'รถค้างในลานตอนเปิดกะ',
    `รถยนต์: ${carryoverByType.car} คัน`,
    `มอเตอร์ไซค์: ${carryoverByType.motorcycle} คัน`,
    ...(carryoverByType.car + carryoverByType.motorcycle > 0
      ? [`รวม: ${carryoverByType.car + carryoverByType.motorcycle} คัน`] : []),
    '─────────────────',
    'บัตรชั่วคราวคงเหลือตอนเปิดกะ',
    `รถยนต์: ${params.temporaryCardsRemaining.car} ใบ`,
    `มอเตอร์ไซค์: ${params.temporaryCardsRemaining.motorcycle} ใบ`,
    `รวม: ${params.temporaryCardsRemaining.car + params.temporaryCardsRemaining.motorcycle} ใบ`,
  ].join('\n')
}

export function buildShiftEndMessage(params: {
  operatorName: string
  startTime: Date
  endTime: Date
  checkinsCount: number
  checkoutsCount: number
  cashAmount: number
  qrAmount: number
  totalAmount: number
  openingFloat: number
  closingFloat: number
  closingBreakdown: Record<string, number>
  closingCarCount: number
  closingByType: { car: number; motorcycle: number }
  queuedByType: { car: number; motorcycle: number }
  lostCardsCount: number
  lostCardsFineTotal: number
  otherFines: { name: string; count: number; total: number }[]
  temporaryCardsRemaining: { car: number; motorcycle: number }
}): string {
  const {
    operatorName, startTime, endTime,
    checkinsCount, checkoutsCount,
    cashAmount, qrAmount, totalAmount,
    openingFloat, closingFloat, closingCarCount, closingBreakdown, closingByType,
  } = params
  const dur = Math.round((endTime.getTime() - startTime.getTime()) / 60000)
  const h = Math.floor(dur / 60)
  const m = dur % 60
  const money = (amount: number) => amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const denominations = Object.entries(closingBreakdown)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([value, count]) => `${Number(value).toLocaleString('th-TH')} บาท × ${count} = ${money(Number(value) * count)} บาท`)
  return [
    '🔴 ปิดกะการทำงาน',
    `พนักงาน: ${operatorName}`,
    `เวลาเปิดกะ: ${thaiTime(startTime)}`,
    `เวลาปิดกะ: ${thaiTime(endTime)}`,
    `ระยะเวลา: ${h} ชม. ${m} นาที`,
    '─────────────────',
    `เงินต้นกะ:   ฿${openingFloat.toLocaleString()}`,
    'รายละเอียดเงินส่งคืนที่กรอก:',
    ...(denominations.length ? denominations : ['ไม่ได้ระบุจำนวนธนบัตร/เหรียญ']),
    `ยอดเงินส่งคืนรวม: ${money(closingFloat)} บาท`,
    '─────────────────',
    `Check-in:  ${checkinsCount} คัน`,
    `Check-out: ${checkoutsCount} คัน`,
    ...(params.lostCardsCount > 0 || params.lostCardsFineTotal > 0 ? [
      `บัตรหายในกะนี้: ${params.lostCardsCount} ใบ`,
      `ค่าปรับบัตรหายรวม: ${money(params.lostCardsFineTotal)} บาท`,
    ] : []),
    ...(params.otherFines.length ? [
      '⚠️ ค่าปรับอื่นในกะนี้',
      ...params.otherFines.map(fine => `${fine.name}: ${fine.count} รายการ = ${money(fine.total)} บาท`),
      `รวมค่าปรับอื่น: ${money(params.otherFines.reduce((sum, fine) => sum + fine.total, 0))} บาท`,
    ] : []),
    'รถเข้าคิวรอในกะนี้ (รวมทุกสถานะ)',
    `รถยนต์: ${params.queuedByType.car} คัน`,
    `มอเตอร์ไซค์: ${params.queuedByType.motorcycle} คัน`,
    ...(params.queuedByType.car + params.queuedByType.motorcycle > 0
      ? [`รวม: ${params.queuedByType.car + params.queuedByType.motorcycle} คัน`] : []),
    `รายรับเงินสด: ฿${cashAmount.toLocaleString()}`,
    `รายรับ QR:    ฿${qrAmount.toLocaleString()}`,
    `รวมทั้งหมด:   ฿${totalAmount.toLocaleString()}`,
    '─────────────────',
    'รถค้างในลานตอนปิดกะ',
    `รถยนต์: ${closingByType.car} คัน`,
    `มอเตอร์ไซค์: ${closingByType.motorcycle} คัน`,
    ...(closingCarCount > 0 ? [`รวม: ${closingCarCount} คัน`] : []),
    '─────────────────',
    'บัตรชั่วคราวคงเหลือตอนปิดกะ',
    `รถยนต์: ${params.temporaryCardsRemaining.car} ใบ`,
    `มอเตอร์ไซค์: ${params.temporaryCardsRemaining.motorcycle} ใบ`,
    `รวม: ${params.temporaryCardsRemaining.car + params.temporaryCardsRemaining.motorcycle} ใบ`,
  ].join('\n')
}
