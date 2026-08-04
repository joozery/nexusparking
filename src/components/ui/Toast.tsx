'use client'

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

interface ToastContextValue {
  toast: (opts: Omit<ToastItem, 'id'>) => void
  success: (title: string, message?: string) => void
  error:   (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info:    (title: string, message?: string) => void
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

const META: Record<ToastType, {
  icon: typeof CheckCircle2
  accent: string
  bg: string
  iconColor: string
  bar: string
}> = {
  success: {
    icon: CheckCircle2,
    accent: '#059669',
    bg: 'rgba(5,150,105,0.07)',
    iconColor: '#059669',
    bar: '#10B981',
  },
  error: {
    icon: XCircle,
    accent: '#DC2626',
    bg: 'rgba(220,38,38,0.07)',
    iconColor: '#DC2626',
    bar: '#EF4444',
  },
  warning: {
    icon: AlertTriangle,
    accent: '#D97706',
    bg: 'rgba(217,119,6,0.07)',
    iconColor: '#D97706',
    bar: '#F59E0B',
  },
  info: {
    icon: Info,
    accent: '#1D4ED8',
    bg: 'rgba(29,78,216,0.07)',
    iconColor: '#1D4ED8',
    bar: '#3B82F6',
  },
}

// ─── Single Toast ─────────────────────────────────────────────────────────────

function ToastCard({ item, onClose }: { item: ToastItem; onClose: (id: string) => void }) {
  const m = META[item.type]
  const Icon = m.icon
  const dur = item.duration ?? 4000
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const show = requestAnimationFrame(() => setVisible(true))
    const hide = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onClose(item.id), 300)
    }, dur)
    return () => { cancelAnimationFrame(show); clearTimeout(hide) }
  }, [item.id, dur, onClose])

  return (
    <div
      className="relative overflow-hidden rounded-xl pointer-events-auto transition-all duration-300 ease-out"
      style={{
        background: 'white',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(24px)',
        width: 340,
        minWidth: 280,
      }}
    >
      {/* left accent */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: m.accent }} />

      {/* progress bar */}
      <div className="absolute bottom-0 left-0 h-[2px] rounded-b-2xl"
        style={{
          background: m.bar,
          width: '100%',
          animation: `shrink-bar ${dur}ms linear forwards`,
        }} />

      <div className="flex items-start gap-3 px-4 py-3.5 pl-5">
        <div className="size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: m.bg }}>
          <Icon className="size-4" style={{ color: m.iconColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-slate-800 leading-snug">{item.title}</p>
          {item.message && (
            <p className="text-xs text-slate-500 mt-0.5 leading-snug">{item.message}</p>
          )}
        </div>
        <button
          onClick={() => { setVisible(false); setTimeout(() => onClose(item.id), 300) }}
          className="size-6 rounded-lg flex items-center justify-center shrink-0 transition-colors mt-0.5"
          style={{ color: '#94A3B8' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((opts: Omit<ToastItem, 'id'>) => {
    const id = `t-${++counter.current}`
    setToasts(prev => [...prev.slice(-4), { ...opts, id }])
  }, [])

  const success = useCallback((title: string, message?: string) => toast({ type: 'success', title, message }), [toast])
  const error   = useCallback((title: string, message?: string) => toast({ type: 'error',   title, message }), [toast])
  const warning = useCallback((title: string, message?: string) => toast({ type: 'warning', title, message }), [toast])
  const info    = useCallback((title: string, message?: string) => toast({ type: 'info',    title, message }), [toast])

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}

      {/* Container */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 pointer-events-none">
        <style>{`
          @keyframes shrink-bar {
            from { width: 100% }
            to   { width: 0% }
          }
        `}</style>
        {toasts.map(item => (
          <ToastCard key={item.id} item={item} onClose={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
