import { ToastProvider } from '@/components/ui/Toast'

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="h-screen overflow-hidden bg-[#F0F4FF]">
        {children}
      </div>
    </ToastProvider>
  )
}
