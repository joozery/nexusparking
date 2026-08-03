export type CardType = 'car' | 'motorcycle' | 'overnight'

function ceilHours(minutes: number) {
  return Math.ceil(minutes / 60)
}

// คำนวณนาทีที่อยู่นอกช่วง 18:00–07:00 (ใช้สำหรับ overnight)
function overtimeMinutes(entryTime: Date, exitTime: Date): number {
  let extra = 0

  // เข้าก่อน 18:00 → นับนาทีตั้งแต่เข้าจนถึง 18:00
  const entryH = entryTime.getHours() * 60 + entryTime.getMinutes()
  const windowStart = 18 * 60 // 18:00
  if (entryH < windowStart) {
    extra += windowStart - entryH
  }

  // ออกหลัง 07:00 → นับนาทีตั้งแต่ 07:00 จนถึงออก
  const exitH = exitTime.getHours() * 60 + exitTime.getMinutes()
  const windowEnd = 7 * 60 // 07:00
  // ถ้าออกวันเดียวกับเข้า (ไม่ข้ามวัน) ให้นับแค่ถ้าออกหลัง 18:00 (ไม่เข้าช่วง overnight)
  const sameDay = entryTime.toDateString() === exitTime.toDateString()
  if (!sameDay && exitH > windowEnd) {
    extra += exitH - windowEnd
  }

  return extra
}

export function calcFeeFromMinutes(
  type: CardType,
  minutes: number,
  entryTime?: Date,
  exitTime?: Date,
): number {
  const hours = ceilHours(minutes)

  if (type === 'car') {
    return hours <= 1 ? 30 : 30 + (hours - 1) * 20
  }
  if (type === 'motorcycle') {
    return hours <= 1 ? 20 : 20 + (hours - 1) * 10
  }

  // overnight
  if (!entryTime || !exitTime) return 100 // fallback ถ้าไม่มีเวลา
  const extraMin  = overtimeMinutes(entryTime, exitTime)
  const extraHrs  = ceilHours(extraMin)
  return 100 + extraHrs * 20
}

export function calcDurationMinutes(entryTime: Date, exitTime: Date): number {
  return Math.ceil((exitTime.getTime() - entryTime.getTime()) / 60000)
}
