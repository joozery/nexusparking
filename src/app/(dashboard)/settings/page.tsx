'use client'

import { useEffect, useState } from 'react'
import {
  Settings, Clock, BadgeDollarSign, Cpu, Save,
  RefreshCw, Wifi, WifiOff,
  Camera, Shield, CreditCard, Printer, Banknote, Play,
  Car, Bike, Moon, AlertOctagon, ParkingSquare, Trash2,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface HWDevice { ip: string; port: number; endpoint: string; enabled: boolean }
interface AppSettings {
  businessHours: { open: string; close: string }
  capacity: { car: number; motorcycle: number }
  rates: {
    car:        { firstHour: number; extraHour: number }
    motorcycle: { firstHour: number; extraHour: number }
    overnight:  { windowStart: string; windowEnd: string; flatRate: number; extraHour: number }
  }
  hardware: { camera: HWDevice; barrier: HWDevice; reader: HWDevice; printer: HWDevice; drawer: HWDevice }
  lostCardFine: number
}

const TABS = [
  { key: 'general',  label: 'ทั่วไป',      icon: Clock },
  { key: 'hardware', label: 'ฮาร์ดแวร์',   icon: Cpu   },
] as const

const HW_META = {
  camera:  { label: 'กล้องวงจรปิด',          icon: Camera,     desc: 'ถ่าย Snapshot อัตโนมัติ' },
  barrier: { label: 'ไม้กั้นรถยนต์',         icon: Shield,     desc: 'เปิดหลัง Check-in/out'   },
  reader:  { label: 'เครื่องอ่านบัตร',        icon: CreditCard, desc: 'Passive — อ่าน UID'      },
  printer: { label: 'เครื่องพิมพ์ใบเสร็จ',   icon: Printer,    desc: 'พิมพ์ใบเสร็จ'             },
  drawer:  { label: 'ลิ้นชักเก็บเงิน',        icon: Banknote,   desc: 'เด้งหลัง Check-out'      },
}

type TabKey = typeof TABS[number]['key']

export default function SettingsPage() {
  const { success, error: toastError } = useToast()
  const [tab,      setTab]      = useState<TabKey>('general')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [testing,  setTesting]  = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, boolean | null>>({})
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [confirmText, setConfirmText]           = useState('')
  const [resetting,  setResetting]              = useState(false)

  async function fetchSettings() {
    setLoading(true)
    try { setSettings(await (await fetch('/api/settings')).json()) }
    finally { setLoading(false) }
  }
  useEffect(() => { fetchSettings() }, [])

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
      res.ok ? success('บันทึกการตั้งค่าสำเร็จ') : toastError('บันทึกไม่สำเร็จ', 'กรุณาลองใหม่อีกครั้ง')
    } finally { setSaving(false) }
  }

  async function handleReset() {
    setResetting(true)
    try {
      const res = await fetch('/api/reset', { method: 'DELETE' })
      if (res.ok) {
        success('ลบข้อมูลทั้งหมดสำเร็จ')
        setShowResetConfirm(false)
        setConfirmText('')
      } else {
        toastError('ลบข้อมูลไม่สำเร็จ', 'กรุณาลองใหม่อีกครั้ง')
      }
    } finally { setResetting(false) }
  }

  async function testHardware(device: string) {
    setTesting(device)
    setTestResult(r => ({ ...r, [device]: null }))
    try {
      const data = await (await fetch(`/api/hardware/trigger?device=${device}`)).json()
      setTestResult(r => ({ ...r, [device]: data.success }))
    } catch { setTestResult(r => ({ ...r, [device]: false })) }
    finally { setTesting(null) }
  }

  function updateHW(device: keyof AppSettings['hardware'], field: keyof HWDevice, value: string | number | boolean) {
    setSettings(s => s ? ({ ...s, hardware: { ...s.hardware, [device]: { ...s.hardware[device], [field]: value } } }) : s)
  }

  if (loading) return <div className="flex-1 flex items-center justify-center"><RefreshCw className="size-5 text-slate-300 animate-spin" /></div>
  if (!settings) return null

  return (
    <>

      {/* ── HEADER ── */}
      <header className="shrink-0 h-14 bg-white flex items-center justify-between px-6"
        style={{ borderBottom: '1px solid #E8ECF4' }}>
        <div className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded-lg"
            style={{ background: 'rgba(29,78,216,0.08)' }}>
            <Settings className="size-3.5" style={{ color: '#1D4ED8' }} />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 leading-none">ตั้งค่าระบบ</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">การกำหนดค่าและฮาร์ดแวร์</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="h-8 px-4 rounded-lg text-white text-xs font-bold flex items-center gap-1.5 hover:opacity-90 disabled:opacity-60"
          style={{ background: '#1D4ED8', boxShadow: '0 1px 8px rgba(29,78,216,0.35)' }}>
          {saving ? <RefreshCw className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
        </button>
      </header>

      {/* ── TABS ── */}
      <div className="shrink-0 px-5 pt-4 pb-0 bg-white" style={{ borderBottom: '1px solid #E8ECF4' }}>
        <div className="flex items-center gap-1">
          {TABS.map(t => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all relative"
                style={{ color: active ? '#1D4ED8' : '#94A3B8', background: active ? '#F0F2F8' : 'transparent' }}>
                <Icon className="size-3.5" />
                {t.label}
                {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: '#1D4ED8' }} />}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-4">

        {/* ══ GENERAL TAB ══ */}
        {tab === 'general' && (
          <>
            {/* Business Hours */}
            <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
              <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #E8ECF4', background: '#FAFBFF' }}>
                <div className="size-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(29,78,216,0.08)' }}>
                  <Clock className="size-4" style={{ color: '#1D4ED8' }} />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">เวลาทำการ</p>
                  <p className="text-[10px] text-slate-400">ระบบจะบล็อก Check-in นอกช่วงเวลานี้</p>
                </div>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 gap-4 max-w-xs">
                  {[
                    { label: 'เปิดบริการ', key: 'open'  as const },
                    { label: 'ปิดบริการ',  key: 'close' as const },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1.5">{label}</label>
                      <input type="time" value={settings.businessHours[key]}
                        onChange={e => setSettings(s => s ? ({ ...s, businessHours: { ...s.businessHours, [key]: e.target.value } }) : s)}
                        className="w-full h-10 px-3 rounded-lg text-sm text-slate-800 outline-none"
                        style={{ border: '1.5px solid #E8ECF4', background: '#FAFBFF' }}
                        onFocus={e => e.currentTarget.style.borderColor = '#1D4ED8'}
                        onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Capacity */}
            <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
              <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #E8ECF4', background: '#FAFBFF' }}>
                <div className="size-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(109,40,217,0.08)' }}>
                  <ParkingSquare className="size-4" style={{ color: '#6D28D9' }} />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">ความจุลานจอด</p>
                  <p className="text-[10px] text-slate-400">กำหนดจำนวนคันสูงสุดที่ลานรองรับได้แต่ละประเภท</p>
                </div>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 gap-4 max-w-xs">
                  {[
                    { label: 'รถยนต์ (คัน)',      key: 'car'        as const },
                    { label: 'มอเตอร์ไซค์ (คัน)', key: 'motorcycle' as const },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1.5">{label}</label>
                      <input
                        type="number" min={1}
                        value={settings.capacity[key]}
                        onChange={e => setSettings(s => s ? ({ ...s, capacity: { ...s.capacity, [key]: +e.target.value } }) : s)}
                        className="w-full h-10 px-3 rounded-lg text-sm font-black text-slate-800 outline-none"
                        style={{ border: '1.5px solid #E8ECF4', background: '#FAFBFF' }}
                        onFocus={e => e.currentTarget.style.borderColor = '#6D28D9'}
                        onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'} />
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[10px] text-slate-400">
                  รวมทั้งหมด: <span className="font-black text-slate-600">{(settings.capacity.car + settings.capacity.motorcycle).toLocaleString()} คัน</span>
                </p>
              </div>
            </div>

            {/* Rates */}
            <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
              <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #E8ECF4', background: '#FAFBFF' }}>
                <div className="size-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(5,150,105,0.08)' }}>
                  <BadgeDollarSign className="size-4" style={{ color: '#059669' }} />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">อัตราค่าบริการ</p>
                  <p className="text-[10px] text-slate-400">กำหนดราคาต่อชั่วโมง · เศษปัดขึ้น 1 ชั่วโมง</p>
                </div>
              </div>
              <div className="p-5 space-y-3">
                {/* Car */}
                <div className="rounded-lg p-4" style={{ background: '#F8FAFF', border: '1px solid rgba(29,78,216,0.1)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Car className="size-4" style={{ color: '#1D4ED8' }} />
                    <p className="text-xs font-black text-slate-800">รถยนต์ (Car)</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 max-w-xs">
                    {[
                      { label: 'ชั่วโมงแรก (฿)', val: settings.rates.car.firstHour, cb: (v: number) => setSettings(s => s ? ({...s, rates: {...s.rates, car: {...s.rates.car, firstHour: v}}}) : s) },
                      { label: 'ชั่วโมงถัดไป (฿)', val: settings.rates.car.extraHour, cb: (v: number) => setSettings(s => s ? ({...s, rates: {...s.rates, car: {...s.rates.car, extraHour: v}}}) : s) },
                    ].map(f => (
                      <div key={f.label}>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">{f.label}</label>
                        <input type="number" value={f.val} onChange={e => f.cb(+e.target.value)}
                          className="w-full h-9 px-3 rounded-lg text-sm font-black text-slate-800 outline-none"
                          style={{ border: '1.5px solid #E8ECF4', background: 'white' }} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Motorcycle */}
                <div className="rounded-lg p-4" style={{ background: '#F8FAFF', border: '1px solid rgba(8,145,178,0.1)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Bike className="size-4" style={{ color: '#0891B2' }} />
                    <p className="text-xs font-black text-slate-800">มอเตอร์ไซค์ (Motorcycle)</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 max-w-xs">
                    {[
                      { label: 'ชั่วโมงแรก (฿)', val: settings.rates.motorcycle.firstHour, cb: (v: number) => setSettings(s => s ? ({...s, rates: {...s.rates, motorcycle: {...s.rates.motorcycle, firstHour: v}}}) : s) },
                      { label: 'ชั่วโมงถัดไป (฿)', val: settings.rates.motorcycle.extraHour, cb: (v: number) => setSettings(s => s ? ({...s, rates: {...s.rates, motorcycle: {...s.rates.motorcycle, extraHour: v}}}) : s) },
                    ].map(f => (
                      <div key={f.label}>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">{f.label}</label>
                        <input type="number" value={f.val} onChange={e => f.cb(+e.target.value)}
                          className="w-full h-9 px-3 rounded-lg text-sm font-black text-slate-800 outline-none"
                          style={{ border: '1.5px solid #E8ECF4', background: 'white' }} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Overnight */}
                <div className="rounded-lg p-4" style={{ background: '#F8FAFF', border: '1px solid rgba(124,58,237,0.1)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Moon className="size-4" style={{ color: '#7C3AED' }} />
                    <p className="text-xs font-black text-slate-800">
                      ค้างคืน (Overnight) — เหมาจ่าย {settings.rates.overnight.windowStart}–{settings.rates.overnight.windowEnd}
                    </p>
                  </div>
                  {/* ช่วงเวลา overnight */}
                  <div className="grid grid-cols-2 gap-3 max-w-xs mb-3">
                    {[
                      { label: 'เริ่มช่วงกลางคืน', key: 'windowStart' as const },
                      { label: 'สิ้นสุดช่วงกลางคืน', key: 'windowEnd'   as const },
                    ].map(({ label, key }) => (
                      <div key={key}>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">{label}</label>
                        <input type="time"
                          value={settings.rates.overnight[key]}
                          onChange={e => setSettings(s => s ? ({...s, rates: {...s.rates, overnight: {...s.rates.overnight, [key]: e.target.value}}}) : s)}
                          className="w-full h-9 px-3 rounded-lg text-sm font-black text-slate-800 outline-none"
                          style={{ border: '1.5px solid #E8ECF4', background: 'white' }}
                          onFocus={e => e.currentTarget.style.borderColor = '#7C3AED'}
                          onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'} />
                      </div>
                    ))}
                  </div>
                  {/* อัตรา */}
                  <div className="grid grid-cols-2 gap-3 max-w-xs">
                    {[
                      { label: 'ราคาเหมาจ่าย (฿)', val: settings.rates.overnight.flatRate,  cb: (v: number) => setSettings(s => s ? ({...s, rates: {...s.rates, overnight: {...s.rates.overnight, flatRate: v}}}) : s) },
                      { label: 'นอกช่วง (฿/ชม.)',   val: settings.rates.overnight.extraHour, cb: (v: number) => setSettings(s => s ? ({...s, rates: {...s.rates, overnight: {...s.rates.overnight, extraHour: v}}}) : s) },
                    ].map(f => (
                      <div key={f.label}>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">{f.label}</label>
                        <input type="number" value={f.val} onChange={e => f.cb(+e.target.value)}
                          className="w-full h-9 px-3 rounded-lg text-sm font-black text-slate-800 outline-none"
                          style={{ border: '1.5px solid #E8ECF4', background: 'white' }} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lost card fine */}
                <div className="flex items-center gap-4 px-4 py-3.5 rounded-lg"
                  style={{ background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.12)' }}>
                  <AlertOctagon className="size-4 shrink-0" style={{ color: '#DC2626' }} />
                  <div className="flex-1">
                    <p className="text-xs font-black text-slate-800">ค่าปรับบัตรหาย (฿)</p>
                    <p className="text-[10px] text-slate-400">คิดเพิ่มจากค่าจอดรถปกติ</p>
                  </div>
                  <input type="number" value={settings.lostCardFine}
                    onChange={e => setSettings(s => s ? ({ ...s, lostCardFine: +e.target.value }) : s)}
                    className="w-24 h-9 px-3 rounded-lg text-sm font-black text-slate-800 outline-none text-center"
                    style={{ border: '1.5px solid rgba(220,38,38,0.2)', background: 'white' }} />
                </div>
              </div>
            </div>
            {/* Danger Zone */}
            <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1.5px solid rgba(220,38,38,0.25)' }}>
              <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(220,38,38,0.12)', background: 'rgba(220,38,38,0.03)' }}>
                <div className="size-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.08)' }}>
                  <Trash2 className="size-4" style={{ color: '#DC2626' }} />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">โซนอันตราย</p>
                  <p className="text-[10px] text-slate-400">การกระทำที่ไม่สามารถย้อนกลับได้</p>
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between p-4 rounded-lg" style={{ background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.12)' }}>
                  <div>
                    <p className="text-xs font-black text-slate-800">ลบข้อมูลทั้งหมด</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">ลบ Sessions, บัตร, คิว, กะ, ส่วนลด, Logs ทั้งหมด · ข้อมูลผู้ดูแลและการตั้งค่าจะยังคงอยู่</p>
                  </div>
                  <button
                    onClick={() => { setShowResetConfirm(true); setConfirmText('') }}
                    className="h-8 px-4 rounded-lg text-white text-xs font-bold flex items-center gap-1.5 hover:opacity-90 shrink-0 ml-4"
                    style={{ background: '#DC2626' }}>
                    <Trash2 className="size-3.5" />
                    ลบข้อมูลทั้งหมด
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ══ HARDWARE TAB ══ */}
        {tab === 'hardware' && (
          <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
            <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #E8ECF4', background: '#FAFBFF' }}>
              <div className="size-8 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(99,102,241,0.08)' }}>
                <Cpu className="size-4" style={{ color: '#6366F1' }} />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900">ฮาร์ดแวร์ (Hardware Integration)</p>
                <p className="text-[10px] text-slate-400">กำหนด IP:Port และ Endpoint ของอุปกรณ์แต่ละตัว</p>
              </div>
            </div>
            <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
              {(Object.entries(HW_META) as [keyof typeof HW_META, typeof HW_META[keyof typeof HW_META]][]).map(([key, meta]) => {
                const device = settings.hardware[key]
                const Icon = meta.icon
                const testRes = testResult[key]
                return (
                  <div key={key} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-lg flex items-center justify-center"
                          style={{ background: device.enabled ? 'rgba(99,102,241,0.08)' : '#F1F5F9' }}>
                          <Icon className="size-4" style={{ color: device.enabled ? '#6366F1' : '#94A3B8' }} strokeWidth={1.75} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-800">{meta.label}</p>
                          <p className="text-[10px] text-slate-400">{meta.desc}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {testRes === true  && <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: '#059669' }}><Wifi className="size-3" />OK</span>}
                        {testRes === false && <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: '#DC2626' }}><WifiOff className="size-3" />Fail</span>}
                        {key !== 'reader' && (
                          <button onClick={() => testHardware(key)} disabled={testing === key || !device.enabled}
                            className="h-7 px-2.5 rounded-lg text-[10px] font-bold flex items-center gap-1 disabled:opacity-40"
                            style={{ background: 'rgba(99,102,241,0.08)', color: '#6366F1' }}>
                            {testing === key ? <RefreshCw className="size-3 animate-spin" /> : <Play className="size-3" />}
                            Test
                          </button>
                        )}
                        <button onClick={() => updateHW(key, 'enabled', !device.enabled)}
                          className="w-9 h-5 rounded-full relative transition-colors"
                          style={{ background: device.enabled ? '#1D4ED8' : '#E2E8F0' }}>
                          <span className="absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform"
                            style={{ transform: device.enabled ? 'translateX(20px)' : 'translateX(2px)' }} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 ml-11">
                      <div className="col-span-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">IP Address</label>
                        <input value={device.ip} onChange={e => updateHW(key, 'ip', e.target.value)}
                          placeholder="192.168.1.100"
                          className="w-full h-8 px-2.5 rounded-lg text-xs font-mono text-slate-700 outline-none"
                          style={{ border: '1.5px solid #E8ECF4', background: '#FAFBFF' }}
                          onFocus={e => e.currentTarget.style.borderColor = '#6366F1'}
                          onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'} />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Port</label>
                        <input type="number" value={device.port} onChange={e => updateHW(key, 'port', +e.target.value)}
                          placeholder="80"
                          className="w-full h-8 px-2.5 rounded-lg text-xs font-mono text-slate-700 outline-none"
                          style={{ border: '1.5px solid #E8ECF4', background: '#FAFBFF' }}
                          onFocus={e => e.currentTarget.style.borderColor = '#6366F1'}
                          onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'} />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Endpoint</label>
                        <input value={device.endpoint} onChange={e => updateHW(key, 'endpoint', e.target.value)}
                          placeholder="/trigger"
                          className="w-full h-8 px-2.5 rounded-lg text-xs font-mono text-slate-700 outline-none"
                          style={{ border: '1.5px solid #E8ECF4', background: '#FAFBFF' }}
                          onFocus={e => e.currentTarget.style.borderColor = '#6366F1'}
                          onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>

      {/* ── RESET CONFIRM DIALOG ── */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
            <div className="px-6 py-5 flex items-center gap-3" style={{ borderBottom: '1px solid #E8ECF4', background: 'rgba(220,38,38,0.03)' }}>
              <div className="size-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(220,38,38,0.1)' }}>
                <Trash2 className="size-4.5" style={{ color: '#DC2626' }} />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900">ยืนยันการลบข้อมูลทั้งหมด</p>
                <p className="text-[10px] text-slate-400">การกระทำนี้ไม่สามารถย้อนกลับได้</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-lg p-3 text-[11px] text-slate-600 space-y-1" style={{ background: '#FFF7F7', border: '1px solid rgba(220,38,38,0.12)' }}>
                <p className="font-bold text-red-700">ข้อมูลที่จะถูกลบ:</p>
                <p>• Sessions การจอดรถทั้งหมด</p>
                <p>• บัตรจอดรถทั้งหมด</p>
                <p>• คิวรอทั้งหมด</p>
                <p>• กะการทำงานทั้งหมด</p>
                <p>• ส่วนลดทั้งหมด</p>
                <p>• Hardware Logs ทั้งหมด</p>
              </div>
              <div className="rounded-lg p-3 text-[11px] text-slate-600" style={{ background: '#F0FDF4', border: '1px solid rgba(5,150,105,0.15)' }}>
                <p className="font-bold text-green-700">ข้อมูลที่จะยังคงอยู่:</p>
                <p>• บัญชีผู้ดูแลระบบ (Admin)</p>
                <p>• การตั้งค่าระบบทั้งหมด</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1.5">
                  พิมพ์ <span className="text-red-600 font-black">ลบข้อมูล</span> เพื่อยืนยัน
                </label>
                <input
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="ลบข้อมูล"
                  className="w-full h-10 px-3 rounded-lg text-sm text-slate-800 outline-none"
                  style={{ border: '1.5px solid #E8ECF4', background: '#FAFBFF' }}
                  onFocus={e => e.currentTarget.style.borderColor = '#DC2626'}
                  onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'} />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button
                onClick={() => { setShowResetConfirm(false); setConfirmText('') }}
                className="flex-1 h-10 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50"
                style={{ border: '1.5px solid #E8ECF4' }}>
                ยกเลิก
              </button>
              <button
                onClick={handleReset}
                disabled={confirmText !== 'ลบข้อมูล' || resetting}
                className="flex-1 h-10 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-1.5 disabled:opacity-40 hover:opacity-90"
                style={{ background: '#DC2626' }}>
                {resetting ? <RefreshCw className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                {resetting ? 'กำลังลบ...' : 'ยืนยันลบข้อมูล'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
