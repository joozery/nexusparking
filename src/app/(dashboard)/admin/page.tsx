'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Users, UserPlus, Shield, Eye, EyeOff, Trash2,
  RefreshCw, Crown, User, Edit2, X, KeyRound, CheckCircle2,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface AdminUser {
  _id:         string
  username:    string
  name:        string
  role:        'superadmin' | 'admin' | 'operator'
  isActive:    boolean
  lastLoginAt: string | null
  createdAt:   string
}

interface Me { sub: string; name: string; role: string }

const ROLE_META = {
  superadmin: { label: 'Super Admin', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  icon: Crown },
  admin:      { label: 'Admin',       color: '#1D4ED8', bg: 'rgba(29,78,216,0.08)',  icon: Shield },
  operator:   { label: 'Operator',    color: '#64748B', bg: 'rgba(100,116,139,0.08)', icon: User   },
}

function timeAgo(iso: string | null) {
  if (!iso) return 'ยังไม่เคย'
  const d = (Date.now() - new Date(iso).getTime()) / 1000
  if (d < 60) return 'เมื่อกี้'
  if (d < 3600) return `${Math.floor(d/60)} นาทีที่แล้ว`
  if (d < 86400) return `${Math.floor(d/3600)} ชม.ที่แล้ว`
  return `${Math.floor(d/86400)} วันที่แล้ว`
}

export default function AdminPage() {
  const { success, error: toastError, info } = useToast()
  const [me,      setMe]      = useState<Me | null>(null)
  const [admins,  setAdmins]  = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [newName,    setNewName]    = useState('')
  const [newUser,    setNewUser]    = useState('')
  const [newPwd,     setNewPwd]     = useState('')
  const [showNewPwd, setShowNewPwd] = useState(false)
  const [newRole,    setNewRole]    = useState<'admin' | 'operator'>('operator')
  const [creating,   setCreating]   = useState(false)

  // Edit modal
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null)
  const [editPwd,    setEditPwd]    = useState('')
  const [showEditPwd, setShowEditPwd] = useState(false)
  const [saving,     setSaving]     = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [meRes, adminsRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/admin'),
      ])
      if (meRes.ok)     setMe(await meRes.json())
      if (adminsRes.ok) setAdmins(await adminsRes.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUser, password: newPwd, name: newName, role: newRole }),
      })
      if (res.ok) {
        success('สร้างบัญชีสำเร็จ', `@${newUser}`)
        setShowCreate(false); setNewName(''); setNewUser(''); setNewPwd('')
        fetchAll()
      } else {
        const d = await res.json()
        toastError('สร้างบัญชีไม่สำเร็จ', d.error ?? 'เกิดข้อผิดพลาด')
      }
    } finally {
      setCreating(false)
    }
  }

  async function handleToggleActive(admin: AdminUser) {
    const res = await fetch(`/api/admin/${admin._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !admin.isActive }),
    })
    if (res.ok) { info(admin.isActive ? 'ปิดใช้งานบัญชีแล้ว' : 'เปิดใช้งานบัญชีแล้ว', admin.name); fetchAll() }
    else toastError('เกิดข้อผิดพลาด', 'ไม่สามารถเปลี่ยนสถานะได้')
  }

  async function handleDelete(admin: AdminUser) {
    if (!confirm(`ลบบัญชี "${admin.name}" ใช่ไหม?`)) return
    const res = await fetch(`/api/admin/${admin._id}`, { method: 'DELETE' })
    if (res.ok) { success('ลบบัญชีแล้ว', admin.name); fetchAll() }
    else { const d = await res.json(); toastError('ลบไม่สำเร็จ', d.error ?? 'กรุณาลองใหม่') }
  }

  async function handleSaveEdit() {
    if (!editTarget) return
    setSaving(true)
    const body: Record<string, string> = { role: editTarget.role }
    if (editPwd) body.password = editPwd
    const res = await fetch(`/api/admin/${editTarget._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) { success('บันทึกแล้ว', editTarget.name); setEditTarget(null); setEditPwd(''); fetchAll() }
    else toastError('บันทึกไม่สำเร็จ', 'กรุณาลองใหม่อีกครั้ง')
    setSaving(false)
  }

  const isSuperadmin = me?.role === 'superadmin'

  return (
    <>
      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={e => { if (e.target === e.currentTarget) setEditTarget(null) }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" style={{ border: '1px solid #E8ECF4' }}>
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-black text-slate-900">แก้ไขบัญชี</p>
              <button onClick={() => setEditTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="px-3 py-2.5 rounded-xl" style={{ background: '#F8FAFF', border: '1px solid #E8ECF4' }}>
                <p className="text-xs font-black text-slate-700">{editTarget.name}</p>
                <p className="text-[10px] text-slate-400">@{editTarget.username}</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1.5">Role</label>
                <select value={editTarget.role}
                  onChange={e => setEditTarget(t => t ? ({ ...t, role: e.target.value as AdminUser['role'] }) : t)}
                  className="w-full h-9 px-3 rounded-xl text-sm text-slate-800 outline-none"
                  style={{ border: '1.5px solid #E8ECF4', background: '#FAFBFF' }}>
                  <option value="operator">Operator</option>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1.5">รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                  <input type={showEditPwd ? 'text' : 'password'} value={editPwd}
                    onChange={e => setEditPwd(e.target.value)}
                    placeholder="รหัสผ่านใหม่"
                    className="w-full h-9 pl-8 pr-9 rounded-xl text-sm text-slate-800 outline-none"
                    style={{ border: '1.5px solid #E8ECF4', background: '#FAFBFF' }} />
                  <button type="button" onClick={() => setShowEditPwd(s => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                    {showEditPwd ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditTarget(null)}
                className="flex-1 h-9 rounded-xl text-xs font-bold text-slate-600"
                style={{ background: '#F1F5F9' }}>
                ยกเลิก
              </button>
              <button onClick={handleSaveEdit} disabled={saving}
                className="flex-1 h-9 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 disabled:opacity-60"
                style={{ background: '#1D4ED8', boxShadow: '0 1px 8px rgba(29,78,216,0.3)' }}>
                {saving ? <RefreshCw className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="shrink-0 h-14 bg-white flex items-center justify-between px-6"
        style={{ borderBottom: '1px solid #E8ECF4' }}>
        <div className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded-lg"
            style={{ background: 'rgba(245,158,11,0.1)' }}>
            <Users className="size-3.5" style={{ color: '#F59E0B' }} />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 leading-none">จัดการแอดมิน</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">{admins.length} บัญชีในระบบ</p>
          </div>
        </div>
        {isSuperadmin && (
          <button onClick={() => setShowCreate(s => !s)}
            className="h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 text-white transition-opacity hover:opacity-90"
            style={{ background: '#1D4ED8', boxShadow: '0 1px 8px rgba(29,78,216,0.35)' }}>
            {showCreate ? <X className="size-3.5" /> : <UserPlus className="size-3.5" />}
            {showCreate ? 'ยกเลิก' : 'เพิ่มแอดมิน'}
          </button>
        )}
      </header>

      <div className="flex-1 overflow-auto p-5 space-y-4">

        {/* Create form */}
        {showCreate && isSuperadmin && (
          <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid rgba(29,78,216,0.2)', boxShadow: '0 2px 12px rgba(29,78,216,0.06)' }}>
            <p className="text-xs font-black text-slate-900 mb-4">สร้างบัญชีใหม่</p>
            <form onSubmit={handleCreate}>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">ชื่อ-นามสกุล</label>
                  <input value={newName} onChange={e => setNewName(e.target.value)} required
                    placeholder="ชื่อ นามสกุล"
                    className="w-full h-9 px-3 rounded-xl text-sm text-slate-800 outline-none"
                    style={{ border: '1.5px solid #E8ECF4', background: '#FAFBFF' }} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Role</label>
                  <select value={newRole} onChange={e => setNewRole(e.target.value as 'admin' | 'operator')}
                    className="w-full h-9 px-3 rounded-xl text-sm text-slate-800 outline-none"
                    style={{ border: '1.5px solid #E8ECF4', background: '#FAFBFF' }}>
                    <option value="operator">Operator</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Username</label>
                  <input value={newUser} onChange={e => setNewUser(e.target.value)} required
                    placeholder="username"
                    className="w-full h-9 px-3 rounded-xl text-sm text-slate-800 outline-none font-mono"
                    style={{ border: '1.5px solid #E8ECF4', background: '#FAFBFF' }} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Password</label>
                  <div className="relative">
                    <input type={showNewPwd ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)} required
                      placeholder="รหัสผ่าน"
                      className="w-full h-9 px-3 pr-8 rounded-xl text-sm text-slate-800 outline-none"
                      style={{ border: '1.5px solid #E8ECF4', background: '#FAFBFF' }} />
                    <button type="button" onClick={() => setShowNewPwd(s => !s)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                      {showNewPwd ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={creating}
                  className="h-8 px-4 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 disabled:opacity-60"
                  style={{ background: '#1D4ED8' }}>
                  {creating ? <RefreshCw className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
                  สร้างบัญชี
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Current user card */}
        {me && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{ background: 'rgba(29,78,216,0.04)', border: '1px solid rgba(29,78,216,0.12)' }}>
            <div className="size-7 flex items-center justify-center rounded-lg text-[10px] font-black text-white"
              style={{ background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)' }}>
              {me.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-xs font-black text-slate-800">{me.name}</p>
              <p className="text-[10px] text-slate-400">เซสชันปัจจุบัน · {ROLE_META[me.role as keyof typeof ROLE_META]?.label ?? me.role}</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(29,78,216,0.1)', color: '#1D4ED8' }}>
              You
            </span>
          </div>
        )}

        {/* Admin list */}
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="size-5 text-slate-300 animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {admins.map(admin => {
              const meta = ROLE_META[admin.role]
              const RoleIcon = meta.icon
              const isMe = admin._id === me?.sub
              return (
                <div key={admin._id}
                  className="bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3"
                  style={{ border: `1px solid ${isMe ? 'rgba(29,78,216,0.15)' : '#E8ECF4'}`, opacity: admin.isActive ? 1 : 0.55 }}>

                  {/* Avatar */}
                  <div className="size-9 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0"
                    style={{ background: admin.isActive ? `linear-gradient(135deg, ${meta.color}, ${meta.color}99)` : '#CBD5E1' }}>
                    {admin.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-black text-slate-800 truncate">{admin.name}</p>
                      {isMe && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md"
                        style={{ background: 'rgba(29,78,216,0.1)', color: '#1D4ED8' }}>YOU</span>}
                      {!admin.isActive && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md"
                        style={{ background: '#F1F5F9', color: '#94A3B8' }}>INACTIVE</span>}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono">@{admin.username}</p>
                  </div>

                  {/* Role badge */}
                  <span className="flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg shrink-0"
                    style={{ background: meta.bg, color: meta.color }}>
                    <RoleIcon className="size-3" />
                    {meta.label}
                  </span>

                  {/* Last login */}
                  <div className="hidden sm:block text-right shrink-0 w-24">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Last Login</p>
                    <p className="text-[10px] font-bold text-slate-600">{timeAgo(admin.lastLoginAt)}</p>
                  </div>

                  {/* Actions */}
                  {isSuperadmin && !isMe && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => { setEditTarget(admin); setEditPwd('') }}
                        className="size-7 flex items-center justify-center rounded-lg transition-colors hover:bg-blue-50"
                        style={{ color: '#1D4ED8' }}>
                        <Edit2 className="size-3.5" />
                      </button>
                      <button onClick={() => handleToggleActive(admin)}
                        className="size-7 flex items-center justify-center rounded-lg transition-colors hover:bg-slate-50"
                        style={{ color: admin.isActive ? '#059669' : '#94A3B8' }}>
                        <Shield className="size-3.5" />
                      </button>
                      <button onClick={() => handleDelete(admin)}
                        className="size-7 flex items-center justify-center rounded-lg transition-colors hover:bg-red-50"
                        style={{ color: '#DC2626' }}>
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      </div>
    </>
  )
}
