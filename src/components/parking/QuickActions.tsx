import { LogIn, LogOut, AlertTriangle, Car, Bike, Moon, ChevronRight } from 'lucide-react'

interface Props {
  onCheckIn: () => void
  onCheckOut: () => void
  onLostCard: () => void
}

export function QuickActions({ onCheckIn, onCheckOut, onLostCard }: Props) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold text-slate-700 px-1">การดำเนินการ</h2>

      <button
        onClick={onCheckIn}
        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all group shadow-sm active:scale-[0.98]"
      >
        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/50 transition-shadow">
          <LogIn className="size-7" />
        </div>
        <div className="text-left flex-1">
          <p className="text-base font-bold text-slate-800">รถเข้า (Check In)</p>
          <p className="text-xs text-slate-500 mt-0.5">สแกนบัตร → กรอกทะเบียน → เปิดไม้กั้น</p>
        </div>
        <ChevronRight className="size-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
      </button>

      <button
        onClick={onCheckOut}
        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white border-2 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 transition-all group shadow-sm active:scale-[0.98]"
      >
        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 group-hover:shadow-emerald-500/50 transition-shadow">
          <LogOut className="size-7" />
        </div>
        <div className="text-left flex-1">
          <p className="text-base font-bold text-slate-800">รถออก (Check Out)</p>
          <p className="text-xs text-slate-500 mt-0.5">สแกนบัตร → คำนวณค่าบริการ → รับเงิน</p>
        </div>
        <ChevronRight className="size-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
      </button>

      <button
        onClick={onLostCard}
        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white border-2 border-slate-200 hover:border-amber-400 hover:bg-amber-50/40 transition-all group shadow-sm active:scale-[0.98]"
      >
        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/30 group-hover:shadow-amber-500/50 transition-shadow">
          <AlertTriangle className="size-7" />
        </div>
        <div className="text-left flex-1">
          <p className="text-base font-bold text-slate-800">ทำบัตรหาย</p>
          <p className="text-xs text-slate-500 mt-0.5">ค่าปรับ 300 ฿ + ค่าจอดตามเวลาจริง</p>
        </div>
        <ChevronRight className="size-4 text-slate-300 group-hover:text-amber-500 transition-colors" />
      </button>

      {/* Rate reference */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">อัตราค่าบริการ</p>
        <div className="space-y-2.5">
          {[
            { icon: Car,  label: 'รถยนต์',      rate: '30 ฿ ชม.แรก • 20 ฿ / ชม.ต่อไป', color: 'text-blue-600'   },
            { icon: Bike, label: 'มอเตอร์ไซค์', rate: '20 ฿ ชม.แรก • 10 ฿ / ชม.ต่อไป', color: 'text-violet-600' },
            { icon: Moon, label: 'ค้างคืน',      rate: '100 ฿ เหมา (18:00 – 07:00)',    color: 'text-amber-600'  },
          ].map(({ icon: Icon, label, rate, color }) => (
            <div key={label} className="flex items-start gap-2.5">
              <Icon className={`size-4 shrink-0 mt-0.5 ${color}`} />
              <div>
                <p className="text-xs font-semibold text-slate-700">{label}</p>
                <p className="text-[11px] text-slate-400">{rate}</p>
              </div>
            </div>
          ))}
          <p className="text-[10px] text-slate-400 border-t border-slate-100 pt-2">เศษนาทีปัดขึ้น 1 ชั่วโมงทันที</p>
        </div>
      </div>
    </div>
  )
}
