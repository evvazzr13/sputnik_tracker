import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { useSeason } from '../../contexts/SeasonContext'
import { Archive as ArchiveIcon, ChevronDown, ChevronUp, Users, Calendar } from 'lucide-react'

export default function Archive() {
  const { userProfile } = useAuth()
  const { allSeasons } = useSeason()
  const [selectedSeason, setSelectedSeason] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expandedTeam, setExpandedTeam] = useState(null)

  const isAdmin = userProfile?.role === 'admin'
  const completedSeasons = allSeasons.filter(s => s.status === 'completed')

  async function loadArchive(season) {
    setSelectedSeason(season)
    setLoading(true)
    try {
      const [assignmentsSnap, childrenSnap, attendanceSnap, plansSnap] = await Promise.all([
        getDocs(query(collection(db, 'seasonArchive'), where('seasonId', '==', season.id))),
        getDocs(query(collection(db, 'children'), where('seasonId', '==', season.id))),
        getDocs(query(collection(db, 'attendance'), where('seasonId', '==', season.id))),
        getDocs(query(collection(db, 'dayPlans'), where('seasonId', '==', season.id))),
      ])

      let assignments = assignmentsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

      // Counselors see only their team from that season
      if (!isAdmin) {
        const myAssignment = assignments.find(a => a.userId === userProfile.uid)
        if (myAssignment) {
          assignments = assignments.filter(a => a.teamId === myAssignment.teamId)
        }
      }

      const children = childrenSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const attendance = attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const plans = plansSnap.docs.map(d => ({ id: d.id, ...d.data() }))

      setData({ assignments, children, attendance, plans })
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  // Group assignments by team
  const teamGroups = data ? [...new Set(data.assignments.map(a => a.teamId))].map(teamId => {
    const teamAssignments = data.assignments.filter(a => a.teamId === teamId)
    const teamNumber = teamAssignments[0]?.teamNumber
    const teamChildren = data.children.filter(c => c.teamId === teamId)
    return { teamId, teamNumber, counselors: teamAssignments, children: teamChildren }
  }).sort((a, b) => (a.teamNumber || 0) - (b.teamNumber || 0)) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ArchiveIcon className="w-6 h-6 text-gray-600" />
        <h1 className="text-2xl font-bold">Архив смен</h1>
      </div>

      {completedSeasons.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <ArchiveIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>Завершённых смен пока нет</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-3 gap-4">
          {completedSeasons.map(season => (
            <button key={season.id} onClick={() => loadArchive(season)}
              className={`card text-left hover:shadow-md transition-shadow p-4
                ${selectedSeason?.id === season.id ? 'ring-2 ring-blue-500' : ''}`}>
              <div className="font-bold text-lg">Смена №{season.number}</div>
              <div className="text-sm text-gray-500 mt-1">{season.startDate} — {season.endDate}</div>
              <div className="badge-gray mt-2 text-xs inline-block">Завершена</div>
            </button>
          ))}
        </div>
      )}

      {loading && <div className="text-center py-8 text-gray-400">Загрузка архива...</div>}

      {data && selectedSeason && !loading && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Смена №{selectedSeason.number}: {selectedSeason.startDate} — {selectedSeason.endDate}
          </h2>

          {/* Plans count */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card text-center py-3">
              <div className="text-2xl font-bold">{teamGroups.length}</div>
              <div className="text-xs text-gray-500">Команд</div>
            </div>
            <div className="card text-center py-3">
              <div className="text-2xl font-bold">{data.children.length}</div>
              <div className="text-xs text-gray-500">Детей</div>
            </div>
            <div className="card text-center py-3">
              <div className="text-2xl font-bold">{data.plans.length}</div>
              <div className="text-xs text-gray-500">Дней плана</div>
            </div>
          </div>

          {/* Teams */}
          <div className="space-y-3">
            {teamGroups.map(team => (
              <div key={team.teamId} className="card p-0 overflow-hidden">
                <button className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50"
                  onClick={() => setExpandedTeam(expandedTeam === team.teamId ? null : team.teamId)}>
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold">Команда №{team.teamNumber}</span>
                    <span className="text-sm text-gray-400">{team.counselors[0]?.brigadeName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-400">
                    <span>{team.children.length} детей</span>
                    {expandedTeam === team.teamId ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>
                {expandedTeam === team.teamId && (
                  <div className="border-t border-gray-100 px-5 pb-4 pt-3">
                    <div className="mb-3">
                      <div className="text-xs font-medium text-gray-500 mb-1">Вожатые:</div>
                      {team.counselors.map(c => <div key={c.userId} className="text-sm">{c.fullName}</div>)}
                    </div>
                    {team.children.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-gray-500 mb-1">Дети ({team.children.length}):</div>
                        <div className="text-sm text-gray-600 columns-2">
                          {team.children.map(c => <div key={c.id}>{c.name}</div>)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
