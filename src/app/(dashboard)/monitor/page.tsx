'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Camera, Settings, X, Clock, Maximize2, Minimize2, Save, Eye, EyeOff, Wifi, WifiOff,
} from 'lucide-react'

const STORAGE_KEY = 'np_cctv_urls'

interface CameraSlot {
  id:       'plate' | 'face' | 'rear' | 'exit'
  label:    string
  subLabel: string
  camNum:   string
  accent:   string
}

const CAMERAS: CameraSlot[] = [
  { id: 'plate', label: 'กล้องป้ายทะเบียน', subLabel: 'License Plate', camNum: 'CAM-01', accent: '#1D4ED8' },
  { id: 'face',  label: 'กล้องหน้าคนขับ',  subLabel: 'Driver Face',   camNum: 'CAM-02', accent: '#059669' },
  { id: 'rear',  label: 'กล้อง Rear',       subLabel: 'Rear View',     camNum: 'CAM-03', accent: '#7C3AED' },
  { id: 'exit',  label: 'กล้องขาออก',       subLabel: 'Exit View',     camNum: 'CAM-04', accent: '#EA580C' },
]

type Status    = 'idle' | 'loading' | 'online' | 'offline'
type CameraUrls = Record<'plate' | 'face' | 'rear' | 'exit', string>

function LiveClock() {
  const [ts, setTs] = useState('')
  useEffect(() => {
    const tick = () => setTs(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t)
  }, [])
  return <>{ts}</>
}

function FrameTs() {
  const [ts, setTs] = useState('')
  useEffect(() => {
    const tick = () => {
      const d = new Date()
      setTs(`${d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}  ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`)
    }
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t)
  }, [])
  return <>{ts}</>
}

/* ── single camera card ── */
function CameraCard({ slot, url, onExpand }: { slot: CameraSlot; url: string; onExpand: () => void }) {
  const [status, setStatus] = useState<Status>('idle')
  const [ticker, setTicker] = useState(Date.now())
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const safeUrl  = url ?? ''
  const isRtsp   = safeUrl.startsWith('rtsp://')
  const isMjpeg  = safeUrl.includes('stream.mjpeg') || safeUrl.includes('.mjpg') || safeUrl.includes('mjpeg')

  useEffect(() => {
    if (timer.current) clearInterval(timer.current)
    if (!safeUrl || isRtsp || isMjpeg) { setStatus(safeUrl && !isRtsp ? 'loading' : 'idle'); return }
    setStatus('loading')
    timer.current = setInterval(() => setTicker(Date.now()), 500)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [safeUrl, isRtsp, isMjpeg])

  const src = isRtsp ? '' : isMjpeg ? safeUrl : safeUrl ? `${safeUrl}${safeUrl.includes('?') ? '&' : '?'}_t=${ticker}` : ''

  const statusColor =
    status === 'online'  ? '#059669' :
    status === 'offline' ? '#DC2626' : '#94A3B8'
  const statusLabel =
    status === 'online'  ? 'ONLINE' :
    status === 'offline' ? 'OFFLINE' :
    status === 'loading' ? 'กำลังเชื่อมต่อ…' : 'STANDBY'

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden bg-white"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06)', border: '1px solid #E8ECF4' }}>

      {/* ── video area ── */}
      <div className="relative flex-1 bg-[#0D1117] flex items-center justify-center overflow-hidden">
        {isRtsp ? (
          <div className="flex flex-col items-center gap-3 px-6 text-center select-none">
            <div className="flex size-12 items-center justify-center rounded-xl"
              style={{ background: 'rgba(251,191,36,0.12)', border: '1px dashed rgba(251,191,36,0.3)' }}>
              <WifiOff className="size-5" style={{ color: 'rgba(251,191,36,0.7)' }} />
            </div>
            <p className="text-[11px] font-bold" style={{ color: 'rgba(251,191,36,0.8)' }}>ไม่รองรับ RTSP โดยตรง</p>
            <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
              ต้องผ่าน go2rtc ก่อน<br />ใส่ URL นี้แทน:<br />
              <span style={{ color: 'rgba(96,165,250,0.9)' }} className="font-mono">
                http://localhost:1984/api/stream.mjpeg?src=cam_plate
              </span>
            </p>
          </div>
        ) : safeUrl ? (
          <img src={src} alt={slot.label}
            className="absolute inset-0 w-full h-full object-cover"
            onLoad={() => setStatus('online')}
            onError={() => setStatus('offline')} />
        ) : (
          <div className="flex flex-col items-center gap-2 select-none">
            <div className="flex size-12 items-center justify-center rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.1)' }}>
              <Camera className="size-5" style={{ color: 'rgba(255,255,255,0.15)' }} />
            </div>
            <p className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.2)' }}>ยังไม่ได้ตั้งค่า URL</p>
          </div>
        )}

        {/* LIVE pill — top-left */}
        {status === 'online' && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full pointer-events-none"
            style={{ background: 'rgba(220,38,38,0.85)' }}>
            <span className="size-1.5 rounded-full bg-red-200 animate-pulse" />
            <span className="text-white text-[9px] font-bold tracking-widest">LIVE</span>
          </div>
        )}

        {/* Timestamp — bottom-left */}
        <div className="absolute bottom-2 left-2.5 pointer-events-none">
          <span className="text-[9px] tabular-nums font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <FrameTs />
          </span>
        </div>

        {/* Expand — top-right */}
        <button onClick={onExpand}
          className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-lg transition-all"
          style={{ background: 'rgba(0,0,0,0.35)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.6)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.35)'}>
          <Maximize2 className="size-3.5 text-white/70" />
        </button>
      </div>

      {/* ── info strip ── */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2.5 bg-white"
        style={{ borderTop: '1px solid #F1F5F9' }}>
        <div className="flex items-center gap-2">
          {/* cam number badge */}
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md tabular-nums"
            style={{ background: slot.accent + '12', color: slot.accent, border: `1px solid ${slot.accent}25` }}>
            {slot.camNum}
          </span>
          <div>
            <p className="text-[11px] font-bold text-slate-700 leading-none">{slot.label}</p>
            <p className="text-[9px] text-slate-400 mt-0.5">{slot.subLabel}</p>
          </div>
        </div>

        {/* status pill */}
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full shrink-0"
            style={{ background: statusColor, boxShadow: status === 'online' ? `0 0 5px ${statusColor}` : 'none' }} />
          <span className="text-[10px] font-semibold" style={{ color: statusColor }}>{statusLabel}</span>
        </div>
      </div>
    </div>
  )
}

/* ── fullscreen overlay ── */
function FullscreenView({ slot, url, onClose }: { slot: CameraSlot; url: string; onClose: () => void }) {
  const [ticker, setTicker] = useState(Date.now())
  const [status, setStatus] = useState<Status>(url ? 'loading' : 'idle')

  useEffect(() => {
    if (!url) return
    const t = setInterval(() => setTicker(Date.now()), 2000)
    return () => clearInterval(t)
  }, [url])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  const isMjpegFull = url.includes('stream.mjpeg') || url.includes('.mjpg') || url.includes('mjpeg')
  const src = isMjpegFull ? url : url ? `${url}${url.includes('?') ? '&' : '?'}_t=${ticker}` : ''

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* toolbar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5"
        style={{ background: 'rgba(0,0,0,0.85)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2.5">
          <span className="size-2 rounded-full" style={{ background: slot.accent }} />
          <span className="text-white text-sm font-bold">{slot.label}</span>
          <span className="text-white/40 text-xs">{slot.subLabel} · {slot.camNum}</span>
        </div>
        <button onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white/50 hover:text-white hover:bg-white/10 transition-all">
          <Minimize2 className="size-3.5" />
          ปิดเต็มจอ <span className="text-white/30">(Esc)</span>
        </button>
      </div>
      {/* feed */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {url
          ? <img src={src} alt={slot.label} className="max-w-full max-h-full object-contain"
              onLoad={() => setStatus('online')} onError={() => setStatus('offline')} />
          : <div className="flex flex-col items-center gap-3">
              <Camera className="size-16 text-slate-700" />
              <p className="text-slate-500 text-sm">ยังไม่ได้ตั้งค่า URL กล้อง</p>
            </div>
        }
        {/* bottom overlay */}
        <div className="absolute bottom-4 right-4 flex items-center gap-3">
          {status === 'online' && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: 'rgba(220,38,38,0.8)' }}>
              <span className="size-1.5 rounded-full bg-red-200 animate-pulse" />
              <span className="text-white text-[10px] font-bold tracking-widest">LIVE</span>
            </div>
          )}
          <span className="text-white/25 text-xs tabular-nums font-mono"><FrameTs /></span>
        </div>
      </div>
    </div>
  )
}

/* ── page ── */
export default function MonitorPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [urls, setUrls]             = useState<CameraUrls>({ plate: '', face: '', rear: '', exit: '' })
  const [showSettings, setShowSettings] = useState(false)
  const [draft, setDraft]           = useState<CameraUrls>({ plate: '', face: '', rear: '', exit: '' })
  const [showUrl, setShowUrl]       = useState<Record<string, boolean>>({ plate: false, face: false, rear: false, exit: false })
  const [expanded, setExpanded]     = useState<CameraSlot | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')

  useEffect(() => {
    fetch('/api/cctv')
      .then(r => r.json())
      .then((p: CameraUrls) => { setUrls(p); setDraft(p) })
      .catch(() => {
        try {
          const raw = localStorage.getItem(STORAGE_KEY)
          if (raw) { const p = JSON.parse(raw) as CameraUrls; setUrls(p); setDraft(p) }
        } catch {}
      })
  }, [])


  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.altKey && e.code === 'KeyC') {
        e.preventDefault()
        setExpanded(prev => prev ? null : CAMERAS[0])
      }
    }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [])

  function openSettings() { setDraft({ ...urls }); setSaveStatus('idle'); setShowSettings(true) }
  async function saveSettings() {
    setSaveStatus('saving')
    try {
      const res = await fetch('/api/cctv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setUrls({ ...draft })
      setSaveStatus('ok')
      setTimeout(() => { setShowSettings(false); setSaveStatus('idle') }, 800)
    } catch (e) {
      console.error('[cctv save]', e)
      setSaveStatus('error')
      // fallback: บันทึก localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
      setUrls({ ...draft })
    }
  }

  const doExpand = useCallback((s: CameraSlot) => setExpanded(s), [])
  const doClose  = useCallback(() => setExpanded(null), [])

  const configuredCount = CAMERAS.filter(c => urls[c.id]).length

  function handleKey(e: React.KeyboardEvent) {
    if (e.altKey && e.code === 'KeyC') {
      e.preventDefault()
      setExpanded(prev => prev ? null : CAMERAS[0])
    }
  }

  return (
    <div ref={containerRef} tabIndex={0} onKeyDown={handleKey}
      className="flex flex-col h-full overflow-hidden outline-none" style={{ background: '#F0F4FF' }}>

      {/* ─── Header ─── */}
      <header className="shrink-0 flex items-center justify-between px-6 py-3.5 bg-white"
        style={{ borderBottom: '1px solid #E8ECF4', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>

        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl shrink-0"
            style={{ background: 'linear-gradient(135deg,#1E3A8A,#1D4ED8)', boxShadow: '0 2px 10px rgba(29,78,216,0.3)' }}>
            <Camera className="size-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-800">ระบบกล้องวงจรปิด</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">CCTV Monitor · {CAMERAS.length} กล้อง</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* camera status pills */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: '#F8FAFF', border: '1px solid #E8ECF4' }}>
            {CAMERAS.map(c => (
              <div key={c.id} className="flex items-center gap-1">
                <span className="size-1.5 rounded-full shrink-0"
                  style={{ background: urls[c.id] ? c.accent : '#CBD5E1' }} />
                <span className="text-[9px] font-semibold"
                  style={{ color: urls[c.id] ? c.accent : '#94A3B8' }}>{c.camNum}</span>
              </div>
            ))}
            <div className="w-px h-3 bg-slate-200 mx-0.5" />
            <span className="text-[9px] text-slate-400">{configuredCount}/{CAMERAS.length} ตั้งค่าแล้ว</span>
          </div>

          {/* clock */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
            style={{ background: '#F8FAFF', border: '1px solid #E8ECF4' }}>
            <Clock className="size-3 text-slate-400" />
            <span className="text-sm font-black text-slate-700 tabular-nums"><LiveClock /></span>
          </div>

          {/* Alt+C — fullscreen กล้องขาออก */}
          <button onClick={() => setExpanded(prev => prev ? null : CAMERAS[0])}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#1E3A8A,#1D4ED8)', boxShadow: '0 2px 8px rgba(29,78,216,0.3)' }}>
            กล้องขาออก
            <kbd className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded font-mono">Alt+C</kbd>
          </button>

          {/* settings button */}
          <button onClick={openSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 bg-white transition-all hover:bg-blue-50 hover:text-blue-700"
            style={{ border: '1px solid #E8ECF4' }}>
            <Settings className="size-3.5" />
            ตั้งค่ากล้อง
          </button>
        </div>
      </header>

      {/* ─── Camera grid 2×2 ─── */}
      <div className="flex-1 p-5 overflow-hidden">
        <div className="h-full grid gap-4"
          style={{ gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
          {CAMERAS.map(c => (
            <CameraCard key={c.id} slot={c} url={urls[c.id]} onExpand={() => doExpand(c)} />
          ))}
        </div>
      </div>

      {/* ─── Settings Modal ─── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,18,30,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden bg-white"
            style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.18)', border: '1px solid #E8ECF4' }}>

            {/* header */}
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid #F1F5F9' }}>
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 items-center justify-center rounded-lg"
                  style={{ background: 'rgba(29,78,216,0.08)' }}>
                  <Settings className="size-3.5 text-blue-600" />
                </div>
                <h2 className="text-sm font-bold text-slate-800">ตั้งค่า URL กล้อง</h2>
              </div>
              <button onClick={() => setShowSettings(false)}
                className="flex size-7 items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
                <X className="size-3.5 text-slate-400" />
              </button>
            </div>

            {/* body */}
            <div className="px-5 py-4 space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                ใส่ URL ของกล้อง เช่น{' '}
                <code className="text-slate-600 bg-slate-100 px-1 py-0.5 rounded text-[11px]">http://192.168.1.100/snapshot.jpg</code>
                {' '}สำหรับ snapshot หรือ MJPEG stream URL
              </p>

              {CAMERAS.map(c => (
                <div key={c.id}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="size-1.5 rounded-full shrink-0" style={{ background: c.accent }} />
                    <label className="text-xs font-bold text-slate-700">{c.label}</label>
                    <span className="text-[10px] text-slate-400">{c.subLabel} · {c.camNum}</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showUrl[c.id] ? 'text' : 'password'}
                      value={draft[c.id]}
                      onChange={e => setDraft(p => ({ ...p, [c.id]: e.target.value }))}
                      placeholder="http://localhost:1984/api/stream.mjpeg?src=cam_plate"
                      className="w-full h-9 pl-3 pr-9 rounded-lg text-xs text-slate-700 placeholder-slate-300 outline-none font-mono"
                      style={{
                        background: '#FAFBFF',
                        border: `1.5px solid ${draft[c.id]?.startsWith('rtsp://') ? '#F59E0B' : draft[c.id] ? c.accent + '60' : '#E2E8F0'}`,
                        transition: 'border-color .15s',
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = draft[c.id]?.startsWith('rtsp://') ? '#F59E0B' : c.accent }}
                      onBlur={e => { e.currentTarget.style.borderColor = draft[c.id]?.startsWith('rtsp://') ? '#F59E0B' : draft[c.id] ? c.accent + '60' : '#E2E8F0' }}
                    />
                    <button type="button"
                      onClick={() => setShowUrl(p => ({ ...p, [c.id]: !p[c.id] }))}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 transition-colors">
                      {showUrl[c.id] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                  {draft[c.id]?.startsWith('rtsp://') && (
                    <p className="mt-1 text-[10px] text-amber-600 leading-relaxed">
                      ⚠️ Browser ใช้ rtsp:// ไม่ได้โดยตรง — ต้องผ่าน go2rtc ก่อน<br />
                      <span className="text-slate-500">บน Windows (Tailscale): ติดตั้ง go2rtc → ใส่ URL</span>{' '}
                      <code className="font-mono text-blue-600">http://100.x.x.x:1984/api/stream.mjpeg?src=cam_plate</code><br />
                      <span className="text-slate-500">หรือบน Mac นี้:</span>{' '}
                      <code className="font-mono">http://localhost:1984/api/stream.mjpeg?src=cam_plate</code>
                    </p>
                  )}
                </div>
              ))}

              <div className="rounded-xl px-3.5 py-3 text-[10px] text-slate-400 leading-relaxed space-y-0.5"
                style={{ background: '#F8FAFF', border: '1px solid #E8ECF4' }}>
                <p className="font-semibold text-slate-500 mb-1.5">รูปแบบ URL ที่รองรับ</p>
                <p><code className="font-mono text-slate-600">http://IP/snapshot.jpg</code> — polling ทุก 2 วินาที</p>
                <p><code className="font-mono text-slate-600">http://IP:PORT/stream.mjpg</code> — MJPEG stream ต่อเนื่อง</p>
                <div className="mt-2 pt-2" style={{ borderTop: '1px solid #E8ECF4' }}>
                  <p className="font-semibold text-slate-500 mb-1">ใช้ผ่าน Tailscale (Windows ที่ลานจอดรถ)</p>
                  <p>1. ติดตั้ง go2rtc บน Windows → เปิด port 1984</p>
                  <p>2. ใส่ URL:<code className="font-mono text-blue-600 ml-1">http://100.x.x.x:1984/api/stream.mjpeg?src=cam_plate</code></p>
                  <p className="mt-1 text-slate-400">แทนที่ <code className="font-mono">100.x.x.x</code> ด้วย Tailscale IP ของ Windows</p>
                </div>
                <p className="mt-1.5 text-slate-400">URL บันทึกใน MongoDB — ทุกเครื่องเห็นค่าเดียวกัน</p>
              </div>
            </div>

            {/* footer */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderTop: '1px solid #F1F5F9' }}>
              {saveStatus === 'error' && (
                <p className="text-xs text-red-500 font-medium">❌ บันทึกไม่สำเร็จ (เชื่อมต่อ DB ไม่ได้)</p>
              )}
              {saveStatus === 'ok' && (
                <p className="text-xs text-green-600 font-medium">✓ บันทึกสำเร็จ</p>
              )}
              {(saveStatus === 'idle' || saveStatus === 'saving') && <span />}
              <div className="flex gap-2">
                <button onClick={() => setShowSettings(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-all"
                  disabled={saveStatus === 'saving'}>
                  ยกเลิก
                </button>
                <button onClick={saveSettings}
                  disabled={saveStatus === 'saving'}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#1E3A8A,#1D4ED8)', boxShadow: '0 2px 8px rgba(29,78,216,0.35)' }}>
                  <Save className="size-3.5" />
                  {saveStatus === 'saving' ? 'กำลังบันทึก…' : 'บันทึก'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Fullscreen ─── */}
      {expanded && <FullscreenView slot={expanded} url={urls[expanded.id]} onClose={doClose} />}
    </div>
  )
}
