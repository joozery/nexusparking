'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Eye, EyeOff, Lock, User, AlertCircle, RefreshCw,
  Shield, ChevronRight,
} from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [username,   setUsername]   = useState('')
  const [password,   setPassword]   = useState('')
  const [showPwd,    setShowPwd]    = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [needsSetup, setNeedsSetup] = useState(false)
  const [setupName,  setSetupName]  = useState('')

  useEffect(() => {
    fetch('/api/auth/setup')
      .then(r => r.json())
      .then(d => setNeedsSetup(d.needsSetup))
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) router.push('/gate')
      else setError((await res.json()).error ?? 'เข้าสู่ระบบไม่สำเร็จ')
    } finally { setLoading(false) }
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, name: setupName }),
      })
      if (res.ok) { setNeedsSetup(false); setError('') }
      else setError((await res.json()).error ?? 'สร้างบัญชีไม่สำเร็จ')
    } finally { setLoading(false) }
  }

  return (
    <div className="relative h-screen flex items-center justify-center overflow-hidden select-none">

      {/* ── Background image ── */}
      <div className="absolute inset-0">
        <Image
          src="/coverlogin.png"
          alt="background"
          fill
          style={{ objectFit: 'cover', objectPosition: 'center' }}
          priority
          quality={90}
        />
      </div>

      {/* ── Scan line ── */}
      <div className="absolute inset-x-0 h-px pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 40%, rgba(255,255,255,0.3) 60%, transparent 100%)',
          animation: 'scanline 5s linear infinite',
        }} />

      <style>{`
        @keyframes floatA {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(30px, -20px) scale(1.05); }
        }
        @keyframes floatB {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-25px, 20px) scale(1.08); }
        }
        @keyframes scanline {
          0%   { top: 0%; opacity: 0.8; }
          50%  { opacity: 0.3; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.6s ease both; }
        .fade-up-delay { animation: fadeUp 0.6s ease 0.15s both; }
        .fade-up-delay2 { animation: fadeUp 0.6s ease 0.25s both; }

        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-text-fill-color: #1e293b;
          -webkit-box-shadow: 0 0 0px 1000px #f8faff inset;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>

      {/* ── Card ── */}
      <div className="relative z-10 w-full max-w-[420px] mx-4 fade-up">

        {/* Glass card */}
        <div className="rounded-3xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.96)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.15)',
            backdropFilter: 'blur(20px)',
          }}>

          {/* Top accent bar */}
          <div className="h-1 w-full"
            style={{ background: 'linear-gradient(90deg, #1E3A8A, #3B82F6, #6366F1)' }} />

          <div className="px-8 pt-8 pb-8">

            {/* ── Logo ── */}
            <div className="flex justify-center mb-6 fade-up">
              <div className="relative w-[200px] h-[50px]">
                <Image
                  src="/logo/logonext.svg"
                  alt="NexusParking Logo"
                  fill
                  style={{ objectFit: 'contain', objectPosition: 'center' }}
                  priority
                />
              </div>
            </div>

            {/* ── Divider ── */}
            <div className="flex items-center gap-3 mb-6 fade-up-delay">
              <div className="flex-1 h-px" style={{ background: '#E2E8F0' }} />
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full animate-pulse" style={{ background: '#4ADE80' }} />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {needsSetup ? 'ตั้งค่าระบบ' : 'เข้าสู่ระบบ'}
                </span>
              </div>
              <div className="flex-1 h-px" style={{ background: '#E2E8F0' }} />
            </div>

            {/* ── Title ── */}
            <div className="text-center mb-6 fade-up-delay">
              <h1 className="text-xl font-black text-slate-800">
                {needsSetup ? 'สร้างบัญชีผู้ดูแล' : 'ยินดีต้อนรับ'}
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                {needsSetup
                  ? 'กรุณาตั้งค่า Superadmin ก่อนใช้งาน'
                  : 'กรุณาใส่ข้อมูลเพื่อเข้าใช้งานระบบ'}
              </p>
            </div>

            {/* ── Form ── */}
            <form onSubmit={needsSetup ? handleSetup : handleLogin} className="space-y-4 fade-up-delay2">

              {needsSetup && (
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    ชื่อ-นามสกุล
                  </label>
                  <input
                    value={setupName}
                    onChange={e => setSetupName(e.target.value)}
                    placeholder="ผู้ดูแลระบบ"
                    required
                    className="w-full h-11 px-4 rounded-xl text-sm text-slate-800 outline-none transition-all"
                    style={{ border: '2px solid #E8ECF4', background: '#F8FAFF' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#3B82F6'; e.currentTarget.style.background = 'white' }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#E8ECF4'; e.currentTarget.style.background = '#F8FAFF' }}
                  />
                </div>
              )}

              {/* Username */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 size-7 flex items-center justify-center rounded-lg"
                    style={{ background: 'rgba(59,130,246,0.1)' }}>
                    <User className="size-3.5" style={{ color: '#3B82F6' }} />
                  </div>
                  <input
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="กรอก username"
                    autoComplete="username"
                    required
                    className="w-full h-11 pl-12 pr-4 rounded-xl text-sm text-slate-800 outline-none transition-all font-mono"
                    style={{ border: '2px solid #E8ECF4', background: '#F8FAFF' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#3B82F6'; e.currentTarget.style.background = 'white' }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#E8ECF4'; e.currentTarget.style.background = '#F8FAFF' }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 size-7 flex items-center justify-center rounded-lg"
                    style={{ background: 'rgba(59,130,246,0.1)' }}>
                    <Lock className="size-3.5" style={{ color: '#3B82F6' }} />
                  </div>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="กรอก password"
                    autoComplete="current-password"
                    required
                    className="w-full h-11 pl-12 pr-12 rounded-xl text-sm text-slate-800 outline-none transition-all"
                    style={{ border: '2px solid #E8ECF4', background: '#F8FAFF' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#3B82F6'; e.currentTarget.style.background = 'white' }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#E8ECF4'; e.currentTarget.style.background = '#F8FAFF' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(s => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                    {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold"
                  style={{ background: 'rgba(220,38,38,0.06)', color: '#DC2626', border: '1.5px solid rgba(220,38,38,0.15)' }}>
                  <AlertCircle className="size-3.5 shrink-0" />
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !username || !password || (needsSetup && !setupName)}
                className="w-full h-12 rounded-xl text-white text-sm font-black flex items-center justify-center gap-2 transition-all mt-2 group"
                style={{
                  background: loading || !username || !password
                    ? 'linear-gradient(135deg, #94a3b8, #94a3b8)'
                    : 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 60%, #3B82F6 100%)',
                  boxShadow: loading || !username || !password
                    ? 'none'
                    : '0 6px 24px rgba(37,99,235,0.45)',
                  transform: 'translateY(0)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = '0 10px 32px rgba(37,99,235,0.5)'
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 6px 24px rgba(37,99,235,0.45)'
                }}>
                {loading
                  ? <><RefreshCw className="size-4 animate-spin" /> กำลังดำเนินการ...</>
                  : needsSetup
                  ? <><Shield className="size-4" /> สร้างบัญชี Superadmin</>
                  : <><span>เข้าสู่ระบบ</span><ChevronRight className="size-4 group-hover:translate-x-0.5 transition-transform" /></>
                }
              </button>

            </form>

            {/* ── Footer ── */}
            <div className="mt-6 pt-5 flex items-center justify-center gap-2 text-[10px] text-slate-400"
              style={{ borderTop: '1px solid #F1F5F9' }}>
              <span className="size-1.5 rounded-full bg-green-400 animate-pulse" />
              <span>ระบบออนไลน์</span>
              <span className="size-1 rounded-full bg-slate-200" />
              <span>Parking Management System</span>
            </div>

          </div>
        </div>

        {/* Card bottom glow */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-12 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse, rgba(59,130,246,0.25) 0%, transparent 70%)',
            filter: 'blur(8px)',
          }} />

      </div>
    </div>
  )
}
