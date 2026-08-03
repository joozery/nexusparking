import { Car, BadgeDollarSign, LayoutDashboard, ShieldAlert } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const STATS = [
  { label: 'รถที่จอดอยู่',    value: '142',    sub: 'จาก 200 คัน',       icon: Car,             color: 'text-blue-600   bg-blue-50   border-blue-200'   },
  { label: 'รายได้วันนี้',    value: '฿4,850', sub: '+12% เมื่อวาน',     icon: BadgeDollarSign, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { label: 'ที่จอดว่าง',      value: '58',     sub: '29% ว่างอยู่',      icon: LayoutDashboard, color: 'text-violet-600  bg-violet-50  border-violet-200'  },
  { label: 'แจ้งเตือนวันนี้', value: '2',      sub: 'บัตรหาย 1 รายการ', icon: ShieldAlert,     color: 'text-amber-600  bg-amber-50   border-amber-200'   },
]

export function StatsRow() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {STATS.map(({ label, value, sub, icon: Icon, color }) => (
        <Card key={label} className="bg-white border-slate-200 shadow-none">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <div className={`flex size-8 items-center justify-center rounded-lg border ${color}`}>
                <Icon className="size-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 tracking-tight">{value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
