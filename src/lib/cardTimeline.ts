export interface CardVisit {
  _id?: unknown
  cardUid: string
  entryTime: Date
  exitTime?: Date | null
  status?: string
  lostCard?: boolean
  lostFine?: number
}

export function cardVisitError(candidate: CardVisit, history: CardVisit[], returns = new Map<string, Date>()): string | null {
  const start = candidate.entryTime.getTime(), end = candidate.exitTime?.getTime() ?? Infinity
  if (!Number.isFinite(start) || (candidate.exitTime && (!Number.isFinite(end) || end <= start))) return 'เวลาออกต้องมากกว่าเวลาเข้า'
  const lost = (v: CardVisit) => v.lostCard === true || (v.lostFine ?? 0) > 0 || v.status === 'lost'
  for (const previous of history) {
    if (previous.cardUid !== candidate.cardUid || previous.status === 'void'
      || (candidate._id != null && String(previous._id) === String(candidate._id))) continue
    const otherStart = previous.entryTime.getTime()
    const otherEnd = previous.exitTime?.getTime() ?? Infinity
    if (start <= otherEnd && otherStart <= end) return 'บัตรนี้มีรายการที่ยังไม่ออกหรือช่วงเวลาใช้งานทับกัน เวลาเข้าใหม่ต้องมากกว่าเวลาออกเดิม'
    if (lost(previous) && start > otherStart) {
      const returned = returns.get(String(previous._id))
      if (!returned || start <= returned.getTime()) return 'บัตรนี้แจ้งหาย ยังใช้ซ้ำไม่ได้จนกว่าจะคืนบัตรผ่านระบบ'
    }
    if (lost(candidate) && otherStart > start) {
      const returned = returns.get(String(candidate._id))
      if (!returned || otherStart <= returned.getTime()) return 'ไม่สามารถแจ้งบัตรหายก่อนรายการถัดไปที่ใช้บัตรใบเดียวกันได้'
    }
  }
  return null
}
