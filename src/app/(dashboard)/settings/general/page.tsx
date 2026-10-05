'use client'

import { useEffect, useState } from 'react'
import {
  Save, RefreshCw, Car, Bike, Moon, AlertOctagon,
  ParkingSquare, Clock, BadgeDollarSign, Trash2,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface GeneralSettings {
  businessHours: { open: string; close: string }
  capacity: { car: number; motorcycle: number }
  rates: {
    car:        { firstHour: number; extraHour: number }
    motorcycle: { firstHour: number; extraHour: number }
    overnight:  { windowStart: string; windowEnd: string; flatRateStart?: string; car: { flatRate: number; extraHour: number }; motorcycle: { flatRate: number; extraHour: number }; flatRate?: number; extraHour?: number }
  }
  lostCardFine:   number
  monthlyDeposit: number
  monthlyFee:     number
}

function Time24Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [hour, minute] = value.split(':')
  return <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-white px-2 text-sm font-bold text-slate-800">
    <select aria-label={`${label} ชั่วโมง`} value={hour} onChange={e => onChange(`${e.target.value}:${minute}`)} className="min-w-0 flex-1 bg-transparent text-center outline-none">
      {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => <option key={h} value={h}>{h}</option>)}
    </select>
    <span aria-hidden="true">:</span>
    <select aria-label={`${label} นาที`} value={minute} onChange={e => onChange(`${hour}:${e.target.value}`)} className="min-w-0 flex-1 bg-transparent text-center outline-none">
      {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => <option key={m} value={m}>{m}</option>)}
    </select>
  </div>
}

export default function GeneralSettingsPage() {
  const { success, error: toastError } = useToast()
  const [settings, setSettings] = useState<GeneralSettings | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [confirmText, setConfirmText]           = useState('')
  const [resetting,   setResetting]             = useState(false)
  const [resetPreview, setResetPreview] = useState<{ count: number; token: string } | null>(null)

  function normalizeSettings(data: GeneralSettings): GeneralSettings {
    const legacy = data.rates.overnight
    const fallback = { flatRate: legacy.flatRate ?? 100, extraHour: legacy.extraHour ?? 20 }
    return {
      ...data,
      rates: {
        ...data.rates,
        overnight: { ...legacy, car: legacy.car ?? fallback, motorcycle: legacy.motorcycle ?? fallback },
      },
    }
  }

  async function previewReset() {
    setResetting(true)
    setResetPreview(null)
    setConfirmText('')
    try {
      const res = await fetch('/api/reset')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'ตรวจสอบรายการไม่สำเร็จ')
      setResetPreview(data)
      setShowResetConfirm(true)
    } catch (err) {
      toastError('ตรวจสอบรายการไม่สำเร็จ', err instanceof Error ? err.message : 'กรุณาลองใหม่')
    } finally { setResetting(false) }
  }

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(normalizeSettings)
      .then(setSettings)
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    if (!settings) return
    if (settings.capacity.car < 1 || settings.capacity.motorcycle < 1) {
      toastError('กรุณากรอกความจุลาน', 'ระบุจำนวนช่องรถยนต์และรถจักรยานยนต์อย่างน้อย 1 คัน')
      return
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(settings.rates.overnight.flatRateStart ?? '22:00')) {
      toastError('กรุณาระบุเวลาตัดรอบเหมาค้างคืนให้ถูกต้อง')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessHours:  settings.businessHours,
          capacity:       settings.capacity,
          rates:          settings.rates,
          lostCardFine:   settings.lostCardFine,
          monthlyDeposit: settings.monthlyDeposit,
          monthlyFee:     settings.monthlyFee,
        }),
      })
      res.ok ? success('บันทึกการตั้งค่าสำเร็จ') : toastError('บันทึกไม่สำเร็จ', 'กรุณาลองใหม่อีกครั้ง')
    } finally { setSaving(false) }
  }

  async function handleReset() {
    if (!resetPreview || confirmText !== 'ลบข้อมูล' || resetPreview.count === 0) return
    setResetting(true)
    try {
      const res = await fetch('/api/reset', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetPreview.token, confirmation: 'CLEAR_ALL_DATA' }),
      })
      const data = await res.json()
      if (res.ok) {
        setSettings(s => s ? { ...s, capacity: { car: 0, motorcycle: 0 } } : s)
        success('ล้างข้อมูลสำเร็จ', `ลบ ${data.deleted} รายการ กรุณากรอกความจุลานใหม่ก่อนใช้งานต่อ`)
        setShowResetConfirm(false)
        setConfirmText('')
      } else {
        toastError('ล้างประวัติไม่สำเร็จ', data.error ?? 'กรุณาลองใหม่อีกครั้ง')
      }
    } catch { toastError('ล้างประวัติไม่สำเร็จ', 'เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่') }
    finally { setResetting(false); setResetPreview(null); setShowResetConfirm(false) }
  }

  if (loading) return <div className="flex-1 flex items-center justify-center p-10"><RefreshCw className="size-5 text-slate-300 animate-spin" /></div>
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

      {/* Business Hours */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #E8ECF4', background: '#FAFBFF' }}>
          <div className="size-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(161,98,7,0.08)' }}>
            <Clock className="size-4" style={{ color: '#A16207' }} />
          </div>
          <div>
            <p className="text-sm font-black text-slate-900">เวลาทำการ</p>
            <p className="text-[10px] text-slate-400">ระบบจะบล็อกขาเข้านอกช่วงเวลานี้</p>
          </div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 gap-4 max-w-xs">
            {([['เปิดบริการ', 'open'], ['ปิดบริการ', 'close']] as const).map(([label, key]) => (
              <div key={key}>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1.5">{label}</label>
                <Time24Input label={label} value={settings.businessHours[key]}
                  onChange={value => setSettings(s => s ? ({ ...s, businessHours: { ...s.businessHours, [key]: value } }) : s)} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Capacity */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #E8ECF4', background: '#FAFBFF' }}>
          <div className="size-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(109,40,217,0.08)' }}>
            <ParkingSquare className="size-4" style={{ color: '#6D28D9' }} />
          </div>
          <div>
            <p className="text-sm font-black text-slate-900">ความจุลานจอด</p>
            <p className="text-[10px] text-slate-400">กำหนดจำนวนคันสูงสุดที่ลานรองรับได้แต่ละประเภท</p>
          </div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 gap-4 max-w-xs">
            {([['รถยนต์ (คัน)', 'car'], ['รถจักรยานยนต์ (คัน)', 'motorcycle']] as const).map(([label, key]) => (
              <div key={key}>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1.5">{label}</label>
                <input type="number" min={1} value={settings.capacity[key] || ''}
                  onChange={e => setSettings(s => s ? ({ ...s, capacity: { ...s.capacity, [key]: +e.target.value } }) : s)}
                  className="w-full h-10 px-3 rounded-lg text-sm font-black text-slate-800 outline-none"
                  style={{ border: '1.5px solid #E8ECF4', background: '#FAFBFF' }}
                  onFocus={e => e.currentTarget.style.borderColor = '#6D28D9'}
                  onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'} />
              </div>
            ))}
          </div>
          {(settings.capacity.car < 1 || settings.capacity.motorcycle < 1) && (
            <p className="mt-3 rounded-lg px-3 py-2 text-[11px] font-bold text-red-700" style={{ background: '#FFF7F7', border: '1px solid rgba(220,38,38,0.15)' }}>
              กรุณากรอกความจุลานรถยนต์และรถจักรยานยนต์ใหม่ หลังจากล้างข้อมูล
            </p>
          )}
          <p className="mt-3 text-[10px] text-slate-400">
            รวมทั้งหมด: <span className="font-black text-slate-600">{(settings.capacity.car + settings.capacity.motorcycle).toLocaleString()} คัน</span>
          </p>
        </div>
      </div>

      {/* Rates */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #E8ECF4', background: '#FAFBFF' }}>
          <div className="size-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(5,150,105,0.08)' }}>
            <BadgeDollarSign className="size-4" style={{ color: '#059669' }} />
          </div>
          <div>
            <p className="text-sm font-black text-slate-900">อัตราค่าบริการ</p>
            <p className="text-[10px] text-slate-400">กำหนดราคาต่อชั่วโมง · เศษปัดขึ้น 1 ชั่วโมง</p>
          </div>
        </div>
        <div className="p-5 space-y-3">
          {/* Car */}
          <div className="rounded-lg p-4" style={{ background: '#F8FAFF', border: '1px solid rgba(161,98,7,0.1)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Car className="size-4" style={{ color: '#A16207' }} />
              <p className="text-xs font-black text-slate-800">รถยนต์ (Car)</p>
            </div>
            <div className="grid grid-cols-2 gap-3 max-w-xs">
              {[
                { label: 'ชั่วโมงแรก (฿)',   val: settings.rates.car.firstHour, cb: (v: number) => setSettings(s => s ? ({ ...s, rates: { ...s.rates, car: { ...s.rates.car, firstHour: v } } }) : s) },
                { label: 'ชั่วโมงถัดไป (฿)', val: settings.rates.car.extraHour, cb: (v: number) => setSettings(s => s ? ({ ...s, rates: { ...s.rates, car: { ...s.rates.car, extraHour: v } } }) : s) },
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
              <p className="text-xs font-black text-slate-800">รถจักรยานยนต์ (Motorcycle)</p>
            </div>
            <div className="grid grid-cols-2 gap-3 max-w-xs">
              {[
                { label: 'ชั่วโมงแรก (฿)',   val: settings.rates.motorcycle.firstHour, cb: (v: number) => setSettings(s => s ? ({ ...s, rates: { ...s.rates, motorcycle: { ...s.rates.motorcycle, firstHour: v } } }) : s) },
                { label: 'ชั่วโมงถัดไป (฿)', val: settings.rates.motorcycle.extraHour, cb: (v: number) => setSettings(s => s ? ({ ...s, rates: { ...s.rates, motorcycle: { ...s.rates.motorcycle, extraHour: v } } }) : s) },
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-xl mb-3">
              {([['เริ่มช่วงกลางคืน', 'windowStart'], ['สิ้นสุดช่วงกลางคืน', 'windowEnd'], ['เวลาตัดรอบเหมาค้างคืน', 'flatRateStart']] as const).map(([label, key]) => (
                <div key={key}>
                  <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">{label}</label>
                  <Time24Input label={label} value={settings.rates.overnight[key] ?? '22:00'}
                    onChange={value => setSettings(s => s ? ({ ...s, rates: { ...s.rates, overnight: { ...s.rates.overnight, [key]: value } } }) : s)} />
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mb-3">รถที่เข้าก่อน {settings.rates.overnight.flatRateStart ?? '22:00'} และยังจอดหลังเวลานี้ จะคิดราคาเหมาในช่วงกลางคืน รถที่เข้าตั้งแต่เวลาตัดรอบจะคิดรายชั่วโมงสำหรับคืนนั้น</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
              {([
                ['รถยนต์', 'car'],
                ['รถจักรยานยนต์', 'motorcycle'],
              ] as const).map(([label, vehicle]) => (
                <div key={vehicle} className="rounded-lg p-3" style={{ background: 'white', border: '1px solid #E8ECF4' }}>
                  <p className="text-[10px] font-black text-slate-600 mb-2">{label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      ['เหมาจ่าย (฿)', 'flatRate'],
                      ['นอกช่วง (฿/ชม.)', 'extraHour'],
                    ] as const).map(([fieldLabel, field]) => (
                      <div key={field}>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">{fieldLabel}</label>
                        <input type="number" min={0} value={settings.rates.overnight[vehicle][field]}
                          onChange={e => setSettings(s => s ? ({ ...s, rates: { ...s.rates, overnight: { ...s.rates.overnight, [vehicle]: { ...s.rates.overnight[vehicle], [field]: +e.target.value } } } }) : s)}
                          className="w-full h-9 px-3 rounded-lg text-sm font-black text-slate-800 outline-none"
                          style={{ border: '1.5px solid #E8ECF4', background: 'white' }} />
                      </div>
                    ))}
                  </div>
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

          {/* Monthly card fees */}
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(124,58,237,0.2)' }}>
            <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(124,58,237,0.06)', borderBottom: '1px solid rgba(124,58,237,0.12)' }}>
              <Moon className="size-4 shrink-0" style={{ color: '#7C3AED' }} />
              <div>
                <p className="text-xs font-black text-slate-800">บัตรรายเดือน</p>
                <p className="text-[10px] text-slate-400">เรียกเก็บตอนลงทะเบียนบัตรใหม่</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">ค่ามัดจำบัตร (฿)</label>
                <input type="number" min={0} value={settings.monthlyDeposit ?? 500}
                  onChange={e => setSettings(s => s ? ({ ...s, monthlyDeposit: +e.target.value }) : s)}
                  className="w-full h-9 px-3 rounded-lg text-sm font-black text-slate-800 outline-none text-center"
                  style={{ border: '1.5px solid rgba(124,58,237,0.25)', background: 'white' }} />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">ค่าบัตรรายเดือน (฿)</label>
                <input type="number" min={0} value={settings.monthlyFee ?? 300}
                  onChange={e => setSettings(s => s ? ({ ...s, monthlyFee: +e.target.value }) : s)}
                  className="w-full h-9 px-3 rounded-lg text-sm font-black text-slate-800 outline-none text-center"
                  style={{ border: '1.5px solid rgba(124,58,237,0.25)', background: 'white' }} />
              </div>
            </div>
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
              <p className="text-xs font-black text-slate-800">ล้างข้อมูลทั้งหมด</p>
              <p className="text-[10px] text-slate-400 mt-0.5">ล้างข้อมูลบัตร รถ คิว กะ ส่วนลด และค่าปรับทั้งหมด · เก็บบัญชีผู้ดูแล การตั้งค่าอื่น ๆ และ Hardware Logs ไว้</p>
            </div>
            <button onClick={previewReset} disabled={resetting}
              className="h-8 px-4 rounded-lg text-white text-xs font-bold flex items-center gap-1.5 hover:opacity-90 shrink-0 ml-4"
              style={{ background: '#DC2626' }}>
              <Trash2 className="size-3.5" />
              {resetting ? 'กำลังตรวจสอบ…' : 'ล้างข้อมูลทั้งหมด'}
            </button>
          </div>
        </div>
      </div>

      {/* Reset Confirm Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" style={{ border: '1px solid #E8ECF4' }}>
            <div className="px-6 py-5 flex items-center gap-3" style={{ borderBottom: '1px solid #E8ECF4', background: 'rgba(220,38,38,0.03)' }}>
              <div className="size-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(220,38,38,0.1)' }}>
                <Trash2 className="size-4.5" style={{ color: '#DC2626' }} />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900">ยืนยันล้างประวัติ {resetPreview?.count.toLocaleString()} รายการ</p>
                <p className="text-[10px] text-slate-400">การกระทำนี้ไม่สามารถย้อนกลับได้</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-lg p-3 text-[11px] text-slate-600 space-y-1" style={{ background: '#FFF7F7', border: '1px solid rgba(220,38,38,0.12)' }}>
                <p className="font-bold text-red-700">ข้อมูลที่จะถูกลบ:</p>
                <p>• บัตรที่ลงทะเบียน รถที่จอดอยู่ และคิวทั้งหมด</p>
                <p>• กะการทำงาน ข้อมูลคืนเงิน คูปอง ส่วนลด และค่าปรับทั้งหมด</p>
              </div>
              <div className="rounded-lg p-3 text-[11px] text-slate-600" style={{ background: '#F0FDF4', border: '1px solid rgba(5,150,105,0.15)' }}>
                <p className="font-bold text-green-700">ข้อมูลที่จะยังคงอยู่:</p>
                <p>• บัญชีผู้ดูแลระบบ (Admin)</p>
                <p>• การตั้งค่าระบบอื่น ๆ โดยความจุลานจะถูกรีเซ็ตให้กรอกใหม่</p>
                <p>• Hardware Logs</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1.5">
                  พิมพ์ <span className="text-red-600 font-black">ลบข้อมูล</span> เพื่อยืนยัน
                </label>
                <input value={confirmText} onChange={e => setConfirmText(e.target.value)}
                  placeholder="ลบข้อมูล"
                  className="w-full h-10 px-3 rounded-lg text-sm text-slate-800 outline-none"
                  style={{ border: '1.5px solid #E8ECF4', background: '#FAFBFF' }}
                  onFocus={e => e.currentTarget.style.borderColor = '#DC2626'}
                  onBlur={e => e.currentTarget.style.borderColor = '#E8ECF4'} />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button onClick={() => { setShowResetConfirm(false); setConfirmText('') }} disabled={resetting}
                className="flex-1 h-10 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50"
                style={{ border: '1.5px solid #E8ECF4' }}>
                ยกเลิก
              </button>
              <button onClick={handleReset} disabled={confirmText !== 'ลบข้อมูล' || resetting || !resetPreview?.count}
                className="flex-1 h-10 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-1.5 disabled:opacity-40 hover:opacity-90"
                style={{ background: '#DC2626' }}>
                {resetting ? <RefreshCw className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                {resetting ? 'กำลังลบ...' : 'ยืนยันลบข้อมูล'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
