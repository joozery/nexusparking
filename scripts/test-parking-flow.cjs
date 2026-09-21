const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const mongoose = require('mongoose')
require('@next/env').loadEnvConfig(process.cwd())

function load(file, overrides = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  new Function('require', 'exports', code)(name => overrides[name] ?? require(name), exports)
  return exports
}

async function main() {
  const { createHidScan, hidKey } = load('src/lib/hidScan.ts')
  const thaiNumberRow = 'ขขขภุภคตคข'
  const expectedUid = '0003537870'
  assert.equal([...expectedUid].map((digit, i) => hidKey({ code: `Digit${digit}`, key: thaiNumberRow[i] })).join(''), expectedUid)
  assert.equal(hidKey({ code: 'KeyA', key: 'ฟ' }), 'A')
  assert.equal(hidKey({ code: 'Numpad7', key: 'Home' }), '7')
  assert.equal(hidKey({ code: 'KeyV', key: 'อ', ctrlKey: true }), null)
  assert.equal(hidKey({ code: 'Enter', key: 'Enter' }), 'Enter')
  const fast = createHidScan()
  let now = 1000
  for (const key of '0003537870') { assert.equal(fast(key, now), null); now += 8 }
  assert.equal(fast('Enter', now), '0003537870')
  assert.equal(fast('Enter', now + 8), null, 'one burst emits only once')
  const slow = createHidScan()
  for (const key of '1111') { slow(key, now); now += 250 }
  assert.equal(slow('Enter', now), null, 'manual search is not a tap')
  if (process.argv.includes('--hid-only')) {
    console.log('PASS: Thai/English physical keys, numpad, shortcuts, scan burst and manual typing')
    return
  }

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 })
  // Isolated test collection only; never touches real parking records or locks.
  const collectionName = `test_parking_mutex_${Date.now()}`
  const collection = mongoose.connection.db.collection(collectionName)
  const { parkingMutation } = load('src/lib/parkingMutation.ts', {
    './mongodb': { connectDB: async () => ({ connection: { collection: () => collection } }) },
  })
  try {
    let release, entered
    const inside = new Promise(resolve => { entered = resolve })
    const hold = new Promise(resolve => { release = resolve })
    let writes = 0
    const first = parkingMutation(async () => { writes++; entered(); await hold; return new Response('ok') })()
    await inside
    const contender = await parkingMutation(async () => { writes++; return new Response('unexpected') })()
    assert.equal(contender.status, 409)
    assert.equal(writes, 1, 'second process must not run mutation')
    release()
    await first
    assert.equal((await parkingMutation(async () => new Response('next'))()).status, 200)
    await assert.rejects(parkingMutation(async () => { throw new Error('failed write') })(), /failed write/)
    assert.equal(await collection.countDocuments(), 0, 'release on handler failure')
    await collection.insertOne({ _id: 'parking', owner: 'crashed-writer', createdAt: new Date(0) })
    assert.equal((await parkingMutation(async () => new Response('unsafe takeover'))()).status, 409)
    assert.equal((await collection.findOne({ _id: 'parking' })).owner, 'crashed-writer')
    console.log('PASS: HID burst/manual input, concurrent DB lock, release, and no stale-owner takeover')
  } finally {
    await collection.drop()
    await mongoose.disconnect()
  }
}
main().catch(async error => { console.error(error.message); await mongoose.disconnect(); process.exitCode = 1 })
