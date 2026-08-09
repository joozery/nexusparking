'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Camera, Settings, X, Clock, Maximize2, Minimize2,
  RefreshCw, Save, Eye, EyeOff,
} from 'lucide-react'

const STORAGE_KEY = 'np_cctv_urls'

interface CameraSlot {
  id: 'plate' | 'face' | 'rear'
  label:    string
  subLabel: string
  camNum:   string
  color:    string
}

const CAMERAS: CameraSlot[] = [
  { id: 'plate', label: 'กล้องป้ายทะเบียน', subLabel: 'License Plate',  camNum: 'CAM-01', color: '#3B82F6' },
  { id: 'face',  label: 'กล้องหน้าคนขับ',  subLabel: 'Driver Face',    camNum: 'CAM-02', color: '#10B981' },
  { id: 'rear',  label: 'กล้อง Rear',       subLabel: 'Rear View',      camNum: 'CAM-03', color: '#8B5CF6' },
]

type Status = 'idle' | 'loading' | 'online' | 'offline'
type CameraUrls = Record<'plate' | 'face' | 'rear', string>

function LiveTimestamp() {
  const [ts, setTs] = useState('')
  useEffect(() => {
    const update = () => setTs(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [])
  return <>{ts}</>
}

function FrameTimestamp() {
  const [ts, setTs] = useState('')
  useEffect(() => {
    const update = () => {
      const d = new Date()
      setTs(`${d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })} ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`)
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [])
  return <>{ts}</>
}

interface CameraPanelProps {
  slot:     CameraSlot
  url:      string
  size:     'large' | 'small'
  onExpand: () => void
}

function CameraPanel({ slot, url, size, onExpand }: CameraPanelProps) {
  const [status, setStatus]   = useState<Status>('idle')
  const [ticker, setTicker]   = useState(Date.now())
  const timerRef              = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!url) { setStatus('idle'); return }
    setStatus('loading')
    timerRef.current = setInterval(() => setTicker(Date.now()), 2000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [url])

  const imgSrc = url ? `${url}${url.includes('?') ? '&' : '?'}_t=${ticker}` : ''

  return (
    <div
      className="relative w-full h-full overflow-hidden rounded-xl flex items-center justify-center"
      style={{ background: '#080B12', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Camera feed */}
      {url ? (
        <img
          src={imgSrc}
          alt={slot.label}
          className="absolute inset-0 w-full h-full object-cover"
          onLoad={() => setStatus('online')}
          onError={() => setStatus('offline')}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 select-none">
          <div className="flex size-14 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <Camera className="size-6 text-slate-600" />
          </div>
          <div className="text-center">
            <p className="text-slate-500 text-xs font-semibold">{slot.label}</p>
            <p className="text-slate-700 text-[10px] mt-0.5">ยังไม่ได้ตั้งค่า URL กล้อง</p>
          </div>
        </div>
      )}

      {/* Overlay — top bar */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5 pointer-events-none"
        style={{ background: 'linear-gradient(180deg,rgba(0,0,0,0.75) 0%,transparent 100%)' }}>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full shrink-0"
              style={{
                background: status === 'online' ? '#4ADE80' : status === 'offline' ? '#F87171' : '#64748B',
                boxShadow:  status === 'online' ? '0 0 6px #4ADE80' : 'none',
                animation:  status === 'online' ? 'pulse 2s infinite' : 'none',
              }} />
            <span className="text-white text-[11px] font-bold tracking-wide">{slot.label}</span>
          </div>
          <p className="text-white/40 text-[9px] mt-0.5">{slot.subLabel}</p>
        </div>
        <button
          onClick={onExpand}
          className="pointer-events-auto flex size-6 items-center justify-center rounded-lg transition-colors hover:bg-white/15"
        >
          <Maximize2 className="size-3 text-white/60" />
        </button>
      </div>

      {/* LIVE badge */}
      {status === 'online' && (
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full pointer-events-none"
          style={{ background: 'rgba(220,38,38,0.85)', border: '1px solid rgba(255,255,255,0.15)' }}>
          <span className="size-1.5 rounded-full bg-red-200" style={{ animation: 'pulse 1s infinite' }} />
          <span className="text-white text-[9px] font-bold tracking-widest">LIVE</span>
        </div>
      )}

      {/* Cam number badge top-right area */}
      <div className="absolute top-2.5 right-9 pointer-events-none">
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
          style={{ background: 'rgba(0,0,0,0.5)', color: slot.color, border: `1px solid ${slot.color}40` }}>
          {slot.camNum}
        </span>
      </div>

      {/* Overlay — bottom bar */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-2.5 pointer-events-none"
        style={{ background: 'linear-gradient(0deg,rgba(0,0,0,0.75) 0%,transparent 100%)' }}>
        <span className="text-white/40 text-[9px] tabular-nums font-mono">
          <FrameTimestamp />
        </span>
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
          style={{
            background: status === 'online'  ? 'rgba(16,185,129,0.25)'
                      : status === 'offline' ? 'rgba(239,68,68,0.25)'
                      : 'rgba(100,116,139,0.25)',
            color:      status === 'online'  ? '#4ADE80'
                      : status === 'offline' ? '#F87171'
                      : '#94A3B8',
          }}>
          {status === 'online' ? 'ONLINE' : status === 'offline' ? 'OFFLINE' : status === 'loading' ? 'CONNECTING…' : 'STANDBY'}
        </span>
      </div>

      {/* Corner scan lines decorative */}
      {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((pos, i) => (
        <div key={i} className={`absolute ${pos} size-3 pointer-events-none`}
          style={{
            borderTop:    i < 2 ? `1.5px solid ${slot.color}60` : 'none',
            borderBottom: i >= 2 ? `1.5px solid ${slot.color}60` : 'none',
            borderLeft:   i % 2 === 0 ? `1.5px solid ${slot.color}60` : 'none',
            borderRight:  i % 2 === 1 ? `1.5px solid ${slot.color}60` : 'none',
          }} />
      ))}
    </div>
  )
}

interface FullscreenViewProps {
  slot: CameraSlot
  url:  string
  onClose: () => void
}

function FullscreenView({ slot, url, onClose }: FullscreenViewProps) {
  const [ticker, setTicker] = useState(Date.now())
  const [status, setStatus] = useState<Status>(url ? 'loading' : 'idle')

  useEffect(() => {
    if (!url) return
    const t = setInterval(() => setTicker(Date.now()), 2000)
    return () => clearInterval(t)
  }, [url])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const imgSrc = url ? `${url}${url.includes('?') ? '&' : '?'}_t=${ticker}` : ''

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#000' }}>
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2"
        style={{ background: 'rgba(0,0,0,0.8)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full" style={{ background: slot.color, boxShadow: `0 0 6px ${slot.color}` }} />
          <span className="text-white text-sm font-bold">{slot.label}</span>
          <span className="text-white/40 text-xs">{slot.subLabel}</span>
        </div>
        <button onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white/60 hover:text-white hover:bg-white/10 transition-all">
          <Minimize2 className="size-3.5" />
          ปิดเต็มจอ (Esc)
        </button>
      </div>

      {/* Feed */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {url ? (
          <img src={imgSrc} alt={slot.label}
            className="max-w-full max-h-full object-contain"
            onLoad={() => setStatus('online')}
            onError={() => setStatus('offline')} />
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Camera className="size-16 text-slate-700" />
            <p className="text-slate-500">ยังไม่ได้ตั้งค่า URL กล้อง</p>
          </div>
        )}

        {/* Status corner */}
        <div className="absolute bottom-4 right-4 flex items-center gap-2">
          {status === 'online' && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full"
              style={{ background: 'rgba(220,38,38,0.8)' }}>
              <span className="size-1.5 rounded-full bg-red-200" style={{ animation: 'pulse 1s infinite' }} />
              <span className="text-white text-[10px] font-bold tracking-widest">LIVE</span>
            </div>
          )}
          <span className="text-white/30 text-xs tabular-nums font-mono"><FrameTimestamp /></span>
        </div>
      </div>
    </div>
  )
}

export default function MonitorPage() {
  const [urls, setUrls]           = useState<CameraUrls>({ plate: '', face: '', rear: '' })
  const [showSettings, setShowSettings] = useState(false)
  const [draft, setDraft]         = useState<CameraUrls>({ plate: '', face: '', rear: '' })
  const [showUrls, setShowUrls]   = useState<Record<string, boolean>>({ plate: false, face: false, rear: false })
  const [expanded, setExpanded]   = useState<CameraSlot | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as CameraUrls
        setUrls(parsed)
        setDraft(parsed)
      }
    } catch {}
  }, [])

  function openSettings() { setDraft({ ...urls }); setShowSettings(true) }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    setUrls({ ...draft })
    setShowSettings(false)
  }

  const handleExpand = useCallback((slot: CameraSlot) => setExpanded(slot), [])
  const handleClose  = useCallback(() => setExpanded(null), [])

  const onlineCount = CAMERAS.filter(c => urls[c.id]).length

  return (
    <div className="flex flex-col h-full" style={{ background: '#0C0E16' }}>

      {/* ─── Header ─── */}
      <header className="shrink-0 flex items-center justify-between px-5 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.4)' }}>
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl shrink-0"
            style={{ background: 'linear-gradient(135deg,#1E3A8A,#1D4ED8)', boxShadow: '0 2px 12px rgba(29,78,216,0.4)' }}>
            <Camera className="size-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">ระบบกล้องวงจรปิด</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">CCTV Monitor · {CAMERAS.length} กล้อง</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status dots */}
          <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-lg mr-1"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {CAMERAS.map(c => (
              <div key={c.id} className="flex items-center gap-1">
                <span className="size-1.5 rounded-full" style={{ background: urls[c.id] ? c.color : '#334155' }} />
                <span className="text-[9px] font-semibold" style={{ color: urls[c.id] ? c.color : '#475569' }}>{c.camNum}</span>
              </div>
            ))}
          </div>

          {/* Clock */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Clock className="size-3 text-slate-500" />
            <span className="text-sm font-black text-white tabular-nums font-mono"><LiveTimestamp /></span>
          </div>

          {/* Settings */}
          <button onClick={openSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: '#94A3B8' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94A3B8' }}
          >
            <Settings className="size-3.5" />
            ตั้งค่ากล้อง
          </button>
        </div>
      </header>

      {/* ─── Camera Grid ─── */}
      <div className="flex-1 p-4 overflow-hidden">
        <div className="h-full grid gap-3" style={{ gridTemplateColumns: '2fr 1fr', gridTemplateRows: '1fr 1fr' }}>

          {/* Main — plate (spans 2 rows) */}
          <div style={{ gridRow: '1 / 3' }}>
            <CameraPanel slot={CAMERAS[0]} url={urls.plate} size="large" onExpand={() => handleExpand(CAMERAS[0])} />
          </div>

          {/* Top-right — face */}
          <div style={{ gridRow: '1 / 2' }}>
            <CameraPanel slot={CAMERAS[1]} url={urls.face} size="small" onExpand={() => handleExpand(CAMERAS[1])} />
          </div>

          {/* Bottom-right — rear */}
          <div style={{ gridRow: '2 / 3' }}>
            <CameraPanel slot={CAMERAS[2]} url={urls.rear} size="small" onExpand={() => handleExpand(CAMERAS[2])} />
          </div>

        </div>
      </div>

      {/* ─── Status bar ─── */}
      <footer className="shrink-0 flex items-center justify-between px-5 py-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.3)' }}>
        <div className="flex items-center gap-4">
          {CAMERAS.map(c => (
            <div key={c.id} className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full shrink-0"
                style={{ background: urls[c.id] ? '#4ADE80' : '#334155', boxShadow: urls[c.id] ? '0 0 4px #4ADE80' : 'none' }} />
              <span className="text-[10px] font-semibold" style={{ color: urls[c.id] ? '#94A3B8' : '#475569' }}>{c.label}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-600">
          ตั้งค่าแล้ว {onlineCount}/{CAMERAS.length} กล้อง
          {onlineCount === 0 && ' · กดปุ่ม "ตั้งค่ากล้อง" เพื่อเพิ่ม URL'}
        </p>
      </footer>

      {/* ─── Settings Modal ─── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden"
            style={{ background: '#13161F', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2.5">
                <Settings className="size-4 text-blue-400" />
                <h2 className="text-sm font-bold text-white">ตั้งค่า URL กล้อง</h2>
              </div>
              <button onClick={() => setShowSettings(false)}
                className="flex size-6 items-center justify-center rounded-lg hover:bg-white/10 transition-colors">
                <X className="size-3.5 text-slate-400" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-5 py-4 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                ใส่ URL ของกล้อง เช่น <span className="text-slate-400 font-mono">http://192.168.1.100/snapshot.jpg</span> (snapshot) หรือ URL ของ MJPEG stream โดยตรง
              </p>

              {CAMERAS.map(c => (
                <div key={c.id}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="size-1.5 rounded-full shrink-0" style={{ background: c.color }} />
                    <label className="text-xs font-bold text-white">{c.label}</label>
                    <span className="text-[10px] text-slate-600">{c.subLabel} · {c.camNum}</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showUrls[c.id] ? 'text' : 'password'}
                      value={draft[c.id]}
                      onChange={e => setDraft(prev => ({ ...prev, [c.id]: e.target.value }))}
                      placeholder={`http://camera-ip/snapshot.jpg`}
                      className="w-full h-9 pl-3 pr-9 rounded-lg text-xs text-slate-200 placeholder-slate-600 outline-none font-mono"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: `1.5px solid ${draft[c.id] ? c.color + '50' : 'rgba(255,255,255,0.08)'}`,
                        transition: 'border-color .15s',
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = c.color + '90' }}
                      onBlur={e => { e.currentTarget.style.borderColor = draft[c.id] ? c.color + '50' : 'rgba(255,255,255,0.08)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowUrls(p => ({ ...p, [c.id]: !p[c.id] }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                      {showUrls[c.id] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                </div>
              ))}

              <div className="rounded-lg px-3 py-2.5 text-[10px] text-slate-500 leading-relaxed"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="font-semibold text-slate-400 mb-1">💡 รูปแบบ URL ที่รองรับ</p>
                <p>• <span className="font-mono text-slate-400">http://IP/snapshot.jpg</span> — polling ทุก 2 วินาที</p>
                <p>• <span className="font-mono text-slate-400">http://IP:PORT/stream.mjpg</span> — MJPEG stream ต่อเนื่อง</p>
                <p className="mt-1 text-slate-600">URL จะถูกบันทึกใน localStorage ของ browser นี้</p>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-2 px-5 py-4"
              style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <button onClick={() => setShowSettings(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                ยกเลิก
              </button>
              <button onClick={saveSettings}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white transition-all"
                style={{ background: 'linear-gradient(135deg,#1D4ED8,#3B82F6)', boxShadow: '0 2px 10px rgba(29,78,216,0.4)' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                <Save className="size-3.5" />
                บันทึกการตั้งค่า
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Fullscreen view ─── */}
      {expanded && (
        <FullscreenView slot={expanded} url={urls[expanded.id]} onClose={handleClose} />
      )}
    </div>
  )
}
