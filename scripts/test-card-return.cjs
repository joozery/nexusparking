const fs = require('node:fs')
const ts = require('typescript')
const assert = require('node:assert/strict')
function load(file, imports) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => { if (!(name in imports)) throw Error(name); return imports[name] }, mod, mod.exports)
  return mod.exports
}
const id = '123456789012345678901234'
let authenticated = true, activeShift = true, queued = false
const visit = { _id: id, cardUid: '0001234567', plate: '1111', status: 'completed', lostCard: true, lostFine: 300, totalFee: 320, exitTime: new Date() }
const refunds = []
let cash = 500, qr = 0, total = 500
const Shift = {
  exists: async () => refunds.length > 0,
  findOneAndUpdate: async (filter, update) => {
    assert.equal(filter.operatorId, 'current-operator')
    assert.equal(filter.status, 'active')
    if (!activeShift) return null
    refunds.push(update.$push.cardRefunds)
    cash += update.$inc.cashAmount ?? 0; qr += update.$inc.qrAmount ?? 0; total += update.$inc.totalAmount
    return { _id: 'current-shift' }
  },
}
const route = load('src/app/api/sessions/return-card/route.ts', {
  'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
  'next/headers': { cookies: async () => ({ get: () => ({ value: 'token' }) }) },
  '@/lib/auth': { COOKIE_NAME: 'auth', verifyToken: () => authenticated ? { sub: 'current-operator' } : null },
  '@/lib/mongodb': { connectDB: async () => {} },
  '@/lib/parkingMutation': { parkingMutation: fn => fn },
  '@/models/ParkingSession': { ParkingSession: { findById: () => ({ lean: async () => visit }), findOne: () => ({ sort: () => ({ lean: async () => visit }) }) } },
  '@/models/ParkingQueue': { ParkingQueue: { exists: async () => queued } },
  '@/models/Shift': { Shift },
})
const post = (method = 'cash') => route.POST({ json: async () => ({ sessionId: id, paymentMethod: method, amount: 99999 }) })
async function main() {
  const original = JSON.stringify(visit)
  const get = () => route.GET({ nextUrl: new URL('http://localhost/api?uid=0001234567') })
  assert.equal((await get()).body.lostFine, 300)
  assert.equal(refunds.length, 0, 'preview must not refund')
  authenticated = false; assert.equal((await post()).status, 401); authenticated = true
  activeShift = false; assert.equal((await post()).status, 409); activeShift = true
  queued = true; assert.equal((await post()).status, 409); queued = false
  assert.equal((await post('invalid')).status, 400)
  assert.equal((await post()).body.amount, 300, 'use paid fine, never client amount or parking fee')
  assert.equal(cash, 200); assert.equal(total, 200); assert.equal(qr, 0)
  assert.equal(refunds[0].operatorId, 'current-operator')
  assert.equal((await post()).status, 409, 'no duplicate refund')
  assert.equal((await get()).body, null, 'returned card does not prompt again')
  assert.equal(JSON.stringify(visit), original, 'original payment and exit time remain unchanged')
  refunds.length = 0
  assert.equal((await post('qr')).status, 200); assert.equal(qr, -300)
  const { getMissingCardUids } = load('src/lib/missingCards.ts', {
    '@/models/ParkingSession': { ParkingSession: { aggregate: async () => [{ _id: 'A', sessionId: id, lostCard: true }, { _id: 'B', sessionId: 'other', lostCard: true }, { _id: 'C', sessionId: 'queued', lostCard: true }] } },
    '@/models/Shift': { Shift: { find: () => ({ select: () => ({ lean: async () => [{ cardRefunds: refunds }] }) }) } },
  })
  assert.deepEqual([...await getMissingCardUids(['A', 'B', 'C'], new Set(['C']))], ['B'])
  console.log('Card return tests passed: preview, auth, active shift, queue conflict, exact fine, duplicate prevention, cash/QR, original history, stock recovery.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
