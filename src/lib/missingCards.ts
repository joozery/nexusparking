import { ParkingSession } from '@/models/ParkingSession'
import { Shift } from '@/models/Shift'

export async function getMissingCardUids(uids: string[], occupiedUids: Set<string | undefined>) {
  // A lost card remains registered and enabled, but is not physical stock.
  // A later parking visit (or current queue entry) means it has been used again.
  const latestCardVisits = await ParkingSession.aggregate<{
    _id: string; sessionId: unknown; lostCard?: boolean; lostFine: number; status: string
  }>([
    { $match: { cardUid: { $in: uids }, status: { $ne: 'void' } } },
    { $sort: { entryTime: -1, _id: -1 } },
    { $group: {
      _id: '$cardUid', sessionId: { $first: '$_id' }, lostCard: { $first: '$lostCard' },
      lostFine: { $first: '$lostFine' }, status: { $first: '$status' },
    } },
  ])
  const refundShifts = await Shift.find({ 'cardRefunds.0': { $exists: true } }).select('cardRefunds.sessionId').lean()
  const returnedSessions = new Set(refundShifts.flatMap(shift => (shift.cardRefunds ?? []).map(refund => refund.sessionId)))
  const missingUids = new Set(latestCardVisits
    .filter(visit => !returnedSessions.has(String(visit.sessionId)) && !occupiedUids.has(visit._id)
      && (visit.lostCard === true || visit.lostFine > 0 || visit.status === 'lost'))
    .map(visit => visit._id))
  return missingUids
}
