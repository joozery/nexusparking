'use client'

import { type HardwareStatus } from '@/components/parking/types'
import { ParkingSidebar } from '@/components/parking/ParkingSidebar'
import { ToastProvider } from '@/components/ui/Toast'

const HARDWARE: Record<string, HardwareStatus> = {
  camera:  'online',
  barrier: 'online',
  reader:  'online',
  printer: 'busy',
  drawer:  'online',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden" style={{ background: '#FFFFFF' }}>
        <ParkingSidebar isOpen hardware={HARDWARE} />
        <div className="flex-1 flex flex-col overflow-hidden bg-[#F0F2F8]">
          {children}
        </div>
      </div>
    </ToastProvider>
  )
}
