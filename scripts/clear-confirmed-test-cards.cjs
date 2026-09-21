// Explicitly authorized cleanup: all registered cards and these two test lost-card visits.
const mongoose = require('mongoose')
require('@next/env').loadEnvConfig(process.cwd())
const auditId = 'user-confirmed-card-cleanup-2026-09-21'
async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 })
  const db = mongoose.connection.db
  const audits = db.collection('parking_corrections')
  if (await audits.findOne({ _id: auditId })) throw new Error('Backup already exists; inspect cleanup status before retrying')
  const locks = db.collection('parking_mutation_locks')
  await locks.insertOne({ _id: 'parking', owner: auditId, createdAt: new Date() })
  try {
    const sessions = db.collection('parkingsessions'), cards = db.collection('parkingcards'), shifts = db.collection('shifts')
    if (await sessions.countDocuments({ status: 'active' }) || await db.collection('parkingqueues').countDocuments({ status: 'waiting' })) throw new Error('Active vehicles or waiting queues found; aborted')
    const ids = ['6ab0d83c83915cd3bf62703b', '6ab0dee714a6517d7f5d733c'].map(id => new mongoose.Types.ObjectId(id))
    const lost = await sessions.find({ _id: { $in: ids } }).toArray()
    if (lost.length !== 2 || lost.some(s => s.status !== 'completed' || s.lostFine !== 300) || lost.reduce((n, s) => n + s.totalFee, 0) !== 620) throw new Error('Test records changed; aborted')
    const cardRows = await cards.find({}).toArray()
    if (cardRows.length !== 13) throw new Error('Card inventory changed; aborted')
    const shiftRows = await shifts.find({ _id: { $in: lost.map(s => new mongoose.Types.ObjectId(s.shiftId)) } }).toArray()
    const adjustments = lost.map(s => {
      const shift = shiftRows.find(row => String(row._id) === s.shiftId)
      const paymentField = s.paymentMethod === 'qr' ? 'qrAmount' : 'cashAmount'
      if (!shift || shift.checkoutsCount < 1 || shift.totalAmount < s.totalFee || shift[paymentField] < s.totalFee) throw new Error('Shift balances inconsistent; aborted')
      const decrement = { checkoutsCount: -1, totalAmount: -s.totalFee, [paymentField]: -s.totalFee }
      if (shift.checkoutsByType) {
        const type = s.cardType === 'motorcycle' ? 'motorcycle' : 'car'
        if (shift.checkoutsByType[type] < 1) throw new Error('Shift type count inconsistent; aborted')
        decrement[`checkoutsByType.${type}`] = -1
      }
      return { shift, decrement }
    })
    await audits.insertOne({ _id: auditId, createdAt: new Date(), status: 'backed_up', reason: 'User requested deletion of all cards and test lost-card records', cards: cardRows, sessions: lost, shifts: shiftRows })
    for (const { shift, decrement } of adjustments) {
      const result = await shifts.updateOne({ _id: shift._id, checkoutsCount: shift.checkoutsCount, totalAmount: shift.totalAmount, cashAmount: shift.cashAmount, qrAmount: shift.qrAmount }, { $inc: decrement, $set: { updatedAt: new Date() } })
      if (result.modifiedCount !== 1) throw new Error('Shift changed during cleanup; review backup')
      await audits.updateOne({ _id: auditId }, { $push: { adjustedShifts: shift._id } })
    }
    const removedSessions = await sessions.deleteMany({ _id: { $in: ids }, status: 'completed', lostFine: 300 })
    const removedCards = await cards.deleteMany({ _id: { $in: cardRows.map(c => c._id) } })
    const remainingCards = await cards.countDocuments({})
    const remainingLost = await sessions.countDocuments({ $or: [{ lostCard: true }, { lostFine: { $gt: 0 } }, { status: 'lost' }] })
    await audits.updateOne({ _id: auditId }, { $set: { status: 'complete', completedAt: new Date(), removedSessions: removedSessions.deletedCount, removedCards: removedCards.deletedCount } })
    console.log(JSON.stringify({ removedCards: removedCards.deletedCount, removedTestSessions: removedSessions.deletedCount, removedRevenue: 620, remainingCards, remainingLost, backup: `parking_corrections/${auditId}` }))
  } finally { await locks.deleteOne({ _id: 'parking', owner: auditId }) }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => mongoose.disconnect())
