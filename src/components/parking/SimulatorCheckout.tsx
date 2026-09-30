'use client'

import { useEffect, useState } from 'react'
import { CheckOutDialog, type PaymentMethod } from './CheckOutDialog'
import { calcFeeBreakdown, type CardType, type OvernightConfig } from '@/lib/calcFee'
import { nowLocal } from '@/lib/simulatorImport'
import { useToast } from '@/components/ui/Toast'

interface ActiveVisit { _id: string; cardUid: string; cardType: CardType; plate: string; entryTime: string; lostCard?: boolean; queueId?: string }
interface WaitingVisit extends ActiveVisit { joinedAt: string }
export function SimulatorCheckout({ config, lostCardFine }: { config: OvernightConfig | null; lostCardFine: number }) {
  const { success, error: toastError } = useToast()
  const [visits, setVisits] = useState<ActiveVisit[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [visit, setVisit] = useState<ActiveVisit | null>(null)
  const [exitTime, setExitTime] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [queues, setQueues] = useState<WaitingVisit[]>([])
  const [queueSelection, setQueueSelection] = useState('')
  const [slots, setSlots] = useState({ car: 0, motorcycle: 0 })
  async function refresh() {
    try {
      const responses = await Promise.all(['/api/sessions?status=active&allActive=1', '/api/queue', '/api/stats'].map(url => fetch(url, { cache: 'no-store' })))
      if (responses.some(res => !res.ok)) throw new Error('โหลดรถในลานไม่สำเร็จ')
      const [data, waiting, stats] = await Promise.all(responses.map(res => res.json()))
      const queueVisits = waiting.map((q: WaitingVisit) => ({ ...q, entryTime: q.joinedAt, queueId: q._id }))
      setVisits([...data.sessions, ...queueVisits]); setQueues(queueVisits)
      setSlots({ car: stats.car.available, motorcycle: stats.motorcycle.available }); setMessage('')
    } catch { setMessage('โหลดรถในลานไม่สำเร็จ กรุณากดรีเฟรช') }
  }
  useEffect(() => {
    const update = () => { void refresh() }
    const timer = setTimeout(update, 0), poll = setInterval(update, 10000)
    window.addEventListener('parking-imported', update)
    return () => { clearTimeout(timer); clearInterval(poll); window.removeEventListener('parking-imported', update) }
  }, [])
  const selectedQueue = queues.find(q => q._id === queueSelection)
  const queueHasSpace = selectedQueue && slots[selectedQueue.cardType === 'motorcycle' ? 'motorcycle' : 'car'] > 0
  async function enterQueue() {
    if (!selectedQueue || !queueHasSpace || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/queue/${selectedQueue._id}/enter`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'เข้าช่องจอดไม่สำเร็จ')
      success('เข้าช่องจอดแล้ว', selectedQueue.plate); setQueueSelection('')
    } catch (error) { toastError('เข้าช่องจอดไม่สำเร็จ', error instanceof Error ? error.message : 'กรุณาลองใหม่') }
    finally { await refresh(); setBusy(false) }
  }
  async function confirm(paymentMethod: PaymentMethod, discountId?: string, dailyDiscountId?: string, lostCard?: boolean, fineId?: string) {
    if (!visit || busy) return
    const exit = new Date(exitTime)
    if (!Number.isFinite(exit.getTime()) || exit <= new Date(visit.entryTime)) { toastError('เวลาออกต้องมากกว่าเวลาเข้า'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/sessions/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: visit.queueId ? undefined : visit._id, queueId: visit.queueId, exitTime: exit.toISOString(), paymentMethod, discountId, dailyDiscountId, fineId, lostCard: visit.lostCard || lostCard }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'บันทึกขาออกไม่สำเร็จ')
      success('บันทึกขาออกแล้ว', `ทะเบียน ${visit.plate} ยอด ${data.totalFee} บาท`)
      setVisit(null); setSelectedId(''); await refresh()
    } catch (error) { toastError('บันทึกขาออกไม่สำเร็จ', error instanceof Error ? error.message : 'กรุณาลองใหม่') }
    finally { setBusy(false) }
  }
  const entry = visit ? new Date(visit.entryTime) : null
  const exit = exitTime ? new Date(exitTime) : null
  const fee = visit && entry && exit && exit > entry ? calcFeeBreakdown(visit.cardType, entry, exit, config ?? undefined).total : 0
  return <section className="p-5 bg-white rounded-xl border border-slate-200 space-y-3">
    <h2 className="font-bold">ทดสอบคิวรอและรับรถออก</h2>
    <p className="text-sm">ช่องว่างรถยนต์ {slots.car} · จักรยานยนต์ {slots.motorcycle} · รอคิว {queues.length} คัน</p>
    <div className="max-h-64 overflow-auto space-y-2">
      {queues.map(q => <label key={q._id} className="flex items-center gap-2 border rounded p-2 text-sm">
        <input type="checkbox" aria-label={`เลือกคิว ${q.plate}`} disabled={busy} checked={queueSelection === q._id} onChange={e => setQueueSelection(e.target.checked ? q._id : '')} />
        {q.plate} · บัตร {q.cardUid} · {q.cardType === 'motorcycle' ? 'จักรยานยนต์' : 'รถยนต์'} · รอตั้งแต่ {new Date(q.joinedAt).toLocaleString('th-TH')}{q.lostCard ? ' · บัตรหาย' : ''}
      </label>)}
    </div>
    <button className="bg-emerald-700 text-white rounded-lg px-3 py-2 disabled:opacity-40" disabled={!queueHasSpace || busy} onClick={enterQueue}>เข้าช่องจอด</button>
    {selectedQueue && !queueHasSpace && <p className="text-amber-700 text-sm">ลานประเภทนี้เต็ม กรุณารับรถออกก่อน</p>}
    <p className="text-xs text-slate-600">ใช้ขั้นตอนรับรถออกจริง อัปเดตรายการเดิมและกะที่เปิดอยู่ รวมถึงสั่งอุปกรณ์ตามการตั้งค่าระบบ</p>
    <div className="flex flex-wrap gap-3">
      <select aria-label="รถที่ยังไม่มีเวลาออก" className="border rounded-lg p-2 max-w-full" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
        <option value="">เลือกรายการที่ยังไม่ออก ({visits.length})</option>
        {visits.map(v => <option key={v._id} value={v._id}>{v.plate} · {v.queueId ? 'รอคิว' : 'อยู่ในลาน'} · บัตร {v.cardUid} · เข้า {new Date(v.entryTime).toLocaleString('th-TH')}{v.lostCard ? ' · บัตรหาย' : ''}</option>)}
      </select>
      <button className="border rounded-lg px-3" onClick={refresh}>รีเฟรชรายการ</button>
      <button className="bg-violet-700 text-white rounded-lg px-3 disabled:opacity-40" disabled={!selectedId || busy} onClick={() => {
        const selected = visits.find(v => v._id === selectedId)
        if (selected) { setVisit(selected); setExitTime(nowLocal()) }
      }}>กำหนดเวลาออก / รับชำระ</button>
    </div>
    {message && <p role="alert" className="text-red-600 text-sm">{message}</p>}
    {visit && <CheckOutDialog open onOpenChange={open => { if (!open && !busy) setVisit(null) }} step="payment"
      plate={visit.plate} cardType={visit.cardType} hours={0} fee={fee} entryTime={entry}
      customExitTime={exitTime} onCustomExitTimeChange={v => setExitTime(v || nowLocal())} overnightCfg={config ?? undefined}
      lostCardFine={lostCardFine} checkoutSource={visit.lostCard ? 'plate' : 'card'} lockedLostCard={visit.lostCard}
      submitting={busy} onBack={() => setVisit(null)} onConfirm={confirm} />}
  </section>
}
