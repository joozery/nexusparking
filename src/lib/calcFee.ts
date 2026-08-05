export type CardType = 'car' | 'motorcycle' | 'overnight'

function ceilHours(minutes: number) {
  return Math.max(1, Math.ceil(minutes / 60))
}

// นาทีที่อยู่ใน daytime (07:00-22:00) — ใช้คำนวณค่าจอดปกติสำหรับ overnight
function daytimeMinutes(entryTime: Date, exitTime: Date): number {
  const MS = 60000
  const dayStart = 7 * 60   // 07:00
  const dayEnd   = 22 * 60  // 22:00

  let total = 0
  let cur = new Date(entryTime)
  const end = new Date(exitTime)

  while (cur < end) {
    const next = new Date(cur)
    next.setDate(next.getDate() + 1)
    next.setHours(0, 0, 0, 0)
    const segEnd = next < end ? next : end

    // ช่วงกลางคืนของวัน cur
    const curMin = cur.getHours() * 60 + cur.getMinutes()
    const segEndMin = (segEnd.getDate() === cur.getDate())
      ? segEnd.getHours() * 60 + segEnd.getMinutes()
      : 24 * 60

    const overlapStart = Math.max(curMin, dayStart)
    const overlapEnd   = Math.min(segEndMin, dayEnd)
    if (overlapEnd > overlapStart) total += (overlapEnd - overlapStart)

    cur = next
  }

  return total
}

// ตรวจสอบว่าการจอดข้ามช่วง 22:00-07:00 หรือเปล่า
function spansNightWindow(entryTime: Date, exitTime: Date): boolean {
  const nightStart = 22 * 60  // 22:00
  const nightEnd   = 7  * 60  // 07:00

  let cur = new Date(entryTime)
  const end = new Date(exitTime)

  while (cur < end) {
    const h = cur.getHours() * 60 + cur.getMinutes()
    if (h >= nightStart || h < nightEnd) return true
    // ก้าวไป 30 นาที
    cur = new Date(cur.getTime() + 30 * 60000)
  }
  return false
}

export function calcFeeFromMinutes(
  type: CardType,
  minutes: number,
  entryTime?: Date,
  exitTime?:  Date,
): number {
  // ถ้าเป็น overnight type หรือจอดข้ามช่วง 22:00-07:00 → overnight rate
  const isOvernight = type === 'overnight' ||
    (entryTime != null && exitTime != null && spansNightWindow(entryTime, exitTime))

  if (isOvernight) {
    // ฿100 ค่าค้างคืน + คิดชั่วโมง daytime ส่วนที่เกินตามปกติ
    if (!entryTime || !exitTime) return 100
    const dtMin  = daytimeMinutes(entryTime, exitTime)
    const dtHrs  = dtMin > 0 ? ceilHours(dtMin) : 0
    if (type === 'motorcycle') {
      const extra = dtHrs <= 1 ? 0 : (dtHrs - 1) * 10
      return 100 + extra
    }
    // car / overhead default
    const extra = dtHrs <= 1 ? 0 : (dtHrs - 1) * 20
    return 100 + extra
  }

  if (type === 'car')        return ceilHours(minutes) <= 1 ? 30 : 30 + (ceilHours(minutes) - 1) * 20
  if (type === 'motorcycle') return ceilHours(minutes) <= 1 ? 20 : 20 + (ceilHours(minutes) - 1) * 10
  return 100
}

export function calcDurationMinutes(entryTime: Date, exitTime: Date): number {
  return Math.ceil((exitTime.getTime() - entryTime.getTime()) / 60000)
}
