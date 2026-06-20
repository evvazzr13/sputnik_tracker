import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import CounselorDashboard from './pages/counselor/Dashboard'
import TeamPage from './pages/counselor/TeamPage'
import ScheduleHistory from './pages/counselor/ScheduleHistory'
import CounselorEvents from './pages/counselor/Events'
import AdminDashboard from './pages/admin/Dashboard'
import AdminTeams from './pages/admin/Teams'
import AdminReports from './pages/admin/Reports'
import AdminDayPlan from './pages/admin/DayPlan'
import AdminUsers from './pages/admin/Users'
import AdminEvents from './pages/admin/Events'

function RootRedirect() {
  const { userProfile } = useAuth()
  if (!userProfile) return <Navigate to="/login" replace />
  if (userProfile.role === 'admin') return <Navigate to="/admin" replace />
  return <Navigate to="/counselor" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<RootRedirect />} />

          <Route path="/counselor" element={<ProtectedRoute requireRole="counselor"><Layout><CounselorDashboard /></Layout></ProtectedRoute>} />
          <Route path="/counselor/team" element={<ProtectedRoute requireRole="counselor"><Layout><TeamPage /></Layout></ProtectedRoute>} />
          <Route path="/counselor/events" element={<ProtectedRoute requireRole="counselor"><Layout><CounselorEvents /></Layout></ProtectedRoute>} />
          <Route path="/counselor/schedule" element={<ProtectedRoute requireRole="counselor"><Layout><ScheduleHistory /></Layout></ProtectedRoute>} />

          <Route path="/admin" element={<ProtectedRoute requireRole="admin"><Layout><AdminDashboard /></Layout></ProtectedRoute>} />
          <Route path="/admin/teams" element={<ProtectedRoute requireRole="admin"><Layout><AdminTeams /></Layout></ProtectedRoute>} />
          <Route path="/admin/events" element={<ProtectedRoute requireRole="admin"><Layout><AdminEvents /></Layout></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute requireRole="admin"><Layout><AdminReports /></Layout></ProtectedRoute>} />
          <Route path="/admin/dayplan" element={<ProtectedRoute requireRole="admin"><Layout><AdminDayPlan /></Layout></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute requireRole="admin"><Layout><AdminUsers /></Layout></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
