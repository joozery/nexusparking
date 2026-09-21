export type CardType = 'car' | 'motorcycle' | 'overnight'

export interface OvernightConfig {
  windowStart:    string   // 'HH:MM' - เริ่มตรวจจับ overnight
  windowEnd:      string   // 'HH:MM' - สิ้นสุดช่วง overnight
  flatRateStart?: string   // 'HH:MM' - เวลาที่ตัดเป็น flatRate (default '22:00')
  flatRate:       number
  extraHour:      number
}

export interface FeeSegment {
  kind:      'normal' | 'overnight' | 'outside'
  from:      Date
  to:        Date
  minutes:   number
  hours:     number   // ceiled hours (0 for overnight flat)
  fee:       number
  rateLabel: string
}

const DEFAULT_OVERNIGHT: OvernightConfig = {
  windowStart:    '18:00',
  windowEnd:      '07:00',
  flatRateStart:  '22:00',
  flatRate:       100,
  extraHour:      20,
}

function ceilHours(minutes: number) {
  return Math.max(1, Math.ceil(minutes / 60))
}

function spansOvernightWindow(entry: Date, exit: Date, cfg: OvernightConfig): boolean {
  const wsMin = toMin(cfg.windowStart)
  const weMin = toMin(cfg.windowEnd)
  let cur = new Date(entry)
  while (cur < exit) {
    const m = cur.getHours() * 60 + cur.getMinutes()
    if (m >= wsMin || m < weMin) return true
    cur = new Date(cur.getTime() + 30 * 60000)
  }
  return false
}

function toMin(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// คืน overnight window segments ที่ทับกับ [entry, exit] พร้อม flag ว่าถึง flatRate threshold หรือยัง
function overnightWindowsIn(entry: Date, exit: Date, cfg: OvernightConfig) {
  const [wsH, wsM] = cfg.windowStart.split(':').map(Number)
  const [weH, weM] = cfg.windowEnd.split(':').map(Number)
  // flatRateStart: เวลาที่รถต้องอยู่ถึง/เลยจึงคิด flatRate (default 22:00)
  const [frsH, frsM] = (cfg.flatRateStart ?? '22:00').split(':').map(Number)

  const windows: { start: Date; end: Date; isFlatRate: boolean }[] = []
  const checkFrom = new Date(entry)
  checkFrom.setDate(checkFrom.getDate() - 1)
  checkFrom.setHours(0, 0, 0, 0)
  const checkTo = new Date(exit)
  checkTo.setHours(0, 0, 0, 0)

  for (let d = new Date(checkFrom); d <= checkTo; d.setDate(d.getDate() + 1)) {
    const wStart = new Date(d); wStart.setHours(wsH, wsM, 0, 0)
    const wEnd   = new Date(d); wEnd.setDate(wEnd.getDate() + 1); wEnd.setHours(weH, weM, 0, 0)
    const oStart = entry > wStart ? new Date(entry) : new Date(wStart)
    const oEnd   = exit  < wEnd   ? new Date(exit)  : new Date(wEnd)
    if (oEnd > oStart) {
      // billing threshold: frsH:frsM บน calendar day เดียวกับ wStart
      const billingThreshold = new Date(d)
      billingThreshold.setHours(frsH, frsM, 0, 0)
      if (billingThreshold < wStart) billingThreshold.setDate(billingThreshold.getDate() + 1)
      // ต้องเข้าก่อน 22:00 ของคืนที่กำลังคิด และยังจอดหลังเวลานั้น
      // รถที่เข้าตั้งแต่ 22:00 หรือช่วงเช้าของคืนเดียวกันคิดรายชั่วโมง
      const isFlatRate = entry.getTime() < billingThreshold.getTime()
        && oEnd.getTime() > billingThreshold.getTime()

      windows.push({ start: oStart, end: oEnd, isFlatRate })
    }
  }
  return windows
}

// Shared calculation for checkout, previews, and receipts.
export function calcFeeBreakdown(
  cardType: CardType,
  entryTime: Date,
  exitTime: Date,
  overnight?: OvernightConfig,
): { segments: FeeSegment[]; total: number } {
  const cfg = overnight ?? DEFAULT_OVERNIGHT
  const graceMin = Math.floor((exitTime.getTime() - entryTime.getTime()) / 60000)
  if (graceMin < 1) {
    return { segments: [{ kind: 'normal', from: entryTime, to: exitTime,
      minutes: graceMin, hours: 0, fee: 0, rateLabel: 'ฟรี (จอดไม่ถึง 1 นาที)' }], total: 0 }
  }
  const spansWindow = cardType === 'overnight' || spansOvernightWindow(entryTime, exitTime, cfg)
  const windows = spansWindow ? overnightWindowsIn(entryTime, exitTime, cfg) : []
  const isOvernight = windows.some(w => w.isFlatRate)
  const totalMin = Math.floor((exitTime.getTime() - entryTime.getTime()) / 60000)
  const totalH = ceilHours(totalMin)
  let normalFee: number
  let normalRateLabel: string
  if (cardType !== 'motorcycle') {
    normalFee = totalH <= 1 ? 30 : 30 + (totalH - 1) * 20
    normalRateLabel = totalH <= 1 ? '฿30 (ชม.แรก)' : `฿30 + ${totalH - 1}×฿20`
  } else {
    normalFee = totalH <= 1 ? 20 : 20 + (totalH - 1) * 10
    normalRateLabel = totalH <= 1 ? '฿20 (ชม.แรก)' : `฿20 + ${totalH - 1}×฿10`
  }

  if (!isOvernight) {
    const segs: FeeSegment[] = [{
      kind: 'normal', from: entryTime, to: exitTime,
      minutes: totalMin, hours: totalH, fee: normalFee, rateLabel: normalRateLabel
    }]
    return { segments: segs, total: segs.reduce((s, seg) => s + seg.fee, 0) }
  }

  // overnight mode — ใช้ windows ที่คำนวณไว้แล้ว
  const segments: FeeSegment[] = []
  let cursor = entryTime

  for (const w of windows) {
    // ช่วงนอก window ก่อน
    if (cursor < w.start) {
      const min = Math.floor((w.start.getTime() - cursor.getTime()) / 60000)
      const h   = ceilHours(min)
      const fee = h * (cfg.extraHour ?? 20)
      const rateLabel = `${h} ชม. × ฿${cfg.extraHour ?? 20}/ชม.`
      segments.push({
        kind: 'outside', from: new Date(cursor), to: new Date(w.start),
        minutes: min, hours: h, fee, rateLabel,
      })
    }

    const min = Math.floor((w.end.getTime() - w.start.getTime()) / 60000)

    if (w.isFlatRate) {
      // รถอยู่เลย flatRateStart → เหมาจ่ายค้างคืน
      segments.push({
        kind: 'overnight', from: new Date(w.start), to: new Date(w.end),
        minutes: min, hours: 0,
        fee: cfg.flatRate,
        rateLabel: `เหมาจ่าย ฿${cfg.flatRate}`,
      })
    } else {
      // รถออกก่อน flatRateStart → คิดชั่วโมง (ยังไม่เกิน ${cfg.flatRateStart ?? '22:00'})
      const h = ceilHours(min)
      segments.push({
        kind: 'outside', from: new Date(w.start), to: new Date(w.end),
        minutes: min, hours: h,
        fee: h * cfg.extraHour,
        rateLabel: `${h} ชม. × ฿${cfg.extraHour}/ชม.`,
      })
    }

    cursor = w.end
  }

  // ช่วงนอก window หลัง
  if (cursor < exitTime) {
    const min = Math.floor((exitTime.getTime() - cursor.getTime()) / 60000)
    const h   = ceilHours(min)
    segments.push({
      kind: 'outside', from: new Date(cursor), to: new Date(exitTime),
      minutes: min, hours: h,
      fee: h * cfg.extraHour,
      rateLabel: `${h} ชม. × ฿${cfg.extraHour}/ชม.`,
    })
  }

  const total = segments.reduce((s, seg) => s + seg.fee, 0)
  return { segments, total }
}

export function calcFeeFromMinutes(
  type:        CardType,
  minutes:     number,
  entryTime?:  Date,
  exitTime?:   Date,
  overnight?:  OvernightConfig,
): number {
  const cfg = overnight ?? DEFAULT_OVERNIGHT
  const isOvernight =
    type === 'overnight' ||
    (entryTime != null && exitTime != null && spansOvernightWindow(entryTime, exitTime, cfg))

  if (isOvernight) {
    if (!entryTime || !exitTime) return cfg.flatRate
    return calcFeeBreakdown(type, entryTime, exitTime, cfg).total
  }

  // เมื่อมีเวลาออกจริง ให้ใช้ breakdown เพื่อความสอดคล้องกับ checkout
  if (entryTime && exitTime) {
    return calcFeeBreakdown(type, entryTime, exitTime, cfg).total
  }

  if (type === 'car')        return ceilHours(minutes) <= 1 ? 30 : 30 + (ceilHours(minutes) - 1) * 20
  if (type === 'motorcycle') return ceilHours(minutes) <= 1 ? 20 : 20 + (ceilHours(minutes) - 1) * 10
  return cfg.flatRate
}

export function calcDurationMinutes(entryTime: Date, exitTime: Date): number {
  return Math.ceil((exitTime.getTime() - entryTime.getTime()) / 60000)
}
