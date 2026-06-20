import { useEffect, useState } from 'react'
import { collection, getDocs, query, orderBy, where, updateDoc, doc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { useSeason } from '../../contexts/SeasonContext'
import { getBrigade } from '../../utils/brigade'
import { format, parseISO, isToday } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Plus, Play, Square, AlertCircle, CheckCircle, Users, Calendar } from 'lucide-react'

export default function ControlPanel() {
  const { userProfile } = useAuth()
  const { activeSeason, allSeasons, createSeason, startSeason, endSeason, loadSeasons } = useSeason()
  const [teams, setTeams] = useState([])
  const [counselors, setCounselors] = useState([])
  const [loading, setLoading] = useState(true)
  const [newSeason, setNewSeason] = useState({ number: '', startDate: '', endDate: '' })
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('season')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [teamsSnap, usersSnap] = await Promise.all([
        getDocs(query(collection(db, 'teams'), orderBy('number'))),
        getDocs(query(collection(db, 'users'), where('role', '==', 'counselor'))),
      ])
      setTeams(teamsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setCounselors(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  async function handleCreateSeason(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await createSeason(parseInt(newSeason.number), newSeason.startDate, newSeason.endDate)
      setNewSeason({ number: '', startDate: '', endDate: '' })
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  async function handleStartSeason(seasonId) {
    if (!confirm('Запустить смену? Убедитесь, что команды и вожатые назначены.')) return
    await startSeason(seasonId)
  }

  async function handleEndSeason() {
    if (!activeSeason) return
    if (!confirm(`Завершить смену №${activeSeason.number}? Назначения вожатых будут сброшены.`)) return
    setSaving(true)
    try {
      await endSeason(activeSeason.id, counselors)
      // Reset counselor assignments
      for (const c of counselors) {
        if (c.teamId) {
          await updateDoc(doc(db, 'users', c.id), { teamId: null, teamNumber: null, brigadeId: null, brigadeName: null, approved: false })
        }
      }
      // Reset team counselorIds
      for (const t of teams) {
        await updateDoc(doc(db, 'teams', t.id), { counselorIds: [] })
      }
      await loadData()
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  function canEndSeason() {
    if (!activeSeason) return false
    try { return isToday(parseISO(activeSeason.endDate)) } catch { return false }
  }

  function getTeamCounselorIds(team) {
    if (Array.isArray(team.counselorIds)) return team.counselorIds
    if (team.counselorId) return [team.counselorId]
    return []
  }

  async function assignCounselor(teamId, counselorId) {
    if (!counselorId) return
    const team = teams.find(t => t.id === teamId)
    const brigade = getBrigade(team?.number)
    const existingIds = getTeamCounselorIds(team)
    if (existingIds.includes(counselorId)) return

    const { arrayUnion } = await import('firebase/firestore')
    await updateDoc(doc(db, 'teams', teamId), { counselorIds: arrayUnion(counselorId) })
    await updateDoc(doc(db, 'users', counselorId), {
      teamId, teamNumber: team?.number, approved: true,
      brigadeId: brigade.id, brigadeName: brigade.short,
    })
    await loadData()
  }

  async function removeCounselor(teamId, counselorId) {
    const { arrayRemove } = await import('firebase/firestore')
    await updateDoc(doc(db, 'teams', teamId), { counselorIds: arrayRemove(counselorId) })
    await updateDoc(doc(db, 'users', counselorId), { teamId: null, teamNumber: null, brigadeId: null, brigadeName: null, approved: false })
    await loadData()
  }

  function getCounselorName(id) {
    return counselors.find(c => c.id === id)?.fullName || id
  }

  function getAvailableCounselors(teamId) {
    const team = teams.find(t => t.id === teamId)
    const assigned = getTeamCounselorIds(team)
    return counselors.filter(c => !assigned.includes(c.id))
  }

  const [addingTo, setAddingTo] = useState(null)
  const [selectedC, setSelectedC] = useState('')

  if (loading) return <div className="text-center py-16 text-gray-400">Загрузка...</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Панель управления</h1>

      {/* Active season banner */}
      {activeSeason ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
            <div>
              <div className="font-semibold text-green-800">Активная смена №{activeSeason.number}</div>
              <div className="text-sm text-green-600">
                {activeSeason.startDate} — {activeSeason.endDate}
              </div>
            </div>
          </div>
          <button
            onClick={handleEndSeason}
            disabled={!canEndSeason() || saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors
              ${canEndSeason() ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
          >
            <Square className="w-4 h-4" />
            {saving ? 'Завершаем...' : 'Завершить смену'}
          </button>
          {!canEndSeason() && (
            <div className="w-full text-xs text-green-600">
              Кнопка будет доступна в день окончания смены ({activeSeason.endDate})
            </div>
          )}
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <span className="text-yellow-800 font-medium">Нет активной смены. Создайте и запустите смену ниже.</span>
        </div>
      )}

      <div className="flex gap-2 border-b border-gray-200">
        {[
          { id: 'season', label: 'Управление сменами' },
          { id: 'teams', label: 'Назначение вожатых' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors
              ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'season' && (
        <div className="space-y-4">
          {/* Create season form */}
          {!activeSeason && (
            <div className="card">
              <h2 className="font-semibold mb-4 flex items-center gap-2"><Plus className="w-4 h-4" /> Создать смену</h2>
              <form onSubmit={handleCreateSeason} className="grid sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">№ смены</label>
                  <input type="number" min="1" max="3" className="input" required value={newSeason.number}
                    onChange={e => setNewSeason(p => ({ ...p, number: e.target.value }))} placeholder="1-3" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Начало</label>
                  <input type="date" className="input" required value={newSeason.startDate}
                    onChange={e => setNewSeason(p => ({ ...p, startDate: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Окончание</label>
                  <input type="date" className="input" required value={newSeason.endDate}
                    onChange={e => setNewSeason(p => ({ ...p, endDate: e.target.value }))} />
                </div>
                <div className="flex items-end">
                  <button type="submit" disabled={saving} className="btn-primary w-full">Создать</button>
                </div>
              </form>
            </div>
          )}

          {/* Season list */}
          <div className="space-y-3">
            {allSeasons.length === 0 ? (
              <div className="card text-center py-8 text-gray-400">Смены не созданы</div>
            ) : (
              allSeasons.map(season => (
                <div key={season.id} className="card p-4 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="font-semibold">Смена №{season.number}</div>
                      <div className="text-sm text-gray-500">{season.startDate} — {season.endDate}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {season.status === 'active' && <span className="badge-green">Активна</span>}
                    {season.status === 'completed' && <span className="badge-gray">Завершена</span>}
                    {season.status === 'pending' && !activeSeason && (
                      <button onClick={() => handleStartSeason(season.id)} className="btn-green flex items-center gap-2 text-sm">
                        <Play className="w-4 h-4" /> Запустить
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="space-y-4">
          <div className="text-sm text-gray-500 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            Назначения вожатых действуют в рамках текущей смены и сбрасываются при её завершении.
          </div>
          {teams.map(team => {
            const brigade = getBrigade(team.number)
            const assignedIds = getTeamCounselorIds(team)
            const available = getAvailableCounselors(team.id)
            const colors = { olimp: 'bg-blue-50 border-blue-200', zvezda: 'bg-yellow-50 border-yellow-200', kosmos: 'bg-purple-50 border-purple-200', solnyshko: 'bg-orange-50 border-orange-200' }
            const colorClass = colors[brigade.id] || 'bg-gray-50 border-gray-200'

            return (
              <div key={team.id} className={`rounded-xl border p-4 ${colorClass}`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-bold">Команда №{team.number}</span>
                    <span className="ml-2 text-sm text-gray-500">{brigade.name}</span>
                  </div>
                  <span className="text-sm text-gray-400">{assignedIds.length}/4 вожатых</span>
                </div>

                <div className="space-y-1 mb-2">
                  {assignedIds.length === 0 && <div className="text-sm text-gray-400 italic">Не назначены</div>}
                  {assignedIds.map(id => (
                    <div key={id} className="flex items-center justify-between bg-white rounded-lg px-3 py-1.5 text-sm">
                      <span>{getCounselorName(id)}</span>
                      <button onClick={() => removeCounselor(team.id, id)} className="text-gray-300 hover:text-red-500 text-xs ml-2">✕</button>
                    </div>
                  ))}
                </div>

                {assignedIds.length < 4 && (
                  addingTo === team.id ? (
                    <div className="flex gap-2">
                      <select className="input text-sm flex-1" value={selectedC} onChange={e => setSelectedC(e.target.value)}>
                        <option value="">— Выбрать вожатого —</option>
                        {available.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                      </select>
                      <button onClick={() => { assignCounselor(team.id, selectedC); setAddingTo(null); setSelectedC('') }}
                        disabled={!selectedC} className="btn-primary text-sm px-3">Назначить</button>
                      <button onClick={() => setAddingTo(null)} className="btn-secondary text-sm px-3">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => { setAddingTo(team.id); setSelectedC('') }}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> Добавить вожатого
                    </button>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
