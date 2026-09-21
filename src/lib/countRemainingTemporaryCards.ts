import { ParkingCard } from '@/models/ParkingCard'
import { ParkingSession } from '@/models/ParkingSession'
import { ParkingQueue } from '@/models/ParkingQueue'

// Same definition as the fleet bar: enabled temporary cards, excluding occupied UIDs.
export async function countRemainingTemporaryCards() {
  const [cards, sessions, queues] = await Promise.all([
    ParkingCard.find({ isActive: true, $or: [{ cardCategory: 'temporary' }, { cardCategory: { $exists: false } }] }).select('uid type').lean(),
    ParkingSession.find({ status: 'active' }).select('cardUid').lean(),
    ParkingQueue.find({ status: 'waiting' }).select('cardUid').lean(),
  ])
  const occupied = new Set([...sessions.map(s => s.cardUid), ...queues.map(q => q.cardUid)])
  const remaining = cards.filter(card => !occupied.has(card.uid))
  return {
    car: remaining.filter(card => card.type === 'car' || card.type === 'overnight').length,
    motorcycle: remaining.filter(card => card.type === 'motorcycle').length,
  }
}
