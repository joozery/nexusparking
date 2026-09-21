import { Shift } from '@/models/Shift'
import { ParkingSession } from '@/models/ParkingSession'
import { ParkingQueue } from '@/models/ParkingQueue'
import { reportMoney as money, reportTime as time } from './dailyReportFormat'

export async function buildDailyReport(start: Date, end: Date, partial = false): Promise<string> {
  const boundary = partial ? 'เวลาทดสอบ' : 'เที่ยงคืน'
  const within = (value?: Date) => !!value && value >= start && value < end
  const [shifts, sessions, queues] = await Promise.all([
    Shift.find({ startTime: { $lt: end }, $or: [{ endTime: { $gte: start } }, { endTime: null }] }).sort({ startTime: 1 }).lean(),
    ParkingSession.find({ status: { $ne: 'void' }, entryTime: { $lt: end }, $or: [{ exitTime: { $gte: start } }, { exitTime: null }] })
      .select('cardUid cardType entryTime exitTime status shiftId fee lostCard lostFine fineName fineAmount discountAmount totalFee paymentMethod').lean(),
    ParkingQueue.find({ joinedAt: { $lt: end }, $or: [{ joinedAt: { $gte: start } }, { status: 'waiting' }, { enteredAt: { $gte: end } }, { cancelledAt: { $gte: end } }] }).lean(),
  ])
  const outgoing = sessions.filter(s => within(s.exitTime) && (s.status === 'completed' || s.status === 'lost'))
  type Paid = typeof outgoing
  const payments = (rows: Paid) => {
    const sum = (key: 'fee' | 'lostFine' | 'fineAmount' | 'discountAmount' | 'totalFee') => rows.reduce((n, s) => n + (s[key] ?? 0), 0)
    const lost = rows.filter(s => s.lostCard || s.lostFine > 0 || s.status === 'lost')
    const fines = new Map<string, { count: number; amount: number }>()
    rows.filter(s => s.fineAmount > 0).forEach(s => {
      const name = s.fineName || 'ค่าปรับอื่น'
      const item = fines.get(name) ?? { count: 0, amount: 0 }
      item.count++; item.amount += s.fineAmount; fines.set(name, item)
    })
    return [
      `รถออก: ${rows.length} คัน (รถยนต์ ${rows.filter(s => s.cardType !== 'motorcycle').length} / มอเตอร์ไซค์ ${rows.filter(s => s.cardType === 'motorcycle').length})`,
      `ค่าจอดก่อนส่วนลด: ${money(sum('fee'))} บาท`,
      `ส่วนลด: ${money(sum('discountAmount'))} บาท`,
      `บัตรหาย: ${new Set(lost.map(s => s.cardUid)).size} ใบ / ${lost.length} รายการ`,
      `ค่าปรับบัตรหาย: ${money(sum('lostFine'))} บาท`,
      ...[...fines].map(([name, item]) => `${name}: ${item.count} รายการ / ${money(item.amount)} บาท`),
      `รวมค่าปรับอื่น: ${money(sum('fineAmount'))} บาท`,
      `รายได้เงินสด: ${money(rows.filter(s => s.paymentMethod === 'cash').reduce((n, s) => n + s.totalFee, 0))} บาท`,
      `รายได้โอน/QR: ${money(rows.filter(s => s.paymentMethod === 'qr').reduce((n, s) => n + s.totalFee, 0))} บาท`,
      `รายได้รวมสุทธิ (รวมค่าปรับแล้ว): ${money(sum('totalFee'))} บาท`,
    ]
  }
  const visitKey = (uid: string | undefined, date: Date) => `${uid ?? ''}:${date.getTime()}`
  const incoming = new Map<string, string>()
  sessions.filter(s => within(s.entryTime)).forEach(s => incoming.set(visitKey(s.cardUid, s.entryTime), s.cardType))
  queues.filter(q => within(q.joinedAt)).forEach(q => incoming.set(visitKey(q.cardUid, q.joinedAt), q.cardType))
  const waiting = queues.filter(q => q.joinedAt < end && (!q.enteredAt || q.enteredAt >= end) && (!q.cancelledAt || q.cancelledAt >= end))
  // Queue sessions use joinedAt as entryTime, so exclude visits not admitted at the boundary.
  const notAdmitted = new Set(queues.filter(q => !q.enteredAt || q.enteredAt >= end).map(q => visitKey(q.cardUid, q.joinedAt)))
  const parked = sessions.filter(s => (!s.exitTime || s.exitTime >= end) && !notAdmitted.has(visitKey(s.cardUid, s.entryTime)))
  const opened = shifts.filter(s => within(s.startTime))
  const closed = shifts.filter(s => within(s.endTime))
  const types = (values: string[]) => `รถยนต์ ${values.filter(t => t !== 'motorcycle').length} / มอเตอร์ไซค์ ${values.filter(t => t === 'motorcycle').length}`
  const lines = [
    '📊 สรุปประจำวัน A20 Park',
    ...(partial ? ['🧪 ทดสอบรายงาน ณ เวลาที่กด'] : []),
    `วันที่ ${start.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}`,
    `ช่วงเวลา ${time(start)} ถึงก่อน ${time(end)}`,
    `กะที่ทำงานในวันนี้: ${shifts.length} กะ`,
    `เปิดวันนี้ ${opened.length} / ปิดวันนี้ ${closed.length} / ยังไม่ปิด ณ ${boundary} ${shifts.filter(s => !s.endTime || s.endTime >= end).length} กะ`,
    `รวมเงินต้นกะที่เปิดวันนี้: ${money(opened.reduce((n, s) => n + s.openingFloat, 0))} บาท`,
    `รวมเงินส่งคืนของกะที่ปิดวันนี้: ${money(closed.reduce((n, s) => n + s.closingFloat, 0))} บาท`,
    'เงินต้นกะ/เงินส่งคืนไม่ใช่รายได้ และไม่บวกซ้ำในรายได้',
    '─────────────────',
    `รถเข้าพื้นที่วันนี้ (รวมคิว ไม่นับซ้ำ): ${incoming.size} คัน (${types([...incoming.values()])})`,
    `รถเข้าคิววันนี้: ${queues.filter(q => within(q.joinedAt)).length} คัน`,
    ...payments(outgoing),
    `รถค้างในลาน ณ ${boundary}: ${parked.length} คัน (${types(parked.map(s => s.cardType))})`,
    `คิวรอ ณ ${boundary}: ${waiting.length} คัน (${types(waiting.map(q => q.cardType))})`,
    '─────────────────',
  ]
  return lines.join('\n')
}
