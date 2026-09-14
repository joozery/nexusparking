'use client'

import { useEffect, useState } from 'react'
import {
  Save, RefreshCw, Wifi, WifiOff,
  Camera, Shield, CreditCard, Printer, Banknote, Play, Cpu,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface HWDevice        { ip: string; port: number; endpoint: string; enabled: boolean }
interface CaptureCamDevice { ip: string; port: number; user: string; pass: string; enabled: boolean }
interface HardwareSettings {
  hardware: {
    camera:      HWDevice
    barrier:     HWDevice
    reader:      HWDevice
    printer:     HWDevice
    drawer:      HWDevice
    cameraEntry: CaptureCamDevice
    cameraExit:  CaptureCamDevice
  }
}

const HW_META = {
  camera:  { label: 'กล้องวงจรปิด',        icon: Camera,     desc: 'ถ่าย Snapshot อัตโนมัติ' },
  barrier: { label: 'ไม้กั้นรถยนต์',       icon: Shield,     desc: 'เปิดหลังขาเข้า/ขาออก'   },
  reader:  { label: 'เครื่องอ่านบัตร',      icon: CreditCard, desc: 'Passive — อ่าน UID'      },
  printer: { label: 'เครื่องพิมพ์ใบเสร็จ', icon: Printer,    desc: 'พิมพ์ใบเสร็จ'             },
  drawer:  { label: 'ลิ้นชักเก็บเงิน',      icon: Banknote,   desc: 'เด้งหลังขาออก'           },
}

const CAPTURE_CAM_META = {
  cameraEntry: { label: 'กล้องหน้าคนขับ — ขาเข้า', icon: Camera, desc: 'แคป Snapshot ตอน checkin (ISAPI + Digest Auth)' },
  cameraExit:  { label: 'กล้องหน้าคนขับ — ขาออก',  icon: Camera, desc: 'แคป Snapshot ตอน checkout (ISAPI + Digest Auth)' },
}

export default function HardwareSettingsPage() {
  const { success, error: toastError } = useToast()
  const [settings, setSettings] = useState<HardwareSettings | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [testing,  setTesting]  = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, boolean | null>>({})

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(setSettings)
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hardware: settings.hardware }),
      })
      res.ok ? success('บันทึกการตั้งค่าสำเร็จ') : toastError('บันทึกไม่สำเร็จ', 'กรุณาลองใหม่อีกครั้ง')
    } finally { setSaving(false) }
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

  function updateHW(device: keyof HardwareSettings['hardware'], field: string, value: string | number | boolean) {
    setSettings(s => s ? ({ ...s, hardware: { ...s.hardware, [device]: { ...s.hardware[device], [field]: value } } }) : s)
  }

  if (loading) return <div className="flex items-center justify-center p-10"><RefreshCw className="size-5 text-slate-300 animate-spin" /></div>
  if (!settings) return null

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

      {/* Hardware Devices */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #E8ECF4', background: '#FAFBFF' }}>
          <div className="size-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.08)' }}>
            <Cpu className="size-4" style={{ color: '#6366F1' }} />
          </div>
          <div>
            <p className="text-sm font-black text-slate-900">อุปกรณ์ฮาร์ดแวร์</p>
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
                      style={{ background: device.enabled ? '#EAB308' : '#E2E8F0' }}>
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

      {/* Capture Cameras */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #E8ECF4', background: '#FAFBFF' }}>
          <div className="size-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.08)' }}>
            <Camera className="size-4" style={{ color: '#DC2626' }} />
          </div>
          <div>
            <p className="text-sm font-black text-slate-900">กล้องแคป Snapshot (Checkin/Checkout)</p>
            <p className="text-[10px] text-slate-400">กล้อง Hikvision ISAPI — ต้องมี username/password ของกล้องจริง</p>
          </div>
        </div>
        <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
          {(Object.entries(CAPTURE_CAM_META) as [keyof typeof CAPTURE_CAM_META, typeof CAPTURE_CAM_META[keyof typeof CAPTURE_CAM_META]][]).map(([key, meta]) => {
            const device = settings.hardware[key]
            const Icon = meta.icon
            return (
              <div key={key} className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg flex items-center justify-center"
                      style={{ background: device.enabled ? 'rgba(220,38,38,0.08)' : '#F1F5F9' }}>
                      <Icon className="size-4" style={{ color: device.enabled ? '#DC2626' : '#94A3B8' }} strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800">{meta.label}</p>
                      <p className="text-[10px] text-slate-400">{meta.desc}</p>
                    </div>
                  </div>
                  <button onClick={() => updateHW(key, 'enabled', !device.enabled)}
                    className="w-9 h-5 rounded-full relative transition-colors"
                    style={{ background: device.enabled ? '#DC2626' : '#E2E8F0' }}>
                    <span className="absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform"
                      style={{ transform: device.enabled ? 'translateX(20px)' : 'translateX(2px)' }} />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2 ml-11">
                  {[
                    { label: 'IP Address', field: 'ip',   placeholder: '192.168.1.3', type: 'text'     },
                    { label: 'Port',       field: 'port', placeholder: '80',          type: 'number'   },
                    { label: 'Username',   field: 'user', placeholder: 'admin',       type: 'text'     },
                    { label: 'Password',   field: 'pass', placeholder: '••••••••',    type: 'password' },
                  ].map(({ label, field, placeholder, type }) => (
                    <div key={field}>
                      <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">{label}</label>
                      <input type={type}
                        value={(device as unknown as Record<string, string | number>)[field] as string}
                        onChange={e => updateHW(key, field, type === 'number' ? +e.target.value : e.target.value)}
                        placeholder={placeholder}
                        className="w-full h-8 px-2.5 rounded-lg text-xs font-mono text-slate-700 outline-none"
                        style={{ border: '1.5px solid #E8ECF4', background: '#FAFBFF' }}
                        onFocus={e => e.currentTarget.style.borderColor = '#DC2626'}
                        onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
