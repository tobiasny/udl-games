import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Trophy, Users, Gamepad2, LogIn, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function Header() {
  const { isAdmin, logout } = useAuth()
  const location = useLocation()

  const navItems = [
    { to: '/', label: 'Leaderboard', icon: Trophy },
    ...(isAdmin
      ? [
          { to: '/admin/activities', label: 'Activities', icon: Gamepad2 },
          { to: '/admin/contestants', label: 'Players', icon: Users },
        ]
      : []),
  ]

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 max-w-lg">
        <div className="flex h-14 items-center justify-between">
          <nav className="flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'gap-1.5',
                    location.pathname === to && 'bg-accent'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </Button>
              </Link>
            ))}
          </nav>
          <div>
            {isAdmin ? (
              <Button variant="ghost" size="sm" onClick={logout} className="gap-1.5">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            ) : (
              <Link to="/login">
                <Button variant="ghost" size="sm" className="gap-1.5">
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
