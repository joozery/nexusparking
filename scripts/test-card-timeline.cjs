const fs = require('node:fs'), ts = require('typescript'), assert = require('node:assert/strict')
function load(file, imports = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => { if (name in imports) return imports[name]; throw Error(name) }, mod, mod.exports)
  return mod.exports
}
const timeline = load('src/lib/cardTimeline.ts')
const date = time => new Date(`2026-09-01T${time}:00+07:00`)
const visit = { _id: 'old', cardUid: 'A', entryTime: date('09:00'), exitTime: date('10:00'), status: 'completed' }
const next = { cardUid: 'A', entryTime: date('10:01'), exitTime: date('11:00') }
assert.equal(timeline.cardVisitError(next, [visit]), null)
assert.ok(timeline.cardVisitError({ ...next, entryTime: date('10:00') }, [visit]))
assert.ok(timeline.cardVisitError(next, [{ ...visit, exitTime: undefined }]))
assert.ok(timeline.cardVisitError(next, [{ ...visit, lostCard: true }]))
assert.ok(timeline.cardVisitError({ ...visit, _id: undefined, lostCard: true }, [next]))
assert.equal(timeline.cardVisitError({ ...next, cardUid: 'B' }, [{ ...visit, lostCard: true }]), null)
const returned = new Map([['old', date('10:30')]])
assert.ok(timeline.cardVisitError(next, [{ ...visit, lostCard: true }], returned))
assert.equal(timeline.cardVisitError({ ...next, entryTime: date('10:31') }, [{ ...visit, lostCard: true }], returned), null)
assert.equal(timeline.cardVisitError(visit, [visit]), null, 'updating the same visit excludes itself')
assert.ok(timeline.cardVisitError({ ...next, exitTime: date('09:00') }, []))
let card = { uid: 'A', type: 'car', isActive: true }, history = [visit], queues = [], shifts = []
const availability = load('src/lib/cardAvailability.ts', {
  './cardTimeline': timeline,
  '@/models/ParkingCard': { ParkingCard: { findOne: () => ({ lean: async () => card }) } },
  '@/models/ParkingSession': { ParkingSession: { find: () => ({ lean: async () => history }) } },
  '@/models/ParkingQueue': { ParkingQueue: { find: () => ({ lean: async () => queues }) } },
  '@/models/Shift': { Shift: { find: () => ({ select() { return this }, lean: async () => shifts }) } },
})
async function main() {
  assert.equal(await availability.validateRegisteredVisit(next, 'car'), null)
  assert.ok(await availability.validateRegisteredVisit(next, 'motorcycle'))
  card = null; assert.ok(await availability.validateRegisteredVisit(next, 'car'))
  card = { uid: 'A', type: 'car', isActive: true, expiryDate: date('09:00') }
  assert.ok(await availability.validateRegisteredVisit(next, 'car'))
  delete card.expiryDate
  queues = [{ _id: 'queue', cardUid: 'A', joinedAt: date('10:01') }]
  assert.ok(await availability.validateRegisteredVisit(next, 'car'))
  assert.equal(await availability.validateRegisteredVisit(next, 'car', 'queue'), null, 'queue promotion excludes its own queue record')
  queues = []; history = [{ ...visit, lostCard: true }]
  assert.ok(await availability.validateRegisteredVisit(next, 'car'))
  shifts = [{ cardRefunds: [{ sessionId: 'old', refundedAt: date('10:30') }] }]
  assert.equal(await availability.validateRegisteredVisit({ ...next, entryTime: date('10:31') }, 'car'), null)
  console.log('Card timeline tests passed: boundaries, open visits, lost cards, returns, expiry, types and queues. No database writes.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
