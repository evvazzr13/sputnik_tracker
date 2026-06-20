import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children, requireRole }) {
  const { currentUser, userProfile } = useAuth()

  if (!currentUser) return <Navigate to="/login" replace />

  if (requireRole && userProfile?.role !== requireRole) {
    const redirect = userProfile?.role === 'admin' ? '/admin' : '/counselor'
    return <Navigate to={redirect} replace />
  }

  // Counselor must be approved (team assigned)
  if (userProfile?.role === 'counselor' && !userProfile?.teamId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="card max-w-md w-full text-center">
          <div className="text-4xl mb-4">⏳</div>
          <h2 className="text-xl font-bold mb-2">Ожидание подтверждения</h2>
          <p className="text-gray-600 mb-4">
            Ваш аккаунт зарегистрирован. Администратор должен назначить вам команду.
            После этого вы получите доступ к системе.
          </p>
          <p className="text-sm text-gray-500">Обратитесь к старшему вожатому или администратору.</p>
        </div>
      </div>
    )
  }

  return children
}
