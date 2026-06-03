import { Outlet } from 'react-router-dom'
import Header from './Header'
import BottomNav from './BottomNav'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import ToastContainer from '@/components/ui/ToastContainer'

export default function AppShell() {
  return (
    <div className="flex flex-col h-screen glass-ambient transition-colors theme-bg">
      <Header />
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>
      <BottomNav />
      <ToastContainer />
      <ConfirmDialog />
    </div>
  )
}
