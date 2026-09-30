const fs = require('node:fs')
const assert = require('node:assert/strict')
const ts = require('typescript')
const Excel = require('exceljs')
function load(file, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => name in imports ? imports[name] : require(name), mod, mod.exports)
  return mod.exports
}
const { sessionFilters } = load('src/lib/sessionFilters.ts')
const { historyValues, buildHistoryWorkbook } = load('src/lib/sessionHistoryExport.ts')
const filter = sessionFilters(new URLSearchParams({ plate: '1234', dateFrom: '2026-09-01', dateTo: '2026-09-30' }))
assert.deepEqual(filter.status, { $ne: 'void' })
assert.deepEqual(filter.plate, { $regex: '1234', $options: 'i' })
assert.equal(filter.entryTime.$gte.getDate(), 1)
assert.equal(filter.entryTime.$lte.getHours(), 23)
assert.throws(() => sessionFilters(new URLSearchParams({ dateFrom: '2026-09-30', dateTo: '2026-09-01' })))
const fixture = {
  _id: 'visit-1', plate: 'กข1234', cardUid: 'CARD-1', cardType: 'car',
  entryTime: '2026-09-01T03:00:00Z', exitTime: '2026-09-01T05:00:00Z',
  durationMin: 120, fee: 50, discountName: 'คูปอง', discountAmount: 10,
  fineName: 'ค่าปรับอื่น', fineAmount: 20, lostFine: 0, totalFee: 60, status: 'completed', paymentMethod: 'cash',
}
async function main() {
  let role = 'admin', requestedFilter, requestedSort
  const rows = Array.from({ length: 45 }, (_, i) => ({ ...fixture, _id: `visit-${i}` }))
  const route = load('src/app/api/reports/history/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    'next/headers': { cookies: async () => ({ get: () => ({ value: 'token' }) }) },
    '@/lib/auth': { COOKIE_NAME: 'auth', verifyToken: () => ({ role }) },
    '@/lib/mongodb': { connectDB: async () => {} }, '@/lib/sessionFilters': { sessionFilters },
    '@/models/ParkingSession': { ParkingSession: { find(query) {
      requestedFilter = query
      return { select() { return this }, sort(value) { requestedSort = value; return this }, lean: async () => rows }
    } } },
  })
  const response = await route.GET({ nextUrl: new URL('http://localhost/api/reports/history?plate=1234&dateFrom=2026-09-01&dateTo=2026-09-30&page=2&limit=20') })
  assert.equal(response.body.sessions.length, 45, 'export all matches, not the 20-row screen page')
  assert.deepEqual(requestedFilter, filter)
  assert.deepEqual(requestedSort, { entryTime: -1, _id: -1 })
  role = 'operator'; assert.equal((await route.GET({})).status, 403); role = 'admin'
  assert.equal((await route.GET({ nextUrl: new URL('http://localhost/?dateFrom=invalid') })).status, 400)

  const options = { includePhotos: false, signal: new AbortController().signal, description: 'ทะเบียนทั้งหมด', onProgress() {} }
  const book = await buildHistoryWorkbook(new Excel.Workbook(), rows, options, () => { throw Error('Must not fetch photos when unchecked') })
  const copy = new Excel.Workbook(); await copy.xlsx.load(await book.xlsx.writeBuffer())
  const sheet = copy.getWorksheet('ประวัติรายการ')
  assert.equal(sheet.rowCount, 46)
  assert.equal(sheet.getCell('H2').value, 50)
  assert.equal(sheet.getCell('N2').value, 60)
  assert.equal(sheet.getCell('B2').value, 'กข1234')
  assert.equal(sheet.getImages().length, 0)
  assert.equal(copy.worksheets[0].columnCount, 17)
  assert.match(historyValues({ ...fixture, lostCard: true })[15], /บัตรหาย/)

  const jpeg = await require('sharp')({ create: { width: 100, height: 50, channels: 3, background: '#123456' } }).jpeg().toBuffer()
  const calls = []
  const photoBook = await buildHistoryWorkbook(new Excel.Workbook(), [fixture, { ...fixture, _id: 'missing' }], { ...options, includePhotos: true }, async (row, type) => {
    calls.push([row._id, type])
    if (row._id === 'missing') return { message: type === 'entry' ? 'ไม่มีภาพขาเข้า' : 'ไม่มีภาพขาออก' }
    return { data: `data:image/jpeg;base64,${jpeg.toString('base64')}`, width: 100, height: 50 }
  })
  const loaded = new Excel.Workbook(); await loaded.xlsx.load(await photoBook.xlsx.writeBuffer())
  const images = loaded.getWorksheet('ประวัติรายการ').getImages()
  assert.equal(images.length, 2, 'both entry and exit images embedded')
  assert.equal(Math.floor(images[0].range.tl.col), 17)
  assert.equal(Math.floor(images[1].range.tl.col), 18)
  assert.equal(loaded.getWorksheet('ประวัติรายการ').getCell('R3').value, 'ไม่มีภาพขาเข้า')
  assert.equal(loaded.getWorksheet('ประวัติรายการ').getCell('S3').value, 'ไม่มีภาพขาออก')
  assert.deepEqual(calls, [['visit-1', 'entry'], ['visit-1', 'exit'], ['missing', 'entry'], ['missing', 'exit']])
  const controller = new AbortController(); controller.abort()
  await assert.rejects(buildHistoryWorkbook(new Excel.Workbook(), rows, { ...options, signal: controller.signal }))
  console.log('History export tests passed: full filtered dataset, authorization, Thai/numeric Excel cells, both embedded photos, absent photos and cancellation. No database writes.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
