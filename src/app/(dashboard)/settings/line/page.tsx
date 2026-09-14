'use client'

import { useEffect, useState } from 'react'
import { Save, RefreshCw, MessageCircle, Plus, X, Send, Radar, Trash2, Copy, Check } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface LineSettings {
  line: { enabled: boolean; channelToken: string; targets: string[] }
}

export default function LineSettingsPage() {
  const { success, error: toastError } = useToast()
  const [settings,    setSettings]    = useState<LineSettings | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [newTarget,   setNewTarget]   = useState('')
  const [sendingTest,   setSendingTest]   = useState(false)
  const [discovered,    setDiscovered]    = useState<string[]>([])
  const [lastWebhook,   setLastWebhook]   = useState<string | null>(null)
  const [eventCount,    setEventCount]    = useState(0)
  const [scanning,      setScanning]      = useState(false)
  const [copiedId,      setCopiedId]      = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        data.line ??= { enabled: false, channelToken: '', targets: [] }
        setSettings(data)
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line: settings.line }),
      })
      if (res.ok) {
        const updated = await res.json()
        updated.line ??= { enabled: false, channelToken: '', targets: [] }
        setSettings(updated)
        success('บันทึกการตั้งค่าสำเร็จ')
      } else {
        toastError('บันทึกไม่สำเร็จ', 'กรุณาลองใหม่อีกครั้ง')
      }
    } finally { setSaving(false) }
  }

  async function fetchDiscovered() {
    setScanning(true)
    try {
      const res = await fetch('/api/line/webhook')
      const data = await res.json()
      setDiscovered(data.ids ?? [])
      setLastWebhook(data.lastWebhook ?? null)
      setEventCount(data.eventCount ?? 0)
    } finally { setScanning(false) }
  }

  async function clearDiscovered() {
    await fetch('/api/line/webhook', { method: 'DELETE' })
    setDiscovered([])
  }

  function copyId(id: string) {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function addDiscoveredTarget(id: string) {
    if (!settings || settings.line.targets.includes(id)) return
    updateLine('targets', [...settings.line.targets, id])
  }

  async function sendTestLine() {
    if (!settings?.line.channelToken || !settings.line.targets.length) return
    setSendingTest(true)
    try {
      const res = await fetch('/api/line/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelToken: settings.line.channelToken, targets: settings.line.targets }),
      })
      res.ok ? success('ส่งข้อความทดสอบสำเร็จ') : toastError('ส่งไม่สำเร็จ', 'ตรวจสอบ Token และ Target ID')
    } catch { toastError('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อได้') }
    finally { setSendingTest(false) }
  }

  function updateLine(field: keyof LineSettings['line'], value: string | boolean | string[]) {
    setSettings(s => s ? ({ ...s, line: { ...s.line, [field]: value } }) : s)
  }

  function addTarget() {
    const t = newTarget.trim()
    if (!t || !settings) return
    if (settings.line.targets.includes(t)) return
    updateLine('targets', [...settings.line.targets, t])
    setNewTarget('')
  }

  function removeTarget(id: string) {
    if (!settings) return
    updateLine('targets', settings.line.targets.filter(t => t !== id))
  }

  if (loading) return <div className="flex items-center justify-center p-10"><RefreshCw className="size-5 text-slate-300 animate-spin" /></div>
  if (!settings) return null

  const line = settings.line

  return (
    <div className="p-5 space-y-4">

      {/* Save button */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="h-8 px-4 rounded-lg text-black text-xs font-bold flex items-center gap-1.5 hover:opacity-90 disabled:opacity-60"
          style={{ background: '#EAB308', boxShadow: '0 1px 8px rgba(161,98,7,0.35)' }}>
          {saving ? <RefreshCw className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
        </button>
      </div>

      {/* Enable + Token */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E8ECF4', background: '#FAFBFF' }}>
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,185,0,0.08)' }}>
              <MessageCircle className="size-4" style={{ color: '#00B900' }} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">LINE Messaging API</p>
              <p className="text-[10px] text-slate-400">แจ้งเตือนเข้ากะ / ออกกะ / สรุปยอดผ่าน LINE Bot</p>
            </div>
          </div>
          <button onClick={() => updateLine('enabled', !line.enabled)}
            className="w-9 h-5 rounded-full relative transition-colors"
            style={{ background: line.enabled ? '#00B900' : '#E2E8F0' }}>
            <span className="absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform"
              style={{ transform: line.enabled ? 'translateX(20px)' : 'translateX(2px)' }} />
          </button>
        </div>
        <div className="p-5">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1.5">
            Channel Access Token
          </label>
          <input type="password" value={line.channelToken}
            onChange={e => updateLine('channelToken', e.target.value)}
            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxx..."
            className="w-full h-10 px-3 rounded-lg text-sm font-mono text-slate-800 outline-none"
            style={{ border: '1.5px solid #E8ECF4', background: '#FAFBFF' }}
            onFocus={e => e.currentTarget.style.borderColor = '#00B900'}
            onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'} />
          <p className="mt-1.5 text-[10px] text-slate-400">
            ได้จาก LINE Developers Console → Messaging API Channel → Channel Access Token
          </p>
        </div>
      </div>

      {/* Target IDs */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #E8ECF4', background: '#FAFBFF' }}>
          <p className="text-sm font-black text-slate-900">ปลายทางการแจ้งเตือน</p>
          <p className="text-[10px] text-slate-400">User ID (Uxxxxx) หรือ Group ID (Cxxxxx)</p>
        </div>
        <div className="p-5 space-y-3">
          {line.targets.length > 0 ? (
            <div className="space-y-2">
              {line.targets.map(id => (
                <div key={id} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: '#F0FFF4', border: '1px solid rgba(0,185,0,0.2)' }}>
                  <span className="flex-1 text-xs font-mono text-slate-700 truncate">{id}</span>
                  <button onClick={() => removeTarget(id)}
                    className="shrink-0 size-5 rounded flex items-center justify-center hover:bg-red-50"
                    style={{ color: '#DC2626' }}>
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 text-center py-2">ยังไม่มีปลายทาง</p>
          )}

          <div className="flex gap-2">
            <input value={newTarget} onChange={e => setNewTarget(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTarget()}
              placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="flex-1 h-9 px-3 rounded-lg text-xs font-mono text-slate-800 outline-none"
              style={{ border: '1.5px solid #E8ECF4', background: '#FAFBFF' }}
              onFocus={e => e.currentTarget.style.borderColor = '#00B900'}
              onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'} />
            <button onClick={addTarget}
              className="h-9 px-3 rounded-lg text-xs font-bold flex items-center gap-1 text-white"
              style={{ background: '#00B900' }}>
              <Plus className="size-3.5" />
              เพิ่ม
            </button>
          </div>
          <p className="text-[10px] text-slate-400">
            วิธีดู User ID: เพิ่ม Bot เป็นเพื่อน → webhook จะได้ userId · Group ID: เพิ่ม Bot ในกลุ่ม → webhook จะได้ groupId
          </p>
        </div>
      </div>

      {/* Test button */}
      <button onClick={sendTestLine}
        disabled={sendingTest || !line.channelToken || !line.targets.length}
        className="w-full h-10 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
        style={{ background: 'rgba(0,185,0,0.08)', color: '#00B900', border: '1.5px solid rgba(0,185,0,0.25)' }}>
        {sendingTest ? <RefreshCw className="size-4 animate-spin" /> : <Send className="size-4" />}
        {sendingTest ? 'กำลังส่ง...' : 'ส่งข้อความทดสอบ'}
      </button>

      {/* Discover IDs */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E8ECF4', background: '#FAFBFF' }}>
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(234,179,8,0.1)' }}>
              <Radar className="size-4" style={{ color: '#CA8A04' }} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">ตรวจจับ Group ID / User ID</p>
              <p className="text-[10px] text-slate-400">พิมพ์อะไรก็ได้ในกลุ่ม/แชทที่ต้องการ แล้วกดสแกน</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {discovered.length > 0 && (
              <button onClick={clearDiscovered}
                className="h-7 px-2.5 rounded-lg text-[10px] font-bold flex items-center gap-1"
                style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}>
                <Trash2 className="size-3" /> ล้าง
              </button>
            )}
            <button onClick={fetchDiscovered} disabled={scanning}
              className="h-7 px-3 rounded-lg text-[10px] font-bold flex items-center gap-1.5 text-black disabled:opacity-60"
              style={{ background: '#CA8A04' }}>
              {scanning ? <RefreshCw className="size-3 animate-spin" /> : <Radar className="size-3" />}
              {scanning ? 'กำลังสแกน...' : 'สแกน'}
            </button>
          </div>
        </div>
        <div className="p-5">
          {/* Debug info */}
          {lastWebhook && (
            <div className="mb-3 px-3 py-2 rounded-lg text-[10px]"
              style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.15)', color: '#059669' }}>
              ✅ LINE ส่ง webhook มาแล้ว — {new Date(lastWebhook).toLocaleString('th-TH')} ({eventCount} events)
            </div>
          )}

          {discovered.length === 0 ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-[11px] text-slate-400">{lastWebhook ? 'LINE ส่ง event มาแล้ว แต่ยังไม่พบ Group/User ID — ลองพิมพ์ในกลุ่มอีกครั้ง' : 'ยังไม่พบ ID'}</p>
              <div className="text-[10px] text-slate-400 space-y-0.5">
                <p>1. ตั้งค่า Webhook URL ใน LINE Developers Console เป็น</p>
                <code className="px-2 py-0.5 rounded text-[10px] font-mono"
                  style={{ background: '#F0F2F8', color: '#A16207' }}>
                  https://your-domain.com/api/line/webhook
                </code>
                <p>2. พิมพ์ข้อความอะไรก็ได้ในกลุ่มหรือแชทที่ต้องการ</p>
                <p>3. กดปุ่ม <span className="font-bold text-yellow-700">สแกน</span> เพื่อดึง ID</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {discovered.map(id => {
                const isGroup = id.startsWith('C')
                const isUser  = id.startsWith('U')
                const already = settings?.line.targets.includes(id)
                return (
                  <div key={id} className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
                    style={{ background: '#FAFBFF', border: '1px solid #E8ECF4' }}>
                    <span className="shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded"
                      style={{
                        background: isGroup ? 'rgba(161,98,7,0.08)' : isUser ? 'rgba(5,150,105,0.08)' : 'rgba(99,102,241,0.08)',
                        color: isGroup ? '#A16207' : isUser ? '#059669' : '#6366F1',
                      }}>
                      {isGroup ? 'GROUP' : isUser ? 'USER' : 'ID'}
                    </span>
                    <span className="flex-1 text-xs font-mono text-slate-700 truncate">{id}</span>
                    <button onClick={() => copyId(id)}
                      className="shrink-0 h-6 px-2 rounded text-[10px] font-bold flex items-center gap-1"
                      style={{ background: 'rgba(99,102,241,0.08)', color: '#6366F1' }}>
                      {copiedId === id ? <Check className="size-3" /> : <Copy className="size-3" />}
                      {copiedId === id ? 'คัดลอกแล้ว' : 'คัดลอก'}
                    </button>
                    <button onClick={() => addDiscoveredTarget(id)} disabled={already}
                      className="shrink-0 h-6 px-2 rounded text-[10px] font-bold flex items-center gap-1 disabled:opacity-40"
                      style={{ background: already ? '#F1F5F9' : 'rgba(0,185,0,0.1)', color: already ? '#94A3B8' : '#00B900' }}>
                      <Plus className="size-3" />
                      {already ? 'เพิ่มแล้ว' : 'เพิ่ม'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="rounded-xl p-4 text-[11px] text-slate-600 space-y-1.5"
        style={{ background: '#F8FAFF', border: '1px solid rgba(161,98,7,0.1)' }}>
        <p className="font-black text-slate-800 mb-2">สิ่งที่ระบบจะแจ้งเตือน</p>
        <p>🟢 <span className="font-bold">เปิดกะ</span> — ชื่อพนักงาน, เวลาเข้ากะ, รถค้างในลาน</p>
        <p>🔴 <span className="font-bold">ปิดกะ</span> — สรุปยอด Check-in/out, รายรับเงินสด, QR, รวม, รถค้าง</p>
      </div>
    </div>
  )
}
