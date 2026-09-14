'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Camera, X, LogIn, LogOut } from 'lucide-react'

type CamId = 'plate' | 'face' | 'rear' | 'exit' | 'plateOut' | 'faceOut'
type CameraUrls = Record<CamId, string>
type Status = 'idle' | 'loading' | 'online' | 'offline'

const ENTRY_CAMS = [
  { id: 'plate' as CamId, label: 'ป้ายทะเบียน', num: 'CAM-01', accent: '#A16207' },
  { id: 'face'  as CamId, label: 'หน้าคนขับ',   num: 'CAM-02', accent: '#059669' },
  { id: 'rear'  as CamId, label: 'Rear',         num: 'CAM-03', accent: '#7C3AED' },
  { id: 'exit'  as CamId, label: 'ขาออก',        num: 'CAM-04', accent: '#EA580C' },
]
const EXIT_CAMS = [
  { id: 'plateOut' as CamId, label: 'ป้ายทะเบียน ขาออก', num: 'CAM-05', accent: '#DC2626' },
  { id: 'faceOut'  as CamId, label: 'หน้าคนขับ ขาออก',   num: 'CAM-06', accent: '#0891B2' },
]

const DEFAULT_CCTV_PLACEHOLDERS: Record<CamId, string> = {
  plate:    '/cctv/cam_plate.jpg',
  face:     '/cctv/cam_face.jpg',
  rear:     '/cctv/cam_rear.jpg',
  exit:     '/cctv/cam_exit.jpg',
  plateOut: '/cctv/cam_plate_out.jpg',
  faceOut:  '/cctv/cam_face_out.jpg',
}

type CamDef = typeof ENTRY_CAMS[0]

/* ── single thumbnail ── */
function MiniCam({ cam, url, onExpand }: { cam: CamDef; url: string; onExpand: () => void }) {
  const [status, setStatus] = useState<Status>('idle')
  const [ticker, setTicker] = useState(Date.now())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isMjpeg = url.includes('stream.mjpeg') || url.includes('.mjpg') || url.includes('mjpeg')
  const isRtsp  = url.startsWith('rtsp://')
  const isMock  = !url
  const placeholder = DEFAULT_CCTV_PLACEHOLDERS[cam.id]

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!url || isRtsp || isMjpeg) {
      setStatus(url && !isRtsp ? 'loading' : 'idle')
      return
    }
    setStatus('loading')
    timerRef.current = setInterval(() => setTicker(Date.now()), 2000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [url, isRtsp, isMjpeg])

  const src = isRtsp ? ''
    : isMjpeg ? url
    : url ? `${url}${url.includes('?') ? '&' : '?'}_t=${ticker}` : placeholder

  return (
    <div
      className="relative flex-1 bg-[#0D1117] rounded-xl overflow-hidden cursor-pointer group"
      onClick={onExpand}
      style={{ minHeight: 0 }}
    >
      {isRtsp ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 select-none">
          <Camera className="size-5" style={{ color: 'rgba(255,255,255,0.1)' }} />
          <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.1)' }}>
            RTSP — ต้องผ่าน go2rtc
          </span>
        </div>
      ) : (
        <img src={src} alt={cam.label}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onLoad={() => { if (url) setStatus('online') }}
          onError={() => { if (url) setStatus('offline') }} />
      )}

      {/* LIVE badge */}
      {status === 'online' && (
        <div className="absolute top-2 left-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full pointer-events-none"
          style={{ background: 'rgba(220,38,38,0.85)' }}>
          <span className="size-1 rounded-full bg-red-200 animate-pulse" />
          <span className="text-white font-bold tracking-widest" style={{ fontSize: '8px' }}>LIVE</span>
        </div>
      )}

      {/* Mock badge */}
      {isMock && !isRtsp && (
        <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full pointer-events-none"
          style={{ background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(4px)', border: '1px solid rgba(251,191,36,0.25)' }}>
          <span className="size-1 rounded-full bg-amber-400" />
          <span className="text-amber-300 font-bold" style={{ fontSize: '8px' }}>จำลอง</span>
        </div>
      )}

      {/* hover overlay */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: 'rgba(0,0,0,0.28)' }}>
        <span className="text-white text-[11px] font-bold px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(0,0,0,0.45)' }}>เต็มจอ</span>
      </div>

      {/* bottom label */}
      <div className="absolute bottom-0 left-0 right-0 px-2.5 py-2 flex flex-col gap-0.5"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)' }}>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded tabular-nums"
            style={{ background: cam.accent + '30', color: cam.accent, border: `1px solid ${cam.accent}50` }}>
            {cam.num}
          </span>
          <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>{cam.label}</span>
        </div>
        <span className="text-[8px] font-mono truncate" title={url || 'ภาพจำลองระบบ'}
          style={{ color: 'rgba(255,255,255,0.4)' }}>
          {url || 'ภาพจำลองระบบ'}
        </span>
      </div>
    </div>
  )
}

/* ── fullscreen modal ── */
function FullscreenCam({ cam, url, onClose }: { cam: CamDef; url: string; onClose: () => void }) {
  const [ticker, setTicker] = useState(Date.now())
  const [status, setStatus] = useState<Status>(url ? 'loading' : 'idle')
  const placeholder = DEFAULT_CCTV_PLACEHOLDERS[cam.id]
  const isMjpeg = url.includes('stream.mjpeg') || url.includes('.mjpg') || url.includes('mjpeg')
  const src = isMjpeg ? url : url ? `${url}${url.includes('?') ? '&' : '?'}_t=${ticker}` : placeholder

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
          <span className="text-xs font-mono truncate max-w-[420px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {url || 'ภาพจำลอง (Simulation Feed)'}
          </span>
          {status === 'online' && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full ml-1"
              style={{ background: 'rgba(220,38,38,0.8)' }}>
              <span className="size-1.5 rounded-full bg-red-200 animate-pulse" />
              <span className="text-white font-bold tracking-widest" style={{ fontSize: '9px' }}>LIVE</span>
            </div>
          )}
          {!url && (
            <span className="text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/70 border border-amber-500/30 ml-1">
              ภาพจำลอง
            </span>
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
        <img src={src} alt={cam.label}
          className="max-w-full max-h-full object-contain"
          onLoad={() => { if (url) setStatus('online') }}
          onError={() => { if (url) setStatus('offline') }} />
        {!url && (
          <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full pointer-events-none"
            style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(4px)', border: '1px solid rgba(251,191,36,0.3)' }}>
            <span className="size-2 rounded-full bg-amber-400" />
            <span className="text-amber-300 text-xs font-bold">ภาพจำลองระบบกล้อง (Simulation Feed)</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── entry-capture thumbnail (static photo taken at checkin, replayed at checkout) ── */
const ENTRY_CAPTURE_CAMS = [
  { camType: 'cam-plate' as const, label: 'ป้ายทะเบียน', accent: '#A16207' },
  { camType: 'cam-face'  as const, label: 'หน้าคนขับ',   accent: '#059669' },
  { camType: 'cam-rear'  as const, label: 'Rear',         accent: '#7C3AED' },
  { camType: 'cam-exit'  as const, label: 'ขาออก',        accent: '#EA580C' },
]

function EntryCaptureThumb({ sessionId, camType, label, accent }: {
  sessionId?: string; camType: string; label: string; accent: string
}) {
  const [failed, setFailed] = useState(false)
  const src = sessionId ? `/api/sessions/${sessionId}/photo?type=${camType}` : ''

  useEffect(() => setFailed(false), [sessionId, camType])

  return (
    <div className="relative flex-1 bg-[#0D1117] rounded-lg overflow-hidden" style={{ minHeight: 0 }}>
      {src && !failed ? (
        <img src={src} alt={label}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setFailed(true)} />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 select-none">
          <Camera className="size-4" style={{ color: 'rgba(255,255,255,0.1)' }} />
          <span className="text-[8px]" style={{ color: 'rgba(255,255,255,0.15)' }}>
            {sessionId ? 'ไม่มีภาพ' : 'รอสแกนบัตร'}
          </span>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)' }}>
        <span className="text-[9px] font-semibold" style={{ color: accent }}>{label}</span>
      </div>
    </div>
  )
}

function EntryCapturePanel({ sessionId, plate, style }: { sessionId?: string; plate?: string; style?: CSSProperties }) {
  return (
    <div className="shrink-0 flex flex-col gap-1.5 min-h-0" style={style}>
      <div className="shrink-0 flex items-center gap-1.5 px-0.5">
        <span className="text-[10px] font-bold" style={{ color: '#64748B' }}>ภาพตอนเข้า</span>
        {plate && (
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded tabular-nums"
            style={{ background: '#F1F5F9', color: '#334155', border: '1px solid #E2E8F0' }}>
            {plate}
          </span>
        )}
      </div>
      <div className="flex-1 grid grid-cols-4 gap-1.5 min-h-0">
        {ENTRY_CAPTURE_CAMS.map(cam => (
          <EntryCaptureThumb key={cam.camType} sessionId={sessionId} {...cam} />
        ))}
      </div>
    </div>
  )
}

/* ── exported strip ── */
interface CctvStripProps {
  isExit: boolean
  onToggleExit: () => void
  entrySessionId?: string
  entryPlate?: string
}

export function CctvStrip({ isExit, onToggleExit, entrySessionId, entryPlate }: CctvStripProps) {
  const [urls, setUrls]         = useState<CameraUrls>({ plate: '', face: '', rear: '', exit: '', plateOut: '', faceOut: '' })
  const [expanded, setExpanded] = useState<CamDef | null>(null)

  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    setIsMac(navigator.userAgent.toUpperCase().indexOf('MAC') >= 0)
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

  // F12 หรือ Alt+C → toggle entry / exit
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      // ใช้ทั้ง e.key และ e.code ให้ครอบคลุมทุกแบบ รวม Alt+C เผื่อเครื่อง Mac
      if (e.key === 'F12' || e.code === 'F12' || (e.altKey && e.code === 'KeyC')) {
        e.preventDefault()
        onToggleExit()
      }
    }
    // ใช้ capture: true เพื่อดัก event ก่อนที่ input ตัวอื่นจะกลืนไป
    window.addEventListener('keydown', fn, { capture: true })
    return () => window.removeEventListener('keydown', fn, { capture: true })
  }, [onToggleExit])

  const cams = isExit ? EXIT_CAMS : ENTRY_CAMS

  return (
    <>
      <div className="flex-1 flex flex-col gap-2 min-h-0">

        {/* header row: mode badge (centered) + Shortcut hint (stays right, F12 unchanged) */}
        <div className="shrink-0 grid grid-cols-3 items-center">
          <div />
          <div className="justify-self-center flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold"
            style={isExit
              ? { background: 'rgba(234,88,12,0.1)', color: '#EA580C', border: '1px solid rgba(234,88,12,0.2)' }
              : { background: 'rgba(161,98,7,0.1)', color: '#A16207', border: '1px solid rgba(161,98,7,0.2)' }}>
            {isExit
              ? <><LogOut className="size-3" /> ขาออก</>
              : <><LogIn  className="size-3" /> ขาเข้า</>}
          </div>
          <button
            onClick={onToggleExit}
            className="justify-self-end flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
            style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}
            onMouseEnter={e => e.currentTarget.style.background = '#E2E8F0'}
            onMouseLeave={e => e.currentTarget.style.background = '#F1F5F9'}
          >
            {isExit ? <><LogIn className="size-3" />ขาเข้า</> : <><LogOut className="size-3" />ขาออก</>}
            <kbd className="text-[9px] bg-white px-1.5 py-0.5 rounded font-mono shadow-sm"
              style={{ border: '1px solid #E2E8F0', color: '#94A3B8' }}>
              {isMac ? 'Option+C' : 'F12'}
            </kbd>
          </button>
        </div>

        {/* entry-capture replay: 4 slots in one row, on top — empty placeholders until a car is being checked out */}
        {isExit && (
          <EntryCapturePanel sessionId={entrySessionId} plate={entryPlate} style={{ height: '30%' }} />
        )}

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
