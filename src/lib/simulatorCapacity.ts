type VehicleType = 'car' | 'motorcycle' | 'overnight'
export interface CapacityVisit {
  cardType: VehicleType
  entryTime: Date
  exitTime?: Date | null
  parkingStartedAt?: Date | null
  neverParked?: boolean
}
export interface CapacityQueue {
  cardType: VehicleType
  joinedAt: Date
  status: string
  enteredAt?: Date | null
  cancelledAt?: Date | null
}

/** Replay arrivals only. Waiting vehicles enter through the operator's explicit action. */
export function needsParkingQueue(visit: CapacityVisit, capacity: { car: number; motorcycle: number }, sessions: CapacityVisit[], queues: CapacityQueue[]) {
  const bucket = (type: VehicleType) => type === 'motorcycle' ? 'motorcycle' : 'car'
  const type = bucket(visit.cardType)
  const start = visit.entryTime.getTime()
  const end = visit.exitTime?.getTime() ?? Infinity
  // Reserve a place for the whole visit, including already recorded later arrivals.
  let count = 0
  const events: { time: number; delta: number }[] = []
  for (const s of sessions) {
    if (s.neverParked || bucket(s.cardType) !== type) continue
    const from = (s.parkingStartedAt ?? s.entryTime).getTime(), to = s.exitTime?.getTime() ?? Infinity
    if (to <= start || from >= end) continue
    if (from <= start) count++
    else events.push({ time: from, delta: 1 })
    if (to < end) events.push({ time: to, delta: -1 })
  }
  if (count >= capacity[type]) return true
  events.sort((a, b) => a.time - b.time || a.delta - b.delta)
  for (const event of events) { count += event.delta; if (count >= capacity[type]) return true }
  // New imports must not overtake cars already waiting.
  return queues.some(q => bucket(q.cardType) === type && q.joinedAt.getTime() <= start
    && ((q.enteredAt ?? q.cancelledAt)?.getTime() ?? Infinity) > start)
}
