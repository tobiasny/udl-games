import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Trophy, Users, Gamepad2, LogIn, LogOut, Settings, Eye, History, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function Header() {
  const { isAdmin, logout } = useAuth()
  const location = useLocation()

  const publicNav = [
    { to: '/', label: 'Resultater', icon: Trophy },
    { to: '/activities', label: 'Aktiviteter', icon: History },
  ]

  const adminNav = [
    { to: '/admin/activities', label: 'Admin', icon: Gamepad2 },
    { to: '/admin/events', label: 'Events', icon: Sparkles },
    { to: '/admin/contestants', label: 'Deltakere', icon: Users },
    { to: '/admin/rebus', label: 'Rebus', icon: Settings },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="flex h-14 items-center justify-between">
          <nav className="flex items-center gap-0.5">
            <Link to="/" className="flex items-center gap-1.5 mr-3 hover:opacity-80 transition-opacity">
              <span className="font-display text-lg tracking-widest">MG</span>
            </Link>
            {publicNav.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to
              return (
                <Link key={to} to={to}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'gap-1.5 relative',
                      active && 'text-primary'
                    )}
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
              const active = location.pathname === to
              return (
                <Link key={to} to={to}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'gap-1.5 relative',
                      active && 'text-primary'
                    )}
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
            {isAdmin && (
              <Link to="/rebus/run" target="_blank">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-primary" title="Åpne rebus-visning (ny fane)">
                  <Eye className="h-4 w-4" />
                  <span className="hidden sm:inline">Rebus-vis</span>
                </Button>
              </Link>
            )}
          </nav>
          <div>
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
  )
}
