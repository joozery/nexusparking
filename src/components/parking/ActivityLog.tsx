import { LogIn, LogOut, AlertTriangle, Timer, CircleDot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CardBadge } from './CardBadge'
import { MOCK_LOGS } from './types'

export function ActivityLog() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-bold text-slate-800">ประวัติล่าสุด</h2>
          <p className="text-xs text-slate-400 mt-0.5">รายการเข้า-ออกวันนี้</p>
        </div>
        <Button variant="ghost" size="sm" className="text-xs text-slate-500">ดูทั้งหมด</Button>
      </div>

      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
              <TableHead className="px-5 text-xs font-semibold text-slate-500">เหตุการณ์</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500">ประเภท</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500">ทะเบียน</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500">เวลาเข้า</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500">ระยะเวลา</TableHead>
              <TableHead className="text-right text-xs font-semibold text-slate-500 px-5">ค่าบริการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MOCK_LOGS.map((log) => (
              <TableRow key={log.id} className="hover:bg-slate-50 border-slate-100">
                <TableCell className="px-5">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                    log.event === 'checkin'  ? 'bg-blue-50    text-blue-700   border-blue-200'   :
                    log.event === 'checkout' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                               'bg-amber-50   text-amber-700  border-amber-200'
                  }`}>
                    {log.event === 'checkin'  && <LogIn         className="size-3" />}
                    {log.event === 'checkout' && <LogOut        className="size-3" />}
                    {log.event === 'lost'     && <AlertTriangle className="size-3" />}
                    {log.event === 'checkin' ? 'เข้า' : log.event === 'checkout' ? 'ออก' : 'บัตรหาย'}
                  </span>
                </TableCell>
                <TableCell><CardBadge type={log.cardType} /></TableCell>
                <TableCell>
                  <span className="font-mono text-sm font-bold text-slate-800">••{log.plate}</span>
                </TableCell>
                <TableCell className="text-sm text-slate-600 tabular-nums">{log.timeIn}</TableCell>
                <TableCell>
                  {log.event !== 'checkin' ? (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Timer className="size-3" />{log.duration}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-blue-500 animate-pulse">
                      <CircleDot className="size-3" />จอดอยู่
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right px-5">
                  {log.fee !== undefined
                    ? <span className={`text-sm font-bold ${log.event === 'lost' ? 'text-amber-600' : 'text-slate-800'}`}>฿{log.fee}</span>
                    : <span className="text-slate-300">–</span>
                  }
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
