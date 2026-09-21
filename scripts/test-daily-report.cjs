const fs = require('node:fs')
const ts = require('typescript')
const assert = require('node:assert/strict')
function load(file, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => imports[name] ?? require(name), mod, mod.exports)
  return mod.exports
}
const format = load('src/lib/dailyReportFormat.ts')
assert.equal(format.thaiDayStart(new Date('2026-09-21T16:59:59Z')).toISOString(), '2026-09-20T17:00:00.000Z')
assert.equal(format.thaiDayStart(new Date('2026-09-21T17:00:00Z')).toISOString(), '2026-09-21T17:00:00.000Z')
const chunks = format.splitLineReport(Array(300).fill('รายงานทดสอบ 1234567890').join('\n'))
assert.ok(chunks.length > 1)
assert.ok(chunks.every(chunk => chunk.length < 5000))
assert.deepEqual(format.cashBreakdown({ 100: 2, 500: 1, 20: 0 }), ['500 × 1 = 500.00 บาท', '100 × 2 = 200.00 บาท'])
const start = new Date('2026-09-20T17:00:00Z'), end = new Date('2026-09-21T17:00:00Z')
const date = value => new Date(value)
const sessions = [
  { cardUid: 'A', cardType: 'car', entryTime: date('2026-09-21T01:00:00Z'), exitTime: date('2026-09-21T02:00:00Z'), status: 'completed', shiftId: 's1', fee: 20, totalFee: 320, lostFine: 300, fineAmount: 0, paymentMethod: 'cash' },
  { cardUid: 'B', cardType: 'motorcycle', entryTime: date('2026-09-21T03:00:00Z'), exitTime: end, status: 'completed', shiftId: 's1', totalFee: 999, lostFine: 0, fineAmount: 0, paymentMethod: 'qr' },
  { cardUid: 'C', cardType: 'car', entryTime: date('2026-09-21T04:00:00Z'), status: 'active' },
]
const queues = [
  { cardUid: 'A', cardType: 'car', joinedAt: sessions[0].entryTime, cancelledAt: sessions[0].exitTime, status: 'cancelled', shiftId: 's1' },
  { cardUid: 'C', cardType: 'car', joinedAt: sessions[2].entryTime, enteredAt: date('2026-09-21T18:00:00Z'), status: 'entered', shiftId: 's1' },
]
const shifts = [{ _id: 's1', operatorName: 'พนักงานทดสอบ', startTime: start, openingFloat: 1000, openingBreakdown: { 1000: 1 }, closingFloat: 0 }]
const query = rows => ({ find: () => ({ sort: () => ({ lean: async () => rows }), select: () => ({ lean: async () => rows }), lean: async () => rows }) })
const { buildDailyReport } = load('src/lib/dailyReport.ts', {
  '@/models/Shift': { Shift: query(shifts) },
  '@/models/ParkingSession': { ParkingSession: query(sessions) },
  '@/models/ParkingQueue': { ParkingQueue: query(queues) },
  './dailyReportFormat': format,
})
buildDailyReport(start, end).then(async text => {
  assert.ok(text.includes('รายได้เงินสด: 320.00 บาท'))
  assert.ok(text.includes('รายได้โอน/QR: 0.00 บาท'))
  assert.ok(text.includes('รถเข้าพื้นที่วันนี้ (รวมคิว ไม่นับซ้ำ): 3 คัน'))
  assert.ok(text.includes('รถค้างในลาน ณ เที่ยงคืน: 1 คัน'))
  assert.ok(text.includes('คิวรอ ณ เที่ยงคืน: 1 คัน'))
  assert.ok(text.includes('ยังไม่ปิด ณ เที่ยงคืน 1 กะ'))
  assert.ok(!text.includes('รายละเอียดแต่ละกะ'))
  assert.ok(!text.includes('ผู้เปิด:'))
  assert.equal(text.split('รายได้เงินสด:').length - 1, 1)
  assert.ok(text.includes('ค่าปรับบัตรหาย: 300.00 บาท'))
  // Refunds belong to the day money is returned, even if the visit was in an older shift.
  shifts[0].cardRefunds = [
    { sessionId: 'older-visit', amount: 100, paymentMethod: 'cash', refundedAt: date('2026-09-21T03:00:00Z') },
    { sessionId: 'older-qr', amount: 50, paymentMethod: 'qr', refundedAt: date('2026-09-21T04:00:00Z') },
    { sessionId: 'tomorrow', amount: 999, paymentMethod: 'cash', refundedAt: end },
  ]
  const refunded = await buildDailyReport(start, end)
  assert.ok(refunded.includes('รายได้เงินสด: 220.00 บาท'))
  assert.ok(refunded.includes('รายได้โอน/QR: -50.00 บาท'))
  assert.ok(refunded.includes('รายได้รวมสุทธิ (รวมค่าปรับแล้ว): 170.00 บาท'))
  assert.ok(refunded.includes('ค่าปรับบัตรหาย: 300.00 บาท'))
  console.log('Daily report tests passed: Thai midnight, chunking, denominations, queue deduplication, boundary occupancy, cross-day payments.')
}).catch(error => { console.error(error); process.exitCode = 1 })
