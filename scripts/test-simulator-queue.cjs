// In-memory route integration: no MongoDB connection and no hardware calls.
const fs = require('node:fs'), assert = require('node:assert/strict'), ts = require('typescript')
const match = require('sift').default
const sift = filter => match(filter.exitTime?.$type === 'date' ? { ...filter, exitTime: { $type: Date } } : filter)
function load(file, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => {
    if (name in imports) return imports[name]
    if (name.startsWith('@/')) throw Error('Unexpected dependency: ' + name)
    return require(name)
  }, mod, mod.exports)
  return mod.exports
}
let sessions = [], queues = [], failInsert = false
const cards = Array.from({ length: 25 }, (_, i) => ({ uid: 'CARD-' + i, type: 'car', isActive: true }))
const settings = { capacity: { car: 10, motorcycle: 2 }, lostCardFine: 300, rates: { overnight: { windowStart: '18:00', windowEnd: '07:00', flatRateStart: '22:00', flatRate: 100, extraHour: 20 } } }
const query = (values, filter) => ({ select() { return this }, sort() { return this }, lean: async () => values.filter(sift(filter)) })
const wrap = doc => doc && Object.assign(doc, { save: async () => {} })
class Session {
  constructor(values) { Object.assign(this, values) }
  async save() { sessions.push(this) }
  static find(filter) { return query(sessions, filter) }
  static async findOne(filter) { return wrap(sessions.find(sift(filter))) }
  static async exists(filter) { return sessions.some(sift(filter)) }
  static async countDocuments(filter) { return sessions.filter(sift(filter)).length }
  static async aggregate(stages) {
    const matching = sessions.filter(sift(stages[0].$match))
    return ['cash', 'qr'].map(method => ({ _id: method, total: matching.filter(s => s.paymentMethod === method).reduce((sum, s) => sum + (s.totalFee ?? 0), 0) }))
  }
  static async create(doc) { sessions.push(doc); return doc }
  static async insertMany(docs) { sessions.push(...docs); if (failInsert) throw Error('injected insert failure'); return docs }
  static async deleteMany(filter) { const before = sessions.length; sessions = sessions.filter(s => !sift(filter)(s)); return { deletedCount: before - sessions.length } }
}
const Queue = {
  find: filter => query(queues, filter), findOne: async filter => wrap(queues.find(sift(filter))),
  countDocuments: async filter => queues.filter(sift(filter)).length,
  insertMany: async docs => { queues.push(...docs); return docs },
  deleteMany: async filter => { queues = queues.filter(q => !sift(filter)(q)); return {} },
}
const timeline = load('src/lib/cardTimeline.ts')
const common = {
  'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
  'next/headers': { cookies: async () => ({ get: () => ({ value: 'token' }) }) },
  '@/lib/auth': { COOKIE_NAME: 'auth', verifyToken: () => ({ role: 'admin', sub: 'test' }) },
  '@/lib/mongodb': { connectDB: async () => {} }, '@/lib/parkingMutation': { parkingMutation: fn => fn },
  '@/models/ParkingSession': { ParkingSession: Session }, '@/models/ParkingQueue': { ParkingQueue: Queue },
  '@/models/ParkingCard': { ParkingCard: { find: filter => query(cards, filter), countDocuments: async filter => cards.filter(sift(filter)).length, findOne: filter => ({ lean: async () => cards.find(sift(filter)) }) } },
  '@/models/Shift': { Shift: { find: () => ({ select() { return this }, lean: async () => [] }), findOne: async () => null } },
  '@/models/SystemSettings': { getSettings: async () => settings },
  '@/models/Discount': { Discount: { find: () => ({ lean: async () => [] }) } }, '@/models/Fine': { Fine: {} },
  '@/lib/cardTimeline': timeline,
  './cardTimeline': timeline,
  '@/lib/dateTh': { getTodayStartTH: () => new Date(0) },
  '@/lib/missingCards': { getMissingCardUids: async () => new Set(sessions.filter(s => s.lostCard && s.status === 'completed').map(s => s.cardUid)) },
  '@/lib/calcFee': load('src/lib/calcFee.ts'), '@/lib/hardware': { runCheckoutSequence: async () => {} },
  '@/lib/simulatorImport': load('src/lib/simulatorImport.ts'), '@/lib/simulatorCapacity': load('src/lib/simulatorCapacity.ts'),
  '@/lib/clearParkingHistory': load('src/lib/clearParkingHistory.ts'),
}
common['@/lib/cardAvailability'] = load('src/lib/cardAvailability.ts', common)
const simulate = load('src/app/api/simulate/route.ts', common)
const enter = load('src/app/api/queue/[id]/enter/route.ts', common)
const checkout = load('src/app/api/sessions/checkout/route.ts', common)
const fleet = load('src/app/api/stats/fleet/route.ts', common)
const stats = load('src/app/api/stats/route.ts', common)
const request = body => ({ json: async () => body })
const preview = async rows => (await simulate.POST(request({ mode: 'preview', rows }))).body
const commit = (rows, token) => simulate.POST(request({ mode: 'commit', rows, token }))
async function main() {
  const arrival = Date.now() - 60000
  const rows = cards.map((card, i) => ({ rowNum: i + 2, plate: 'TEST-' + i, cardUid: card.uid, cardType: card.type, entryTime: new Date(arrival + i).toISOString(), exitTime: '', lostCard: i === 10, paymentMethod: 'cash' }))
  const p = await preview([...rows].reverse())
  assert.equal(p.errors, 0); assert.equal(p.active, 10); assert.equal(p.waiting, 15); assert.equal(p.ready, 25)
  assert.equal(sessions.length + queues.length, 0, 'preview must not write')
  assert.equal((await commit(rows, p.token)).body.created, 25)
  assert.equal(sessions.length, 10); assert.equal(queues.length, 15)
  const fleetBefore = (await fleet.GET()).body.car
  assert.equal(fleetBefore.activeTotal, 10); assert.equal(fleetBefore.queueWaiting, 15)
  assert.equal(fleetBefore.cardsRemaining, 0); assert.equal(fleetBefore.temporaryCardsInUse, 25)
  assert.equal(fleetBefore.inToday, 25); assert.equal((await stats.GET()).body.todayEntries, 25)
  assert.equal((await preview(rows)).duplicates, 25, 'repeat import does not duplicate waiting queues')
  const first = queues[0]
  const admit = q => enter.POST(request({}), { params: Promise.resolve({ id: q._id }) })
  assert.equal((await admit(first)).status, 409, 'full lot refuses entry')
  assert.equal((await checkout.POST(request({ sessionId: sessions[0]._id, exitTime: new Date().toISOString(), paymentMethod: 'cash' }))).status, 200)
  assert.equal((await admit(first)).status, 200, 'one departure makes one space')
  assert.equal(sessions.filter(s => s.status === 'active').length, 10)
  assert.equal(queues.filter(q => q.status === 'waiting').length, 14)
  const promoted = sessions.find(s => String(s._id) === String(first._id))
  assert.equal(promoted.lostCard, true); assert.equal(promoted.entryTime.getTime(), first.joinedAt.getTime())
  assert.equal(first.sessionId, String(promoted._id))
  assert.equal((await admit(queues[1])).status, 409, 'cannot use the same free space twice')
  assert.equal((await checkout.POST(request({ sessionId: promoted._id, exitTime: new Date(Date.now() + 1000).toISOString(), paymentMethod: 'cash', lostCard: false }))).status, 200)
  assert.equal(promoted.lostFine, 300); assert.equal(promoted.lostCard, true)
  const waiting = queues[1]
  assert.equal((await checkout.POST(request({ queueId: waiting._id, exitTime: new Date().toISOString(), paymentMethod: 'cash' }))).status, 200)
  assert.equal(waiting.status, 'cancelled'); assert.equal(waiting.sessionId, String(waiting._id))
  assert.equal(sessions.find(s => String(s._id) === waiting.sessionId).neverParked, true)
  assert.equal((await fleet.GET()).body.car.inToday, 25, 'paid queue departure counted only once')
  assert.equal((await stats.GET()).body.todayEntries, 25)
  // History imports that were full record paid queue departures, not occupied spaces.
  sessions = []; queues = []
  const closed = rows.map(r => ({ ...r, exitTime: new Date(arrival + 30000).toISOString() }))
  const closedPreview = await preview(closed)
  assert.equal(closedPreview.queued, 15); assert.equal(closedPreview.waiting, 0)
  await commit(closed, closedPreview.token)
  assert.equal(sessions.length, 25); assert.equal(queues.length, 15)
  assert.equal(queues.filter(q => q.sessionId && q.status === 'cancelled').length, 15)
  assert.equal((await fleet.GET()).body.car.inToday, 25)
  assert.equal((await stats.GET()).body.todayEntries, 25)
  assert.equal((await preview(closed)).duplicates, 25)
  const cleanup = (await simulate.GET()).body
  assert.equal(cleanup.count, 24)
  await simulate.DELETE(request({ confirmation: 'CLEAR_COMPLETED_HISTORY', token: cleanup.token }))
  assert.equal(sessions.length, 1); assert.equal(sessions[0].lostCard, true)
  assert.equal(queues.length, 1); assert.equal(queues[0].lostCard, true, 'lost queue and full session history survive cleanup')
  // Failure after either collection writes rolls back only this import.
  sessions = []; queues = []; failInsert = true
  const failPreview = await preview(rows)
  await assert.rejects(commit(rows, failPreview.token), /injected/)
  assert.equal(sessions.length, 0); assert.equal(queues.length, 0)
  failInsert = false
  const capacity = common['@/lib/simulatorCapacity'].needsParkingQueue
  const visit = { cardType: 'car', entryTime: new Date(100), exitTime: new Date(200) }
  assert.equal(capacity(visit, { car: 1, motorcycle: 1 }, [{ ...visit, entryTime: new Date(50), exitTime: new Date(100) }], []), false, 'space frees at departure')
  assert.equal(capacity(visit, { car: 1, motorcycle: 1 }, [{ ...visit, cardType: 'motorcycle' }], []), false, 'separate vehicle capacities')
  assert.equal(capacity(visit, { car: 1, motorcycle: 1 }, [{ ...visit, cardType: 'overnight' }], []), true, 'overnight cards share car capacity')
  assert.equal(capacity(visit, { car: 1, motorcycle: 1 }, [{ ...visit, entryTime: new Date(150) }], []), true, 'historical import cannot overbook recorded later visits')
  console.log('Queue integration passed: 25 cards / 10 spaces, preview, 15 waiting, duplicates, checkout, admission, lost preservation, queue payment, separate capacities, rollback. No database or hardware access.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
