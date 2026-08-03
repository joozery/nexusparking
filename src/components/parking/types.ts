export type CardType = 'car' | 'motorcycle' | 'overnight'
export type HardwareStatus = 'online' | 'offline' | 'busy'

export interface ParkingLog {
  id: string
  event: 'checkin' | 'checkout' | 'lost'
  cardType: CardType
  plate: string
  timeIn: string
  timeOut?: string
  duration?: string
  fee?: number
}

export const cardMeta = {
  car:        { label: 'รถยนต์',      color: 'text-blue-600',   bg: 'bg-blue-50   border-blue-200'   },
  motorcycle: { label: 'มอเตอร์ไซค์', color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200' },
  overnight:  { label: 'ค้างคืน',     color: 'text-amber-600',  bg: 'bg-amber-50  border-amber-200'  },
} as const

export function calcFee(type: CardType, hours: number): number {
  if (type === 'car')        return hours <= 1 ? 30 : 30 + (hours - 1) * 20
  if (type === 'motorcycle') return hours <= 1 ? 20 : 20 + (hours - 1) * 10
  return 100
}

export const MOCK_LOGS: ParkingLog[] = [
  { id: 'P-0042', event: 'checkout', cardType: 'car',        plate: '1234', timeIn: '09:12', timeOut: '11:35', duration: '2 ชม. 23 น.', fee: 70  },
  { id: 'P-0041', event: 'checkin',  cardType: 'motorcycle', plate: '5678', timeIn: '11:20', duration: '-' },
  { id: 'P-0040', event: 'checkin',  cardType: 'car',        plate: '9901', timeIn: '11:05', duration: '-' },
  { id: 'P-0039', event: 'checkout', cardType: 'overnight',  plate: '3322', timeIn: '18:00', timeOut: '07:00', duration: '13 ชม.',        fee: 100 },
  { id: 'P-0038', event: 'lost',     cardType: 'car',        plate: '4455', timeIn: '08:30', timeOut: '10:45', duration: '2 ชม. 15 น.',  fee: 370 },
  { id: 'P-0037', event: 'checkout', cardType: 'motorcycle', plate: '7788', timeIn: '07:00', timeOut: '10:00', duration: '3 ชม.',         fee: 40  },
]
