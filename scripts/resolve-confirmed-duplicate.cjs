// User-confirmed correction: card 0003537848 belongs to active plate 1111.
const mongoose = require('mongoose')
require('@next/env').loadEnvConfig(process.cwd())
async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 })
  const db = mongoose.connection.db
  const locks = db.collection('parking_mutation_locks')
  const owner = 'confirmed-duplicate-7848'
  await locks.insertOne({ _id: 'parking', owner, createdAt: new Date() })
  try {
    const sessions = db.collection('parkingsessions')
    const keepId = new mongoose.Types.ObjectId('6ab0d21983915cd3bf626fc5')
    const voidId = new mongoose.Types.ObjectId('6ab0d21b83915cd3bf626fc7')
    const keep = await sessions.findOne({ _id: keepId, cardUid: '0003537848', plate: '1111', status: 'active' })
    if (!keep) throw new Error('Confirmed live record changed; correction aborted')
    const duplicate = await sessions.findOne({ _id: voidId, cardUid: '0003537848', plate: '4785' })
    if (!duplicate || !['active', 'void'].includes(duplicate.status)) throw new Error('Duplicate record changed; correction aborted')
    if (duplicate.status === 'active') {
      if (duplicate.exitTime || duplicate.totalFee > 0) throw new Error('Record has payment/exit data; correction aborted')
      await db.collection('parking_corrections').updateOne({ _id: 'confirmed-duplicate-7848' }, { $setOnInsert: {
        before: duplicate, retainedSessionId: keepId, createdAt: new Date(),
        reason: 'User confirmed plate 1111 is the real vehicle. Void duplicate plate 4785; no checkout or payment.',
      } }, { upsert: true })
      const result = await sessions.updateOne({ _id: voidId, status: 'active', cardUid: '0003537848' }, { $set: {
        status: 'void', updatedAt: new Date(),
        note: 'ยกเลิกข้อมูลซ้ำ: ผู้ใช้ยืนยันรถจริงทะเบียน 1111 บัตร 0003537848; ไม่ใช่การรับเงินหรือปล่อยรถออก',
      } })
      if (result.modifiedCount !== 1) throw new Error('Record changed during correction')
    }
    await sessions.createIndex({ cardUid: 1 }, { name: 'one_active_session_per_card', unique: true, partialFilterExpression: { status: 'active' } })
    await db.collection('parkingqueues').createIndex({ cardUid: 1 }, { name: 'one_waiting_queue_per_card', unique: true, partialFilterExpression: { status: 'waiting', cardUid: { $type: 'string' } } })
    console.log(JSON.stringify({ activeForCard: await sessions.countDocuments({ cardUid: '0003537848', status: 'active' }), retainedPlate: keep.plate, duplicateStatus: (await sessions.findOne({ _id: voidId })).status, uniqueIndexes: 'created' }))
  } finally {
    await locks.deleteOne({ _id: 'parking', owner })
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => mongoose.disconnect())
