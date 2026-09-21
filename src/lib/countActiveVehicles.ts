import { ParkingSession } from '@/models/ParkingSession'
import type { VehicleCounts } from './shiftVehicleCounts'

export async function countActiveVehicles(): Promise<VehicleCounts> {
  const rows = await ParkingSession.aggregate<{ _id: string; count: number }>([
    { $match: { status: 'active' } },
    { $group: { _id: '$cardType', count: { $sum: 1 } } },
  ])
  return {
    car: rows.filter(row => row._id === 'car' || row._id === 'overnight').reduce((sum, row) => sum + row.count, 0),
    motorcycle: rows.find(row => row._id === 'motorcycle')?.count ?? 0,
  }
}
