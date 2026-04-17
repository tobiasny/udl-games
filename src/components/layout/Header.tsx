import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Trophy, Gamepad2, LogIn, LogOut, History, BarChart2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function Header() {
  const { isAdmin, logout } = useAuth()
  const location = useLocation()

  const publicNav = [
    { to: '/', label: 'Resultater', icon: Trophy },
    { to: '/activities', label: 'Aktiviteter', icon: History },
    { to: '/stats', label: 'Statistikk', icon: BarChart2 },
  ]

  const adminNav = [
    { to: '/admin', label: 'Admin', icon: Gamepad2 },
  ]

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="flex h-14 items-center justify-between">
            <nav className="flex items-center gap-0.5 overflow-x-auto">
              <Link to="/" className="flex items-center gap-1.5 mr-2 hover:opacity-80 transition-opacity shrink-0">
                <span className="font-display text-lg tracking-widest">MG</span>
              </Link>
              {publicNav.map(({ to, label, icon: Icon }) => {
                const active = location.pathname === to
                return (
                  <Link key={to} to={to} className="shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn('gap-1.5 relative', active && 'text-primary')}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{label}</span>
                      {active && (
                        <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
                      )}
                    </Button>
                  </Link>
                )
              })}
              {isAdmin && adminNav.map(({ to, label, icon: Icon }) => {
                const active = location.pathname.startsWith(to)
                return (
                  <Link key={to} to={to} className="shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn('gap-1.5 relative', active && 'text-primary')}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{label}</span>
                      {active && (
                        <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
                      )}
                    </Button>
                  </Link>
                )
              })}
            </nav>
            <div className="shrink-0">
              {isAdmin ? (
                <Button variant="ghost" size="sm" onClick={logout} className="gap-1.5 text-muted-foreground hover:text-foreground">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logg ut</span>
                </Button>
              ) : (
                <Link to="/login">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                    <LogIn className="h-4 w-4" />
                    <span className="hidden sm:inline">Admin</span>
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

    </>
  )
}
