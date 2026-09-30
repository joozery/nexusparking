const fs = require('node:fs')
const assert = require('node:assert/strict')
const ts = require('typescript')
const XLSX = require('xlsx')
const match = require('sift').default
// Sift accepts the Date constructor where MongoDB accepts the BSON alias "date".
const sift = query => match(query.exitTime?.$type === 'date' ? { ...query, exitTime: { $type: Date } } : query)
function load(file, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => {
    if (name in imports) return imports[name]
    if (name.startsWith('@/')) throw Error(`Unexpected dependency: ${name}`)
    return require(name)
  }, mod, mod.exports)
  return mod.exports
}
const helpers = load('src/lib/simulatorImport.ts')
const { parseDateTimeSplit: date, importDiscounts, nowLocal } = helpers
assert.equal(date('08/09/2024', '09:00').getMonth(), 8)
assert.equal(date('14/08/2567', '00:00').getFullYear(), 2024)
assert.equal(date('2024-08-14', 0).getHours(), 0)
assert.equal(date(46210, 0.7333333333333334).getHours(), 17)
assert.equal(date(1, 0, true).getFullYear(), 1904)
for (const [d, t] of [['31/02/2024', '10:00'], ['14/08/2024', '24:00'], ['14/08/2024', '10:60'], ['14/08/2024', 'oops'], ['14/08/2024', null]]) assert.equal(date(d, t), null)
assert.equal(new Date(nowLocal()).getHours(), new Date().getHours())
const discounts = [
  { _id: 'shop', name: 'Shop', discountType: 'percent', discountValue: 15 },
  { _id: 'hotel', name: 'h1', discountType: 'per_day', discountValue: 40 },
]
assert.equal(importDiscounts(30, 0, 'Shop', '', discounts).total, 4)
assert.equal(importDiscounts(100, 2, 'Shop', 'h1', discounts).total, 80)
assert.equal(importDiscounts(30, 0, '', 'h1', discounts).total, 0)
assert.equal(importDiscounts(30, 2, '', 'h1', discounts).final, 0)
assert.throws(() => importDiscounts(100, 1, '', 'h', discounts))
assert.throws(() => importDiscounts(100, 1, 'h1', '', discounts))

const filterModule = load('src/lib/clearParkingHistory.ts')
const filter = filterModule.clearParkingHistoryFilter
const base = { cardUid: 'CARD-1', cardType: 'car', plate: '1234', status: 'completed', entryTime: new Date('2026-01-01T09:00:00+07:00'), exitTime: new Date('2026-01-01T10:00:00+07:00') }
const protectedVisits = [
  { ...base, _id: 'active', status: 'active', exitTime: undefined },
  { ...base, _id: 'active-with-exit', status: 'active' },
  { ...base, _id: 'no-exit', exitTime: undefined },
  { ...base, _id: 'null-exit', exitTime: null },
  { ...base, _id: 'lost-status', status: 'lost' },
  { ...base, _id: 'lost-flag-zero-fine', lostCard: true, lostFine: 0 },
  { ...base, _id: 'legacy-fine', lostFine: 300 },
  { ...base, _id: 'legacy-uid', cardUid: 'LOST' },
]
assert.deepEqual(protectedVisits.filter(sift(filter)), [])
assert.equal(sift(filter)(base), true)
assert.equal(sift(filter)({ ...base, isSimulated: true }), true)

let visits = protectedVisits.concat([{ ...base, _id: 'normal' }, { ...base, _id: 'simulation', isSimulated: true }])
let role = 'admin'
let settings = { rates: { overnight: { windowStart: '18:00', windowEnd: '07:00', flatRateStart: '22:00', flatRate: 100, extraHour: 20 } } }
const route = load('src/app/api/simulate/route.ts', {
  'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
  'next/headers': { cookies: async () => ({ get: () => ({ value: 'token' }) }) },
  '@/lib/auth': { COOKIE_NAME: 'auth', verifyToken: () => ({ role }) },
  '@/lib/mongodb': { connectDB: async () => {} },
  '@/lib/parkingMutation': { parkingMutation: fn => fn },
  '@/lib/simulatorImport': helpers,
  '@/lib/clearParkingHistory': filterModule,
  '@/lib/calcFee': load('src/lib/calcFee.ts'),
  '@/models/SystemSettings': { getSettings: async () => settings },
  '@/models/Discount': { Discount: { find: () => ({ lean: async () => discounts }) } },
  '@/models/ParkingSession': { ParkingSession: {
    find: query => ({ select() { return this }, sort() { return this }, lean: async () => visits.filter(sift(query)) }),
    deleteMany: async query => { const removed = visits.filter(sift(query)); visits = visits.filter(v => !removed.includes(v)); return { deletedCount: removed.length } },
    insertMany: async docs => { const added = docs.map((doc, i) => ({ ...doc, _id: 'import-' + i })); visits.push(...added); return added },
  } },
})
const request = body => ({ json: async () => body })
const resetRoute = load('src/app/api/reset/route.ts', { '@/app/api/simulate/route': route })
async function main() {
  const before = JSON.stringify(visits)
  const preview = await route.GET()
  assert.equal(preview.body.count, 2)
  assert.equal(JSON.stringify(visits), before, 'preview does not delete')
  assert.equal((await route.DELETE(request({}))).status, 409)
  role = 'operator'
  assert.equal((await route.DELETE(request({ token: preview.body.token, confirmation: 'CLEAR_COMPLETED_HISTORY' }))).status, 403)
  assert.equal((await route.POST(request([]))).status, 403)
  role = 'admin'
  visits.push({ ...base, _id: 'new-completed' })
  assert.equal((await route.DELETE(request({ token: preview.body.token, confirmation: 'CLEAR_COMPLETED_HISTORY' }))).status, 409)
  const refreshed = await route.GET()
  assert.equal((await route.DELETE(request({ token: refreshed.body.token, confirmation: 'CLEAR_COMPLETED_HISTORY' }))).body.deleted, 3)
  assert.deepEqual(visits, protectedVisits, 'preserve full lost-card/active records including entry and exit times')

  // The general-settings reset must have exactly the same protection as Simulator.
  visits.push({ ...base, _id: 'settings-completed' })
  const settingsBefore = JSON.stringify(visits)
  const discountBefore = JSON.stringify(discounts)
  const configurationBefore = JSON.stringify(settings)
  assert.equal((await resetRoute.DELETE({ json: async () => { throw new SyntaxError('Empty body from old client') } })).status, 400)
  assert.equal(JSON.stringify(visits), settingsBefore, 'old reset clients cannot erase data without a preview')
  role = 'operator'
  assert.equal((await resetRoute.GET()).status, 403)
  assert.equal((await resetRoute.DELETE(request({}))).status, 403)
  role = 'admin'
  const resetPreview = await resetRoute.GET()
  assert.equal(resetPreview.body.count, 1)
  assert.equal((await resetRoute.DELETE(request({ token: 'stale', confirmation: 'CLEAR_COMPLETED_HISTORY' }))).status, 409)
  assert.equal((await resetRoute.DELETE(request({ token: resetPreview.body.token, confirmation: 'CLEAR_COMPLETED_HISTORY' }))).body.deleted, 1)
  assert.deepEqual(visits, protectedVisits, 'settings reset preserves every protected visit')
  assert.equal(JSON.stringify(discounts), discountBefore)
  assert.equal(JSON.stringify(settings), configurationBefore)

  visits = []
  const row = { plate: 'TEST', cardType: 'car', entryTime: '2026-01-01T09:00:00+07:00', exitTime: '2026-01-01T10:00:00+07:00', paymentMethod: 'cash', shopDiscountName: 'Shop' }
  let result = await route.POST(request({ mode: 'preview', rows: [row, row] }))
  assert.equal(result.body.ready, 1); assert.equal(result.body.duplicates, 1); assert.equal(result.body.total, 26)
  assert.equal(visits.length, 0, 'import preview does not insert')
  assert.equal((await route.POST(request({ mode: 'commit', rows: [row, row], token: 'stale' }))).status, 409)
  const commit = await route.POST(request({ mode: 'commit', rows: [row, row], token: result.body.token }))
  assert.equal(commit.body.created, 1)
  assert.equal(visits[0].isSimulated, undefined)
  assert.equal(visits[0].entryTime.toISOString(), new Date(row.entryTime).toISOString())
  assert.equal(visits[0].exitTime.toISOString(), new Date(row.exitTime).toISOString())
  assert.equal(visits[0].totalFee, 26)
  result = await route.POST(request({ mode: 'preview', rows: [row] }))
  assert.equal(result.body.ready, 0); assert.equal(result.body.duplicates, 1)
  const invalid = await route.POST(request({ mode: 'preview', rows: [{ ...row, shopDiscountName: 'Missing' }] }))
  assert.equal(invalid.body.errors, 1)
  assert.equal((await route.POST(request({ mode: 'commit', rows: [{ ...row, shopDiscountName: 'Missing' }], token: invalid.body.token }))).status, 400)
  assert.equal(visits.length, 1)
  const hotel = { ...row, plate: 'NIGHT', entryTime: '2026-01-01T19:00:00+07:00', exitTime: '2026-01-02T06:00:00+07:00', shopDiscountName: '', hotelDiscountName: 'h1', paymentMethod: 'qr' }
  const hotelPreview = await route.POST(request({ mode: 'preview', rows: [hotel] }))
  assert.equal(hotelPreview.body.total, 60)
  settings.rates.overnight.flatRate = 120
  assert.equal((await route.POST(request({ mode: 'commit', rows: [hotel], token: hotelPreview.body.token }))).status, 409)
  assert.equal(visits.length, 1)
  assert.equal((await route.POST(request({ mode: 'preview', rows: [{ ...row, entryTime: '2026-01-01T09:00:00' }] }))).body.errors, 1)

  if (process.argv[2]) {
    const wb = XLSX.readFile(process.argv[2])
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null })
    const invalid = [], data = raw.slice(1).filter(r => r.some(v => v !== null && v !== ''))
    data.forEach((r, i) => {
      const entry = date(r[2], r[3], Boolean(wb.Workbook?.WBProps?.date1904)), exit = date(r[4], r[5], Boolean(wb.Workbook?.WBProps?.date1904))
      if (!entry || !exit || exit <= entry) invalid.push(i + 2)
    })
    console.log(JSON.stringify({ workbookRows: data.length, invalidDateRows: invalid }))
  }
  console.log('Simulator tests passed: strict dates, discounts, preview, commit, duplicates, stale previews, auth and protected history. No real database writes.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
