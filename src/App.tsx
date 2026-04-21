import { Routes, Route } from 'react-router-dom'
import { AuthContext, useAuthProvider } from '@/hooks/use-auth'
import { MainLayout } from '@/components/layout/MainLayout'
import { AdminGuard } from '@/components/layout/AdminGuard'
import { LeaderboardPage } from '@/pages/LeaderboardPage'
import { LoginPage } from '@/pages/LoginPage'
import { ActivityDetailPage } from '@/pages/ActivityDetailPage'
import { RebusPage } from '@/pages/RebusPage'
import { ActivityHistoryPage } from '@/pages/ActivityHistoryPage'
import { StatsPage } from '@/pages/StatsPage'
import { PlayerProfilePage } from '@/pages/PlayerProfilePage'
import { DisplayPage } from '@/pages/DisplayPage'
import { AdminPage } from '@/pages/AdminPage'
import { DrinkPage } from '@/pages/DrinkPage'

export default function App() {
  const auth = useAuthProvider()

  return (
    <AuthContext.Provider value={auth}>
      <div className="min-h-screen bg-background">
        <Routes>
          {/* Hidden full-screen views — no header, no menu */}
          <Route path="/rebus/run" element={<RebusPage />} />
          <Route path="/display" element={<DisplayPage />} />

          {/* Main app with header */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<LeaderboardPage />} />
            <Route path="/activities" element={<ActivityHistoryPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/drikk" element={<DrinkPage />} />
            <Route path="/players/:id" element={<PlayerProfilePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/admin"
              element={<AdminGuard><AdminPage /></AdminGuard>}
            />
            <Route
              path="/admin/activities/:id"
              element={<AdminGuard><ActivityDetailPage /></AdminGuard>}
            />
          </Route>
        </Routes>
      </div>
    </AuthContext.Provider>
  )
}
