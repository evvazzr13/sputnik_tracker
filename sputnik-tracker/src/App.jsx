import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SeasonProvider } from './contexts/SeasonContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import CounselorDashboard from './pages/counselor/Dashboard'
import TeamPage from './pages/counselor/TeamPage'
import ScheduleHistory from './pages/counselor/ScheduleHistory'
import CounselorEvents from './pages/counselor/Events'
import Duties from './pages/counselor/Duties'
import AdminDashboard from './pages/admin/Dashboard'
import AdminTeams from './pages/admin/Teams'
import AdminReports from './pages/admin/Reports'
import AdminDayPlan from './pages/admin/DayPlan'
import AdminUsers from './pages/admin/Users'
import AdminEvents from './pages/admin/Events'
import ControlPanel from './pages/admin/ControlPanel'
import NightDutiesAdmin from './pages/admin/NightDutiesAdmin'
import Archive from './pages/admin/Archive'

function RootRedirect() {
  const { userProfile } = useAuth()
  if (!userProfile) return <Navigate to="/login" replace />
  if (userProfile.role === 'admin') return <Navigate to="/admin" replace />
  return <Navigate to="/counselor" replace />
}

function Wrap({ role, children }) {
  return <ProtectedRoute requireRole={role}><Layout>{children}</Layout></ProtectedRoute>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SeasonProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<RootRedirect />} />

            <Route path="/counselor" element={<Wrap role="counselor"><CounselorDashboard /></Wrap>} />
            <Route path="/counselor/team" element={<Wrap role="counselor"><TeamPage /></Wrap>} />
            <Route path="/counselor/events" element={<Wrap role="counselor"><CounselorEvents /></Wrap>} />
            <Route path="/counselor/duties" element={<Wrap role="counselor"><Duties /></Wrap>} />
            <Route path="/counselor/schedule" element={<Wrap role="counselor"><ScheduleHistory /></Wrap>} />

            <Route path="/admin/control" element={<Wrap role="admin"><ControlPanel /></Wrap>} />
            <Route path="/admin" element={<Wrap role="admin"><AdminDashboard /></Wrap>} />
            <Route path="/admin/teams" element={<Wrap role="admin"><AdminTeams /></Wrap>} />
            <Route path="/admin/events" element={<Wrap role="admin"><AdminEvents /></Wrap>} />
            <Route path="/admin/duties" element={<Wrap role="admin"><NightDutiesAdmin /></Wrap>} />
            <Route path="/admin/reports" element={<Wrap role="admin"><AdminReports /></Wrap>} />
            <Route path="/admin/dayplan" element={<Wrap role="admin"><AdminDayPlan /></Wrap>} />
            <Route path="/admin/users" element={<Wrap role="admin"><AdminUsers /></Wrap>} />
            <Route path="/archive" element={<ProtectedRoute><Layout><Archive /></Layout></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SeasonProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
