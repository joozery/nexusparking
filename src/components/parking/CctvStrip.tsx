'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Camera, X, LogIn, LogOut } from 'lucide-react'

type CamId = 'plate' | 'face' | 'rear' | 'exit'
type CameraUrls = Record<CamId, string>
type Status = 'idle' | 'loading' | 'online' | 'offline'

const ENTRY_CAMS = [
  { id: 'plate' as CamId, label: 'ป้ายทะเบียน', num: 'CAM-01', accent: '#1D4ED8' },
  { id: 'face'  as CamId, label: 'หน้าคนขับ',   num: 'CAM-02', accent: '#059669' },
  { id: 'rear'  as CamId, label: 'Rear',         num: 'CAM-03', accent: '#7C3AED' },
  { id: 'exit'  as CamId, label: 'ขาออก',        num: 'CAM-04', accent: '#EA580C' },
]
const EXIT_CAMS = [
  { id: 'rear' as CamId, label: 'Rear',   num: 'CAM-03', accent: '#7C3AED' },
  { id: 'exit' as CamId, label: 'ขาออก', num: 'CAM-04', accent: '#EA580C' },
]

type CamDef = typeof ENTRY_CAMS[0]

/* ── single thumbnail ── */
function MiniCam({ cam, url, onExpand }: { cam: CamDef; url: string; onExpand: () => void }) {
  const [status, setStatus] = useState<Status>('idle')
  const [ticker, setTicker] = useState(Date.now())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isMjpeg = url.includes('stream.mjpeg') || url.includes('.mjpg') || url.includes('mjpeg')
  const isRtsp  = url.startsWith('rtsp://')

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!url || isRtsp || isMjpeg) {
      setStatus(url && !isRtsp ? 'loading' : 'idle')
      return
    }
    setStatus('loading')
    timerRef.current = setInterval(() => setTicker(Date.now()), 500)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [url, isRtsp, isMjpeg])

  const src = isRtsp ? ''
    : isMjpeg ? url
    : url ? `${url}${url.includes('?') ? '&' : '?'}_t=${ticker}` : ''

  return (
    <div
      className="relative flex-1 bg-[#0D1117] rounded-xl overflow-hidden cursor-pointer group"
      onClick={onExpand}
      style={{ minHeight: 0 }}
    >
      {url && !isRtsp ? (
        <img src={src} alt={cam.label}
          className="absolute inset-0 w-full h-full object-cover"
          onLoad={() => setStatus('online')}
          onError={() => setStatus('offline')} />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 select-none">
          <Camera className="size-5" style={{ color: 'rgba(255,255,255,0.1)' }} />
          <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.1)' }}>
            {isRtsp ? 'RTSP — ต้องผ่าน go2rtc' : 'ยังไม่ได้ตั้งค่า URL'}
          </span>
        </div>
      )}

      {/* LIVE badge */}
      {status === 'online' && (
        <div className="absolute top-2 left-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full pointer-events-none"
          style={{ background: 'rgba(220,38,38,0.85)' }}>
          <span className="size-1 rounded-full bg-red-200 animate-pulse" />
          <span className="text-white font-bold tracking-widest" style={{ fontSize: '8px' }}>LIVE</span>
        </div>
      )}

      {/* hover overlay */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: 'rgba(0,0,0,0.28)' }}>
        <span className="text-white text-[11px] font-bold px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(0,0,0,0.45)' }}>เต็มจอ</span>
      </div>

      {/* bottom label */}
      <div className="absolute bottom-0 left-0 right-0 px-2.5 py-2 flex items-center gap-1.5"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)' }}>
        <span className="text-[9px] font-black px-1.5 py-0.5 rounded tabular-nums"
          style={{ background: cam.accent + '30', color: cam.accent, border: `1px solid ${cam.accent}50` }}>
          {cam.num}
        </span>
        <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>{cam.label}</span>
      </div>
    </div>
  )
}

/* ── fullscreen overlay ── */
function FullscreenCam({ cam, url, onClose }: { cam: CamDef; url: string; onClose: () => void }) {
  const [ticker, setTicker] = useState(Date.now())
  const [status, setStatus] = useState<Status>(url ? 'loading' : 'idle')
  const isMjpeg = url.includes('stream.mjpeg') || url.includes('.mjpg') || url.includes('mjpeg')
  const src = isMjpeg ? url : url ? `${url}${url.includes('?') ? '&' : '?'}_t=${ticker}` : ''

  useEffect(() => {
    if (!url || isMjpeg) return
    const t = setInterval(() => setTicker(Date.now()), 500)
    return () => clearInterval(t)
  }, [url, isMjpeg])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black">
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5"
        style={{ background: 'rgba(0,0,0,0.9)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2.5">
          <span className="size-2 rounded-full shrink-0" style={{ background: cam.accent }} />
          <span className="text-white text-sm font-bold">{cam.label}</span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{cam.num}</span>
          {status === 'online' && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full ml-1"
              style={{ background: 'rgba(220,38,38,0.8)' }}>
              <span className="size-1.5 rounded-full bg-red-200 animate-pulse" />
              <span className="text-white font-bold tracking-widest" style={{ fontSize: '9px' }}>LIVE</span>
            </div>
          )}
        </div>
        <button onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{ color: 'rgba(255,255,255,0.5)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}>
          <X className="size-3.5" /> ปิด (Esc)
        </button>
      </div>
      <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
        {url ? (
          <img src={src} alt={cam.label}
            className="max-w-full max-h-full object-contain"
            onLoad={() => setStatus('online')}
            onError={() => setStatus('offline')} />
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Camera className="size-16 text-slate-700" />
            <p className="text-slate-500 text-sm">ยังไม่ได้ตั้งค่า URL กล้อง</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── exported strip ── */
export function CctvStrip() {
  const [urls, setUrls]         = useState<CameraUrls>({ plate: '', face: '', rear: '', exit: '' })
  const [isExit, setIsExit]     = useState(false)   // false = ขาเข้า, true = ขาออก
  const [expanded, setExpanded] = useState<CamDef | null>(null)

  useEffect(() => {
    fetch('/api/cctv')
      .then(r => r.json())
      .then((p: CameraUrls) => setUrls(p))
      .catch(() => {
        try {
          const raw = localStorage.getItem('np_cctv_urls')
          if (raw) setUrls(JSON.parse(raw) as CameraUrls)
        } catch { /* ignore */ }
      })
  }, [])

  const toggleExit = useCallback(() => setIsExit(v => !v), [])

  const cams = isExit ? EXIT_CAMS : ENTRY_CAMS

  return (
    <>
      <div className="flex-1 flex flex-col gap-2 min-h-0">

        {/* header row: mode badge + Shortcut hint */}
        <div className="shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold"
              style={isExit
                ? { background: 'rgba(234,88,12,0.1)', color: '#EA580C', border: '1px solid rgba(234,88,12,0.2)' }
                : { background: 'rgba(29,78,216,0.1)', color: '#1D4ED8', border: '1px solid rgba(29,78,216,0.2)' }}>
              {isExit
                ? <><LogOut className="size-3" /> กล้องขาออก</>
                : <><LogIn  className="size-3" /> กล้องขาเข้า</>}
            </div>
          </div>
          <button
            onClick={toggleExit}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
            style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}
            onMouseEnter={e => e.currentTarget.style.background = '#E2E8F0'}
            onMouseLeave={e => e.currentTarget.style.background = '#F1F5F9'}
          >
            {isExit ? <><LogIn className="size-3" />ขาเข้า</> : <><LogOut className="size-3" />ขาออก</>}
          </button>
        </div>

        {/* camera grid: 2 cols, 2 rows (entry) or 2 cols 1 row (exit) */}
        <div className="flex-1 grid grid-cols-2 gap-2.5 min-h-0">
          {cams.map(cam => (
            <MiniCam
              key={cam.id}
              cam={cam}
              url={urls[cam.id]}
              onExpand={() => setExpanded(cam)}
            />
          ))}
        </div>
      </div>

      {expanded && (
        <FullscreenCam cam={expanded} url={urls[expanded.id]} onClose={() => setExpanded(null)} />
      )}
    </>
  )
}
