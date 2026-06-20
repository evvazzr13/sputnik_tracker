import { useEffect, useState } from 'react'
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, where, serverTimestamp
} from 'firebase/firestore'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { db, auth } from '../../firebase/config'
import { Plus, Trash2, Shield, UserCircle } from 'lucide-react'

const ADMIN_ROLES = [
  { value: 'senior_counselor', label: 'Старший вожатый' },
  { value: 'senior_educator', label: 'Старший воспитатель' },
  { value: 'deputy_director', label: 'Заместитель директора' },
  { value: 'director', label: 'Директор' },
]

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ fullName: '', email: '', password: '', adminRole: 'senior_counselor' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')))
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function createAdmin(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password)
      await addDoc(collection(db, 'users'), {
        uid: cred.user.uid,
        email: form.email,
        fullName: form.fullName,
        role: 'admin',
        adminRole: form.adminRole,
        createdAt: serverTimestamp(),
      })
      // Re-sign in current admin is complex without server SDK
      // So we just add to Firestore; current session remains
      setForm({ fullName: '', email: '', password: '', adminRole: 'senior_counselor' })
      setShowForm(false)
      loadUsers()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const admins = users.filter(u => u.role === 'admin')
  const counselors = users.filter(u => u.role === 'counselor')

  function getRoleLabel(u) {
    if (u.role === 'admin') return ADMIN_ROLES.find(r => r.value === u.adminRole)?.label || 'Администратор'
    return `Вожатый${u.teamNumber ? ` (Команда №${u.teamNumber})` : ' (без команды)'}`
  }

  if (loading) return <div className="text-center py-16 text-gray-400">Загрузка...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Пользователи</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Добавить администратора
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h2 className="font-semibold mb-4">Новый аккаунт администрации</h2>
          {error && <div className="text-red-600 text-sm mb-3 p-3 bg-red-50 rounded-lg">{error}</div>}
          <form onSubmit={createAdmin} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ФИО</label>
              <input type="text" className="input" required value={form.fullName}
                onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Иванова Мария Петровна" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Должность</label>
              <select className="input" value={form.adminRole}
                onChange={e => setForm(f => ({ ...f, adminRole: e.target.value }))}>
                {ADMIN_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" className="input" required value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
              <input type="password" className="input" required minLength={6} value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Минимум 6 символов" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Создаём...' : 'Создать'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Отмена</button>
            </div>
          </form>
        </div>
      )}

      {/* Admins */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold">Администрация ({admins.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 font-medium text-gray-600">ФИО</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Должность</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {admins.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 font-medium">{u.fullName}</td>
                <td className="px-4 py-3"><span className="badge-blue">{getRoleLabel(u)}</span></td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Counselors */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <UserCircle className="w-5 h-5 text-green-600" />
          <h2 className="font-semibold">Вожатые ({counselors.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 font-medium text-gray-600">ФИО</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Команда</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {counselors.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-6 text-center text-gray-400">Вожатые ещё не зарегистрировались</td></tr>
            )}
            {counselors.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 font-medium">{u.fullName}</td>
                <td className="px-4 py-3 text-center">{u.teamNumber ? `№${u.teamNumber}` : <span className="text-gray-400">—</span>}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3 text-center">
                  {u.teamId ? <span className="badge-green">Активен</span> : <span className="badge-yellow">Ожидает команды</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
