export type CardType = 'car' | 'motorcycle' | 'overnight'

export interface OvernightConfig {
  windowStart: string  // 'HH:MM'
  windowEnd:   string  // 'HH:MM'
  flatRate:    number
  extraHour:   number
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
  windowStart: '18:00',
  windowEnd:   '07:00',
  flatRate:    100,
  extraHour:   20,
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

// คืน overnight window segments ที่ทับกับ [entry, exit] เรียงตามเวลา
// fullWindow = true หมายถึงรถอยู่ครบจนสิ้นสุด window (ครบคืน) → คิด flatRate
// fullWindow = false หมายถึงรถออกก่อน window จบ (ค้างคืนไม่ครบ) → คิด extraHour
function overnightWindowsIn(entry: Date, exit: Date, cfg: OvernightConfig) {
  const [wsH, wsM] = cfg.windowStart.split(':').map(Number)
  const [weH, weM] = cfg.windowEnd.split(':').map(Number)

  const windows: { start: Date; end: Date; fullWindow: boolean }[] = []
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
      windows.push({ start: oStart, end: oEnd, fullWindow: exit.getTime() >= wEnd.getTime() })
    }
  }
  return windows
}

// คำนวณ breakdown แยกแต่ละช่วง — ใช้แสดงผลใน simulator และ checkout
export function calcFeeBreakdown(
  cardType:  CardType,
  entryTime: Date,
  exitTime:  Date,
  overnight?: OvernightConfig,
): { segments: FeeSegment[]; total: number } {
  const cfg = overnight ?? DEFAULT_OVERNIGHT
  const isOvernight = cardType === 'overnight' || spansOvernightWindow(entryTime, exitTime, cfg)

  if (!isOvernight) {
    const minutes = (exitTime.getTime() - entryTime.getTime()) / 60000
    const h = ceilHours(minutes)
    let fee: number
    let rateLabel: string
    if (cardType === 'car') {
      fee = h <= 1 ? 30 : 30 + (h - 1) * 20
      rateLabel = h <= 1 ? '฿30 (ชม.แรก)' : `฿30 + ${h - 1}×฿20`
    } else {
      fee = h <= 1 ? 20 : 20 + (h - 1) * 10
      rateLabel = h <= 1 ? '฿20 (ชม.แรก)' : `฿20 + ${h - 1}×฿10`
    }
    return {
      segments: [{ kind: 'normal', from: entryTime, to: exitTime, minutes, hours: h, fee, rateLabel }],
      total: fee,
    }
  }

  const windows = overnightWindowsIn(entryTime, exitTime, cfg)
  const segments: FeeSegment[] = []
  let cursor = entryTime

  for (const w of windows) {
    // ช่วงนอก window ก่อน
    if (cursor < w.start) {
      const min = (w.start.getTime() - cursor.getTime()) / 60000
      const h   = Math.ceil(min / 60)
      segments.push({
        kind: 'outside', from: new Date(cursor), to: new Date(w.start),
        minutes: min, hours: h,
        fee: h * cfg.extraHour,
        rateLabel: `${h} ชม. × ฿${cfg.extraHour}/ชม.`,
      })
    }
    // overnight window — full = flat rate, partial (ออกก่อนสิ้นสุด window) = extraHour
    const min = (w.end.getTime() - w.start.getTime()) / 60000
    if (w.fullWindow) {
      segments.push({
        kind: 'overnight', from: new Date(w.start), to: new Date(w.end),
        minutes: min, hours: 0,
        fee: cfg.flatRate,
        rateLabel: `เหมาจ่าย ฿${cfg.flatRate}`,
      })
    } else {
      const h = Math.ceil(min / 60)
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
    const min = (exitTime.getTime() - cursor.getTime()) / 60000
    const h   = Math.ceil(min / 60)
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
  type:       CardType,
  minutes:    number,
  entryTime?: Date,
  exitTime?:  Date,
  overnight?: OvernightConfig,
): number {
  const cfg = overnight ?? DEFAULT_OVERNIGHT
  const isOvernight =
    type === 'overnight' ||
    (entryTime != null && exitTime != null && spansOvernightWindow(entryTime, exitTime, cfg))

  if (isOvernight) {
    if (!entryTime || !exitTime) return cfg.flatRate
    return calcFeeBreakdown(type, entryTime, exitTime, cfg).total
  }

  if (type === 'car')        return ceilHours(minutes) <= 1 ? 30 : 30 + (ceilHours(minutes) - 1) * 20
  if (type === 'motorcycle') return ceilHours(minutes) <= 1 ? 20 : 20 + (ceilHours(minutes) - 1) * 10
  return cfg.flatRate
}

export function calcDurationMinutes(entryTime: Date, exitTime: Date): number {
  return Math.ceil((exitTime.getTime() - entryTime.getTime()) / 60000)
}
