const fs = require('node:fs')
const ts = require('typescript')
const assert = require('node:assert/strict')
const mod = { exports: {} }
const code = ts.transpileModule(fs.readFileSync('src/lib/calcFee.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
new Function('exports', code)(mod.exports)
const { calcFeeBreakdown, calcFeeFromMinutes } = mod.exports
const date = (day, time) => new Date(`2026-09-${day}T${time}:00`)
function check(type, from, to, expected, night) {
  const result = calcFeeBreakdown(type, from, to)
  assert.equal(result.total, expected, `${type}: ${from} -> ${to}`)
  assert.equal(result.segments.some(s => s.kind === 'overnight'), night)
  assert.equal(calcFeeFromMinutes(type, (to - from) / 60000, from, to), expected)
}
for (const type of ['car', 'motorcycle', 'overnight']) {
  check(type, date(21, '21:00'), date(21, '22:30'), 100, true)
  check(type, date(21, '21:00'), date(21, '23:00'), 100, true)
  check(type, date(21, '23:00'), date(22, '00:30'), type === 'motorcycle' ? 30 : 50, false)
  check(type, date(21, '22:00'), date(21, '23:00'), type === 'motorcycle' ? 20 : 30, false)
  check(type, date(22, '06:30'), date(22, '07:00'), type === 'motorcycle' ? 20 : 30, false)
  check(type, date(21, '21:00'), date(22, '08:00'), 120, true)
}
check('car', date(21, '21:00'), date(21, '21:30'), 30, false)
check('car', date(21, '21:00'), date(21, '22:00'), 30, false)
check('motorcycle', date(21, '21:00'), date(21, '21:30'), 20, false)
check('car', date(21, '09:00'), date(21, '11:00'), 50, false)
check('car', date(21, '05:30'), date(21, '23:00'), 360, true)
check('car', date(21, '21:59'), date(21, '22:01'), 100, true)
check('car', date(21, '23:00'), date(22, '07:00'), 170, false)
const custom = { windowStart: '18:00', windowEnd: '07:00', flatRateStart: '23:00', flatRate: 100, extraHour: 20 }
assert.equal(calcFeeBreakdown('car', date(21, '21:00'), date(21, '22:30'), custom).total, 50)
assert.equal(calcFeeBreakdown('car', date(21, '22:30'), date(22, '00:30'), custom).total, 100)
assert.equal(calcFeeBreakdown('car', date(21, '23:00'), date(22, '00:30'), custom).total, 50)
assert.equal(calcFeeBreakdown('car', date(21, '23:00'), date(22, '01:30'), { ...custom, flatRateStart: '01:00' }).total, 100)
console.log('Overnight fees passed: entry cutoff, late arrivals hourly, midnight, morning cutoff, extra hours, and daytime rates.')
