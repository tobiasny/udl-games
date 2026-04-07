import { Routes, Route } from 'react-router-dom'
import { AuthContext, useAuthProvider } from '@/hooks/use-auth'
import { MainLayout } from '@/components/layout/MainLayout'
import { AdminGuard } from '@/components/layout/AdminGuard'
import { LeaderboardPage } from '@/pages/LeaderboardPage'
import { LoginPage } from '@/pages/LoginPage'
import { ActivitiesPage } from '@/pages/ActivitiesPage'
import { ActivityDetailPage } from '@/pages/ActivityDetailPage'
import { ContestantsPage } from '@/pages/ContestantsPage'
import { RebusPage } from '@/pages/RebusPage'
import { RebusAdminPage } from '@/pages/RebusAdminPage'
import { ActivityHistoryPage } from '@/pages/ActivityHistoryPage'

export default function App() {
  const auth = useAuthProvider()

  return (
    <AuthContext.Provider value={auth}>
      <div className="min-h-screen bg-background bg-grid relative">
        <Routes>
          {/* Hidden full-screen rebus view — no header, no menu */}
          <Route path="/rebus/run" element={<RebusPage />} />

          {/* Main app with header */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<LeaderboardPage />} />
            <Route path="/activities" element={<ActivityHistoryPage />} />
            <Route path="/login" element={<LoginPage />} />
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
          </Route>
        </Routes>
      </div>
    </AuthContext.Provider>
  )
}
