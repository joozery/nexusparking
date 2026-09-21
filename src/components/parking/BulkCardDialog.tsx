'use client'
import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { hidKey } from '@/lib/hidScan'
import { normalizeUid } from '@/lib/thaiInput'

export function BulkCardDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<'car' | 'motorcycle' | ''>('')
  const [uids, setUids] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const buffer = useRef('')
  const pending = useRef<string[]>([])
  const saving = useRef(false)
  const lastScanInput = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  function collect() {
    if (timer.current) clearTimeout(timer.current)
    const uid = normalizeUid(buffer.current)
    if (!uid || saving.current) return
    buffer.current = ''; setInput('')
    if (!/^[a-zA-Z0-9]{1,64}$/.test(uid)) { setMessage('รหัสบัตรไม่ถูกต้อง กรุณาสแกนใหม่'); return }
    if (pending.current.includes(uid)) { setMessage(`บัตร ${uid} อยู่ในรายการแล้ว`); return }
    if (pending.current.length >= 200) { setMessage('ครบ 200 ใบ กรุณาบันทึกก่อนเพิ่มชุดใหม่'); return }
    pending.current = [...pending.current, uid]; setUids(pending.current)
    setMessage(`เพิ่มบัตร ${uid} ในรายการรอบันทึกแล้ว`)
  }
  function change(value: string) {
    lastScanInput.current = Date.now()
    buffer.current = normalizeUid(value); setInput(buffer.current)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(collect, 350)
  }
  async function save() {
    if (saving.current || !type) return
    collect()
    if (!pending.current.length) return
    saving.current = true; setBusy(true); setErrors({})
    try {
      const res = await fetch('/api/cards/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, uids: pending.current }) })
      const data = await res.json().catch(() => null)
      if (!res.ok || !Array.isArray(data?.results)) throw new Error(data?.error || 'ไม่ทราบผลการบันทึก กรุณารีเฟรชรายการบัตรก่อนลองซ้ำ')
      const results = data.results as { uid: string; status: string; error?: string }[]
      const saved = new Set(results.filter(r => r.status === 'saved').map(r => r.uid))
      pending.current = pending.current.filter(uid => !saved.has(uid)); setUids(pending.current)
      setErrors(Object.fromEntries(results.filter(r => r.status !== 'saved').map(r => [r.uid, r.error || 'ไม่สำเร็จ'])))
      setMessage(`บันทึกสำเร็จ ${saved.size} ใบ${pending.current.length ? ` / ต้องตรวจสอบ ${pending.current.length} ใบ` : ' สแกนเพิ่มต่อได้'} `)
      onSaved()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ') }
    finally { saving.current = false; setBusy(false); setTimeout(() => inputRef.current?.focus(), 0) }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose() }}>
    <DialogContent onEscapeKeyDown={e => { if (busy || uids.length) e.preventDefault() }} onInteractOutside={e => e.preventDefault()} showCloseButton={false}>
      <DialogHeader><DialogTitle className="p-5">เพิ่มบัตรชั่วคราวหลายใบ</DialogTitle></DialogHeader>
      <div className="p-5 space-y-4">
        <p className="text-sm text-slate-500">เลือกประเภทรถ แล้วแตะบัตรทีละใบต่อเนื่อง เมื่อสแกนครบ กดบันทึกบัตร หรือกด Enter ขณะช่องสแกนว่าง</p>
        <div className="flex gap-2">{(['car', 'motorcycle'] as const).map(value => <button type="button" key={value} disabled={busy || uids.length > 0 || !!input} onClick={() => { setType(value); setTimeout(() => inputRef.current?.focus(), 0) }} className={`flex-1 rounded-xl border p-3 ${type === value ? 'bg-yellow-400 font-bold' : 'bg-slate-50'} disabled:opacity-60`}>{value === 'car' ? 'รถยนต์' : 'รถจักรยานยนต์'}</button>)}</div>
        <input ref={inputRef} aria-label="สแกนรหัสบัตร" value={input} disabled={!type || busy} placeholder="แตะบัตรที่เครื่องอ่าน" className="w-full rounded-xl border p-3 font-mono" onChange={e => change(e.target.value)} onKeyDown={e => {
          if (e.key === 'Enter' || e.code === 'NumpadEnter') {
            e.preventDefault()
            if (e.repeat) return
            if (buffer.current.trim()) collect()
            // Ignore delayed/duplicate scanner terminators after idle collection.
            else if (pending.current.length && Date.now() - lastScanInput.current > 700) void save()
            return
          }
          if (e.key === 'Tab' && buffer.current.trim()) { e.preventDefault(); collect(); return }
          const key = hidKey(e)
          if (key) { e.preventDefault(); const start = e.currentTarget.selectionStart ?? buffer.current.length; const end = e.currentTarget.selectionEnd ?? buffer.current.length; change(buffer.current.slice(0, start) + key + buffer.current.slice(end)) }
        }} />
        <p className="font-bold">รอบันทึก {uids.length} ใบ</p>
        <div className="max-h-60 overflow-y-auto">{uids.map((uid, index) => <div key={uid} className="flex items-center justify-between border-b py-2"><div><span className="font-mono">{index + 1}. {uid}</span>{errors[uid] && <p className="text-xs text-red-600">{errors[uid]}</p>}</div><button disabled={busy} onClick={() => { pending.current = pending.current.filter(v => v !== uid); setUids(pending.current); inputRef.current?.focus() }} className="px-3 text-red-600">นำออก</button></div>)}</div>
        <p role="status" className="text-sm">{message}</p>
        <div className="flex gap-2"><button disabled={busy} onClick={onClose} className="rounded-xl border p-3">{uids.length ? 'ยกเลิกรายการที่ยังไม่บันทึก' : 'ปิด'}</button><button disabled={busy || !type || (!uids.length && !input)} onClick={save} className="flex-1 rounded-xl bg-yellow-400 p-3 font-bold disabled:opacity-40">{busy ? 'กำลังบันทึก...' : 'บันทึกบัตร'}</button></div>
      </div>
    </DialogContent>
  </Dialog>
}
