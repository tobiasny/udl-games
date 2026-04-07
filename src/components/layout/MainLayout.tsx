import { Outlet } from 'react-router-dom'
import { Header } from './Header'

export function MainLayout() {
  return (
    <div className="bg-bubbles min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-2xl relative z-10">
        <Outlet />
      </main>
    </div>
  )
}
