import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { FloatingAdminButtons } from './FloatingAdminButtons'

export function MainLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <Outlet />
      </main>
      <FloatingAdminButtons />
    </div>
  )
}
