/** Preserve entire lost-card visits, including legacy representations and active visits. */
export const clearParkingHistoryFilter = {
  status: { $in: ['completed', 'void'] as const },
  exitTime: { $type: 'date' as const },
  lostCard: { $ne: true },
  lostFine: { $not: { $gt: 0 } },
  cardUid: { $ne: 'LOST' },
}
