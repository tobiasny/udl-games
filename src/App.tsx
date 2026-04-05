import { Routes, Route } from 'react-router-dom'
import { AuthContext, useAuthProvider } from '@/hooks/use-auth'
import { Header } from '@/components/layout/Header'
import { AdminGuard } from '@/components/layout/AdminGuard'
import { LeaderboardPage } from '@/pages/LeaderboardPage'
import { LoginPage } from '@/pages/LoginPage'
import { ActivitiesPage } from '@/pages/ActivitiesPage'
import { ActivityDetailPage } from '@/pages/ActivityDetailPage'
import { ContestantsPage } from '@/pages/ContestantsPage'
import { RebusPage } from '@/pages/RebusPage'
import { RebusAdminPage } from '@/pages/RebusAdminPage'

export default function App() {
  const auth = useAuthProvider()

  return (
    <AuthContext.Provider value={auth}>
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-6 max-w-lg">
          <Routes>
            <Route path="/" element={<LeaderboardPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/rebus" element={<RebusPage />} />
            <Route
              path="/admin/activities"
              element={<AdminGuard><ActivitiesPage /></AdminGuard>}
            />
            <Route
              path="/admin/activities/:id"
              element={<AdminGuard><ActivityDetailPage /></AdminGuard>}
            />
            <Route
              path="/admin/contestants"
              element={<AdminGuard><ContestantsPage /></AdminGuard>}
            />
            <Route
              path="/admin/rebus"
              element={<AdminGuard><RebusAdminPage /></AdminGuard>}
            />
          </Routes>
        </main>
      </div>
    </AuthContext.Provider>
  )
}
