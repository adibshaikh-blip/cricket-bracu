import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './mvc/controllers/auth/useAuth'
import { RequireRole } from './mvc/controllers/guards/RequireRole'
import './mvc/styles/admin.css'
import AdminLoginPage from './mvc/views/auth/AdminLoginPage'
import PlayerLoginPage from './mvc/views/auth/PlayerLoginPage'
import PlayerRegisterPage from './mvc/views/auth/PlayerRegisterPage'
import AdminDashboardPage from './mvc/views/admin/AdminDashboardPage'
import PlayerDashboardPage from './mvc/views/player/PlayerDashboardPage'
import TournamentManagementPage from './mvc/views/admin/TournamentManagementPage'
import MatchScoringPage from './mvc/views/admin/MatchScoringPage'
import MatchViewPage from './mvc/views/public/MatchViewPage'
import TeamManagementPage from './mvc/views/player/TeamManagementPage'
import PlayerProfilePage from './mvc/views/player/PlayerProfilePage'
import TopBar from './mvc/views/common/TopBar'
import HomePage from './mvc/views/public/HomePage'
import PublicTournamentPage from './mvc/views/public/PublicTournamentPage'
import TournamentInfoPage from './mvc/views/public/TournamentInfoPage'
import PlayerRankingsPage from './mvc/views/public/PlayerRankingsPage'
import FieldBookingPage from './mvc/views/player/FieldBookingPage'
import FieldBookingsAdminPage from './mvc/views/admin/FieldBookingsAdminPage'
import ComplaintsPage from './mvc/views/player/ComplaintsPage'
import ComplaintResolverPage from './mvc/views/admin/ComplaintResolverPage'
import ClubMembersPage from './mvc/views/public/ClubMembersPage'
import ClubManagementPage from './mvc/views/admin/ClubManagementPage'

function AppLayout() {
  return (
    <>
      <TopBar />
      <Outlet />
    </>
  )
}

function DashboardRedirect() {
  const { authReady, user, role } = useAuth()
  if (!authReady) return <div>Loading...</div>
  if (!user) return <Navigate to="/player/login" replace />
  if (role === 'admin') return <Navigate to="/admin/dashboard" replace />
  if (role === 'player') return <Navigate to="/player/dashboard" replace />
  return <Navigate to="/" replace />
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/tournaments" element={<PublicTournamentPage />} />
        <Route path="/tournaments/:tournamentId" element={<TournamentInfoPage />} />
        <Route path="/rankings" element={<PlayerRankingsPage />} />
        <Route path="/club" element={<ClubMembersPage />} />
        <Route path="/dashboard" element={<DashboardRedirect />} />

        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/player/login" element={<PlayerLoginPage />} />
        <Route path="/player/register" element={<PlayerRegisterPage />} />

        <Route
          path="/admin/dashboard"
          element={
            <RequireRole requiredRole="admin">
              <AdminDashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/tournaments/:tournamentId/manage"
          element={
            <RequireRole requiredRole="admin">
              <TournamentManagementPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/tournaments/:tournamentId/matches/:matchId/score"
          element={
            <RequireRole requiredRole="admin">
              <MatchScoringPage />
            </RequireRole>
          }
        />
        <Route
          path="/tournaments/:tournamentId/matches/:matchId"
          element={<MatchViewPage />}
        />
        <Route
          path="/player/dashboard"
          element={
            <RequireRole requiredRole="player">
              <PlayerDashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="/player/bookings"
          element={
            <RequireRole requiredRole="player">
              <FieldBookingPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/bookings"
          element={
            <RequireRole requiredRole="admin">
              <FieldBookingsAdminPage />
            </RequireRole>
          }
        />
        <Route
          path="/player/complaints"
          element={
            <RequireRole requiredRole="player">
              <ComplaintsPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/complaints"
          element={
            <RequireRole requiredRole="admin">
              <ComplaintResolverPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/club"
          element={
            <RequireRole requiredRole="admin">
              <ClubManagementPage />
            </RequireRole>
          }
        />
        <Route
          path="/player/tournaments/:tournamentId/teams/:teamId/manage"
          element={
            <RequireRole requiredRole="player">
              <TeamManagementPage />
            </RequireRole>
          }
        />
        <Route path="/players/:playerUid" element={<PlayerProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
