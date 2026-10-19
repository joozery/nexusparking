import { ParkingSession } from '@/models/ParkingSession'
import { Shift } from '@/models/Shift'

export async function getCardStatusUids(uids: string[], occupiedUids: Set<string | undefined>) {
  // A lost card remains registered and enabled, but is not physical stock.
  // A later parking visit (or current queue entry) means it has been used again.
  const latestCardVisits = await ParkingSession.aggregate<{
    _id: string; sessionId: unknown; lostCard?: boolean; lostFine: number; status: string; exitTime?: Date
  }>([
    { $match: { cardUid: { $in: uids }, status: { $ne: 'void' } } },
    { $sort: { entryTime: -1, _id: -1 } },
    { $group: {
      _id: '$cardUid', sessionId: { $first: '$_id' }, lostCard: { $first: '$lostCard' },
      lostFine: { $first: '$lostFine' }, status: { $first: '$status' }, exitTime: { $first: '$exitTime' },
    } },
  ])
  const refundShifts = await Shift.find({ 'cardRefunds.0': { $exists: true } }).select('cardRefunds.sessionId').lean()
  const returnedSessions = new Set(refundShifts.flatMap(shift => (shift.cardRefunds ?? []).map(refund => refund.sessionId)))
  const lostVisits = latestCardVisits.filter(visit => !returnedSessions.has(String(visit.sessionId)) && !occupiedUids.has(visit._id)
    && (visit.lostCard === true || visit.lostFine > 0 || visit.status === 'lost'))
  const cancelledUids = new Set(lostVisits
    .filter(visit => visit.exitTime && Date.now() >= new Date(visit.exitTime).getTime() + 30 * 24 * 60 * 60 * 1000)
    .map(visit => visit._id))
  const missingUids = new Set(lostVisits.filter(visit => !cancelledUids.has(visit._id)).map(visit => visit._id))
  return { missingUids, cancelledUids }
}

export async function getMissingCardUids(uids: string[], occupiedUids: Set<string | undefined>) {
  return (await getCardStatusUids(uids, occupiedUids)).missingUids
}
