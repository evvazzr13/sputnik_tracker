import { useEffect, useState } from 'react'
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, where, serverTimestamp, arrayUnion, arrayRemove
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { Plus, Trash2, Edit2, Save, X, Users, UserPlus } from 'lucide-react'

export default function AdminTeams() {
  const [teams, setTeams] = useState([])
  const [counselors, setCounselors] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTeamNumber, setNewTeamNumber] = useState('')
  const [editing, setEditing] = useState(null)
  const [editNumber, setEditNumber] = useState('')
  const [childCounts, setChildCounts] = useState({})
  const [assigningTo, setAssigningTo] = useState(null) // teamId being assigned
  const [selectedCounselor, setSelectedCounselor] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [teamsSnap, usersSnap, childrenSnap] = await Promise.all([
        getDocs(query(collection(db, 'teams'), orderBy('number'))),
        getDocs(query(collection(db, 'users'), where('role', '==', 'counselor'))),
        getDocs(collection(db, 'children')),
      ])
      setTeams(teamsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setCounselors(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      const counts = {}
      childrenSnap.docs.forEach(d => {
        const { teamId } = d.data()
        counts[teamId] = (counts[teamId] || 0) + 1
      })
      setChildCounts(counts)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function addTeam() {
    if (!newTeamNumber.trim()) return
    const num = parseInt(newTeamNumber)
    if (isNaN(num)) return alert('Введите номер команды (число)')
    if (teams.find(t => t.number === num)) return alert('Команда с таким номером уже существует')
    await addDoc(collection(db, 'teams'), {
      number: num,
      counselorIds: [],
      createdAt: serverTimestamp(),
    })
    setNewTeamNumber('')
    loadAll()
  }

  async function deleteTeam(teamId) {
    if (!confirm('Удалить команду? Данные о детях и посещаемости останутся.')) return
    await deleteDoc(doc(db, 'teams', teamId))
    loadAll()
  }

  async function saveEdit(teamId) {
    const num = parseInt(editNumber)
    if (isNaN(num)) return
    // Update team number + update all assigned counselors' teamNumber
    const team = teams.find(t => t.id === teamId)
    const ids = getTeamCounselorIds(team)
    await updateDoc(doc(db, 'teams', teamId), { number: num })
    await Promise.all(ids.map(id => updateDoc(doc(db, 'users', id), { teamNumber: num })))
    setEditing(null)
    loadAll()
  }

  function getTeamCounselorIds(team) {
    // Support both old (counselorId) and new (counselorIds[]) format
    if (Array.isArray(team.counselorIds)) return team.counselorIds
    if (team.counselorId) return [team.counselorId]
    return []
  }

  async function addCounselorToTeam(teamId, counselorId) {
    if (!counselorId) return
    setSaving(true)
    try {
      const team = teams.find(t => t.id === teamId)
      const existingIds = getTeamCounselorIds(team)
      if (existingIds.includes(counselorId)) {
        alert('Этот вожатый уже добавлен в команду')
        return
      }
      if (existingIds.length >= 4) {
        alert('В команде не может быть больше 4 вожатых')
        return
      }
      // Add counselor to team
      await updateDoc(doc(db, 'teams', teamId), {
        counselorIds: arrayUnion(counselorId),
        counselorId: null, // clear old field
      })
      // Update counselor profile
      await updateDoc(doc(db, 'users', counselorId), {
        teamId,
        teamNumber: team?.number || null,
        approved: true,
      })
      setAssigningTo(null)
      setSelectedCounselor('')
      loadAll()
    } catch (err) {
      console.error(err)
      alert('Ошибка при назначении вожатого')
    } finally {
      setSaving(false)
    }
  }

  async function removeCounselorFromTeam(teamId, counselorId) {
    if (!confirm('Убрать вожатого из команды?')) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'teams', teamId), {
        counselorIds: arrayRemove(counselorId),
      })
      await updateDoc(doc(db, 'users', counselorId), {
        teamId: null,
        teamNumber: null,
        approved: false,
      })
      loadAll()
    } catch (err) {
      console.error(err)
      alert('Ошибка при удалении вожатого')
    } finally {
      setSaving(false)
    }
  }

  function getCounselorName(id) {
    return counselors.find(c => c.id === id)?.fullName || id
  }

  // Counselors not yet assigned to any team
  function getAvailableCounselors(excludeTeamId) {
    const team = teams.find(t => t.id === excludeTeamId)
    const assigned = getTeamCounselorIds(team)
    return counselors.filter(c => !assigned.includes(c.id))
  }

  if (loading) return <div className="text-center py-16 text-gray-400">Загрузка...</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Управление командами</h1>

      {/* Add team */}
      <div className="card">
        <h2 className="font-semibold mb-3">Добавить команду</h2>
        <div className="flex gap-2">
          <input
            type="number"
            min="1"
            className="input max-w-xs"
            value={newTeamNumber}
            onChange={e => setNewTeamNumber(e.target.value)}
            placeholder="Номер команды"
            onKeyDown={e => e.key === 'Enter' && addTeam()}
          />
          <button onClick={addTeam} className="btn-primary flex items-center gap-1">
            <Plus className="w-4 h-4" /> Создать
          </button>
        </div>
      </div>

      {/* Teams list */}
      {teams.length === 0 ? (
        <div className="card text-center py-10 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
          Команды не созданы
        </div>
      ) : (
        <div className="space-y-4">
          {teams.map(team => {
            const teamCounselorIds = getTeamCounselorIds(team)
            const available = getAvailableCounselors(team.id)
            const isAssigning = assigningTo === team.id

            return (
              <div key={team.id} className="card">
                <div className="flex items-center justify-between mb-3">
                  {editing === team.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Команда №</span>
                      <input
                        type="number"
                        className="input w-24 text-sm py-1"
                        value={editNumber}
                        onChange={e => setEditNumber(e.target.value)}
                        autoFocus
                      />
                      <button onClick={() => saveEdit(team.id)} className="text-green-600 hover:text-green-700 p-1">
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 p-1">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg">Команда №{team.number}</h3>
                      <button
                        onClick={() => { setEditing(team.id); setEditNumber(team.number) }}
                        className="text-gray-300 hover:text-gray-500 p-0.5"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">{childCounts[team.id] || 0} детей</span>
                    <button
                      onClick={() => deleteTeam(team.id)}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                      title="Удалить команду"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Assigned counselors */}
                <div className="space-y-2 mb-3">
                  <div className="text-sm font-medium text-gray-600">
                    Вожатые ({teamCounselorIds.length}/4):
                  </div>
                  {teamCounselorIds.length === 0 ? (
                    <div className="text-sm text-gray-400 italic">Вожатые не назначены</div>
                  ) : (
                    teamCounselorIds.map(id => (
                      <div key={id} className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                        <span className="text-sm font-medium text-blue-800">{getCounselorName(id)}</span>
                        <button
                          onClick={() => removeCounselorFromTeam(team.id, id)}
                          className="text-blue-300 hover:text-red-500 transition-colors p-0.5"
                          title="Убрать из команды"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Add counselor */}
                {teamCounselorIds.length < 4 && (
                  isAssigning ? (
                    <div className="flex items-center gap-2">
                      <select
                        className="input text-sm"
                        value={selectedCounselor}
                        onChange={e => setSelectedCounselor(e.target.value)}
                        autoFocus
                      >
                        <option value="">— Выберите вожатого —</option>
                        {available.map(c => (
                          <option key={c.id} value={c.id}>{c.fullName}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => addCounselorToTeam(team.id, selectedCounselor)}
                        disabled={!selectedCounselor || saving}
                        className="btn-primary text-sm px-3 py-2 flex-shrink-0"
                      >
                        {saving ? '...' : 'Назначить'}
                      </button>
                      <button
                        onClick={() => { setAssigningTo(null); setSelectedCounselor('') }}
                        className="btn-secondary text-sm px-3 py-2 flex-shrink-0"
                      >
                        Отмена
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAssigningTo(team.id); setSelectedCounselor('') }}
                      className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <UserPlus className="w-4 h-4" /> Добавить вожатого
                    </button>
                  )
                )}
                {teamCounselorIds.length >= 4 && (
                  <div className="text-xs text-gray-400">Максимум 4 вожатых на команду</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
