export interface VehicleCounts { car: number; motorcycle: number }
export interface ShiftVehicleCounts {
  checkinsByType?: VehicleCounts
  checkoutsByType?: VehicleCounts
  carryoverByType?: VehicleCounts
  closingByType?: VehicleCounts
}

export function vehicleCountLines(label: string, counts?: VehicleCounts): string[] {
  return [`${label} รถยนต์ ${counts?.car ?? '—'} คัน`, `${label} มอเตอร์ไซค์ ${counts?.motorcycle ?? '—'} คัน`]
}
