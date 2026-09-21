import mongoose, { Schema } from 'mongoose'
import { randomUUID } from 'node:crypto'
import { connectDB } from './mongodb'
import { getSettings } from '@/models/SystemSettings'
import { buildDailyReport } from './dailyReport'
import { splitLineReport, thaiDayStart } from './dailyReportFormat'

const DAY = 86_400_000
const cursorSchema = new Schema({ _id: String, nextEnd: { type: Date, required: true } })
const deliverySchema = new Schema({
  target: { type: String, required: true }, text: { type: String, required: true },
  key: { type: String, required: true }, sent: { type: Boolean, default: false },
  firstAttempt: Date,
}, { _id: false })
const jobSchema = new Schema({
  _id: String, deliveries: [deliverySchema], status: { type: String, default: 'pending' },
  lease: Date, owner: String, retryAt: Date, error: String,
}, { timestamps: true })
const Cursor = mongoose.models.DailyLineCursor as mongoose.Model<mongoose.InferSchemaType<typeof cursorSchema>>
  ?? mongoose.model('DailyLineCursor', cursorSchema)
const Job = mongoose.models.DailyLineJob as mongoose.Model<mongoose.InferSchemaType<typeof jobSchema>>
  ?? mongoose.model('DailyLineJob', jobSchema)

async function tick() {
  await connectDB()
  const cfg = await getSettings()
  if (!cfg.line?.enabled || !cfg.line.channelToken || !cfg.line.targets.length) return
  // First activation starts with today's report, not a flood of historical reports.
  try {
    await Cursor.updateOne({ _id: 'daily' }, { $setOnInsert: { nextEnd: new Date(thaiDayStart(new Date()).getTime() + DAY) } }, { upsert: true })
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error
  }
  const cursor = await Cursor.findById('daily').lean()
  if (cursor && cursor.nextEnd <= new Date()) {
    const end = cursor.nextEnd
    const start = new Date(end.getTime() - DAY)
    const id = start.toISOString()
    if (!await Job.exists({ _id: id })) {
      const text = splitLineReport(await buildDailyReport(start, end))
      const deliveries = [...new Set(cfg.line.targets)].flatMap(target => text.map(part => ({ target, text: part, key: randomUUID(), sent: false })))
      try { await Job.updateOne({ _id: id }, { $setOnInsert: { deliveries, status: 'pending' } }, { upsert: true }) }
      catch (error) { if ((error as { code?: number }).code !== 11000) throw error }
    }
    await Cursor.updateOne({ _id: 'daily', nextEnd: end }, { $set: { nextEnd: new Date(end.getTime() + DAY) } })
  }

  const owner = randomUUID()
  const now = new Date()
  const job = await Job.findOneAndUpdate({
    status: 'pending',
    $and: [
      { $or: [{ lease: null }, { lease: { $lt: now } }] },
      { $or: [{ retryAt: null }, { retryAt: { $lte: now } }] },
    ],
  }, { $set: { owner, lease: new Date(Date.now() + 600_000) } }, { new: true, sort: { _id: 1 } })
  if (!job) return
  try {
    for (let index = 0; index < job.deliveries.length; index++) {
      const delivery = job.deliveries[index]
      if (delivery.sent) continue
      // LINE retry keys expire in 24h. Stop rather than risk duplicate delivery.
      if (delivery.firstAttempt && Date.now() - delivery.firstAttempt.getTime() >= 23 * 3_600_000) {
        await Job.updateOne({ _id: job._id, owner }, { $set: { status: 'needs_review', error: 'Retry window expired; verify delivery before resending' } })
        return
      }
      const firstAttempt = delivery.firstAttempt ?? new Date()
      const lock = await Job.updateOne({ _id: job._id, owner }, { $set: {
        [`deliveries.${index}.firstAttempt`]: firstAttempt,
        lease: new Date(Date.now() + 600_000),
      } })
      if (!lock.matchedCount) return
      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST', signal: AbortSignal.timeout(20_000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.line.channelToken}`, 'X-Line-Retry-Key': delivery.key },
        body: JSON.stringify({ to: delivery.target, messages: [{ type: 'text', text: delivery.text }] }),
      })
      if (!response.ok && !(response.status === 409 && response.headers.has('x-line-accepted-request-id'))) {
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          await Job.updateOne({ _id: job._id, owner }, { $set: { status: 'needs_review', error: `LINE HTTP ${response.status}` } })
          console.error('[daily-line] Delivery needs review:', response.status)
          return
        }
        throw new Error(`LINE HTTP ${response.status}`)
      }
      await Job.updateOne({ _id: job._id, owner }, { $set: { [`deliveries.${index}.sent`]: true } })
    }
    await Job.updateOne({ _id: job._id, owner }, { $set: { status: 'sent', error: '' } })
  } catch (error) {
    await Job.updateOne({ _id: job._id, owner }, { $set: { retryAt: new Date(Date.now() + 300_000), error: error instanceof Error ? error.message : 'Delivery failed' } })
    throw error
  } finally {
    await Job.updateOne({ _id: job._id, owner }, { $unset: { lease: '', owner: '' } })
  }
}

const state = globalThis as typeof globalThis & { dailyLineTimer?: ReturnType<typeof setTimeout> }
export function startDailyReportScheduler() {
  if (state.dailyLineTimer) return
  const run = async () => {
    try { await tick() } catch (error) { console.error('[daily-line]', error instanceof Error ? error.name : 'Error') }
    // Align to the next minute so midnight is evaluated without browser activity.
    state.dailyLineTimer = setTimeout(run, 60_000 - Date.now() % 60_000)
    state.dailyLineTimer.unref()
  }
  state.dailyLineTimer = setTimeout(run, 1000)
  state.dailyLineTimer.unref()
}
