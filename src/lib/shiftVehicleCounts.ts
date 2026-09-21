export interface VehicleCounts { car: number; motorcycle: number }
export interface ShiftVehicleCounts {
  checkinsByType?: VehicleCounts
  checkoutsByType?: VehicleCounts
  carryoverByType?: VehicleCounts
  closingByType?: VehicleCounts
}

export function vehicleCountLines(label: string, counts?: VehicleCounts): string[] {
  if (label === 'ค้าง') return [`รถยนต์ค้าง ${counts?.car ?? '—'} คัน`, `มอเตอร์ไซค์ค้าง ${counts?.motorcycle ?? '—'} คัน`]
  return [`${label} รถยนต์ ${counts?.car ?? '—'} คัน`, `${label} มอเตอร์ไซค์ ${counts?.motorcycle ?? '—'} คัน`]
}
