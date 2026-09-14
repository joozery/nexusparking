'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings, Clock, Cpu, MessageCircle } from 'lucide-react'

const TABS = [
  { label: 'ทั่วไป',          icon: Clock,          href: '/settings/general'  },
  { label: 'ฮาร์ดแวร์',       icon: Cpu,            href: '/settings/hardware' },
  { label: 'LINE แจ้งเตือน',  icon: MessageCircle,  href: '/settings/line'     },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <>
      <header className="shrink-0 h-14 bg-white flex items-center px-6"
        style={{ borderBottom: '1px solid #E8ECF4' }}>
        <div className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded-lg"
            style={{ background: 'rgba(161,98,7,0.08)' }}>
            <Settings className="size-3.5" style={{ color: '#A16207' }} />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 leading-none">ตั้งค่าระบบ</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">การกำหนดค่าและฮาร์ดแวร์</p>
          </div>
        </div>
      </header>

      <div className="shrink-0 px-5 pt-4 pb-0 bg-white" style={{ borderBottom: '1px solid #E8ECF4' }}>
        <div className="flex items-center gap-1">
          {TABS.map(t => {
            const active = pathname.startsWith(t.href)
            const Icon = t.icon
            return (
              <Link key={t.href} href={t.href}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all relative"
                style={{ color: active ? '#A16207' : '#94A3B8', background: active ? '#F0F2F8' : 'transparent' }}>
                <Icon className="size-3.5" />
                {t.label}
                {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: '#EAB308' }} />}
              </Link>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </>
  )
}
