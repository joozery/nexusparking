import type { VehicleCounts } from '@/lib/shiftVehicleCounts'

export function ShiftVehicleSummary({ incoming, outgoing, remaining, opening = false }: {
  incoming?: VehicleCounts; outgoing?: VehicleCounts; remaining?: VehicleCounts; opening?: boolean
}) {
  return <table className="w-full text-sm text-center">
    <thead><tr className="border-b"><th className="py-2 text-left">ประเภท</th>{!opening && <><th>รถเข้า</th><th>รถออก</th></>}<th>ค้างในลาน</th></tr></thead>
    <tbody>{(['car', 'motorcycle'] as const).map(type => <tr key={type} className="border-b">
      <th className="py-2 text-left font-medium">{type === 'car' ? 'รถยนต์' : 'รถจักรยานยนต์'}</th>
      {!opening && <><td>{incoming?.[type] ?? '—'}</td><td>{outgoing?.[type] ?? '—'}</td></>}
      <td>{remaining?.[type] ?? '—'}</td>
    </tr>)}</tbody>
  </table>
}
