import { ParkingSession } from '@/models/ParkingSession'
import { calcFeeBreakdown, type OvernightConfig } from './calcFee'
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

export interface ActiveVehicleBillingCounts {
  carNormal: number
  carOvernight: number
  motorcycleNormal: number
  motorcycleOvernight: number
}

/** Classify active vehicles using the same overnight billing rule as checkout. */
export async function countActiveVehiclesByBilling(
  overnight: OvernightConfig,
  at = new Date(),
): Promise<ActiveVehicleBillingCounts> {
  const rows = await ParkingSession.find({ status: 'active' }).select('cardType entryTime').lean()
  const counts: ActiveVehicleBillingCounts = { carNormal: 0, carOvernight: 0, motorcycleNormal: 0, motorcycleOvernight: 0 }
  for (const row of rows) {
    const isOvernight = calcFeeBreakdown(row.cardType, row.entryTime, at, overnight)
      .segments.some(segment => segment.kind === 'overnight')
    if (row.cardType === 'motorcycle') {
      if (isOvernight) counts.motorcycleOvernight++
      else counts.motorcycleNormal++
    } else if (isOvernight) {
      counts.carOvernight++
    } else {
      counts.carNormal++
    }
  }
  return counts
}
