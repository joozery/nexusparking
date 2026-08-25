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

export function buildShiftStartMessage(operatorName: string, startTime: Date, carryoverCars: number): string {
  return [
    '🟢 เปิดกะการทำงาน',
    `พนักงาน: ${operatorName}`,
    `เวลา: ${thaiTime(startTime)}`,
    `รถค้างในลาน: ${carryoverCars} คัน`,
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
  closingCarCount: number
}): string {
  const {
    operatorName, startTime, endTime,
    checkinsCount, checkoutsCount,
    cashAmount, qrAmount, totalAmount,
    openingFloat, closingFloat, closingCarCount,
  } = params
  const dur = Math.round((endTime.getTime() - startTime.getTime()) / 60000)
  const h = Math.floor(dur / 60)
  const m = dur % 60
  return [
    '🔴 ปิดกะการทำงาน',
    `พนักงาน: ${operatorName}`,
    `เวลา: ${thaiTime(startTime)} — ${thaiTime(endTime)}`,
    `ระยะเวลา: ${h} ชม. ${m} นาที`,
    '─────────────────',
    `Check-in:  ${checkinsCount} คัน`,
    `Check-out: ${checkoutsCount} คัน`,
    `รายรับเงินสด: ฿${cashAmount.toLocaleString()}`,
    `รายรับ QR:    ฿${qrAmount.toLocaleString()}`,
    `รวมทั้งหมด:   ฿${totalAmount.toLocaleString()}`,
    '─────────────────',
    `เงินต้นกะ:   ฿${openingFloat.toLocaleString()}`,
    `เงินส่งคืน:  ฿${closingFloat.toLocaleString()}`,
    `รถค้างปิดกะ: ${closingCarCount} คัน`,
  ].join('\n')
}
