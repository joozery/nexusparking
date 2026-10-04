/** Base filter for completed visits. Lost-card visits are filtered by refund history in the API. */
export const clearParkingHistoryFilter = {
  status: { $in: ['completed', 'void'] as const },
  exitTime: { $type: 'date' as const },
  cardUid: { $ne: 'LOST' },
}
