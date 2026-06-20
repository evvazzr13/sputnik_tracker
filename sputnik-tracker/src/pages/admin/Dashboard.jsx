import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useSeason } from '../../contexts/SeasonContext'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Users, UserCheck, UserX, BarChart2, Moon, AlertCircle } from 'lucide-react'
import { BRIGADES, getBrigadeColor } from '../../utils/brigade'
import { Link } from 'react-router-dom'

export default function AdminDashboard() {
  const { activeSeason } = useSeason()
  const [summary, setSummary] = useState([])
  const [todayDuties, setTodayDuties] = useState([])
  const [loading, setLoading] = useState(true)
  const today = format(new Date(), 'yyyy-MM-dd')
  const todayLabel = format(new Date(), 'd MMMM yyyy', { locale: ru })

  useEffect(() => { if (activeSeason) { loadData() } else { setLoading(false) } }, [activeSeason, today])

  async function loadData() {
    setLoading(true)
    try {
      const [teamsSnap, childrenSnap, attSnap, dutiesSnap] = await Promise.all([
        getDocs(query(collection(db, 'teams'), orderBy('number'))),
        getDocs(collection(db, 'children')),
        getDocs(query(collection(db, 'attendance'), where('date', '==', today))),
        getDocs(query(collection(db, 'nightDuties'), where('seasonId', '==', activeSeason.id), where('date', '==', today))),
      ])

      const teams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const children = childrenSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const attendance = {}
      attSnap.docs.forEach(d => { const data = d.data(); attendance[`${data.teamId}_${data.childId}`] = data })
      setTodayDuties(dutiesSnap.docs.map(d => d.data()))

      const result = teams.map(team => {
        const tc = children.filter(c => c.teamId === team.id)
        const girls = tc.filter(c => c.gender === 'girl')
        const boys = tc.filter(c => c.gender === 'boy')
        const isAbsent = (child) => attendance[`${team.id}_${child.id}`]?.status === 'absent'
        return {
          teamId: team.id, number: team.number,
          totalGirls: girls.length, totalBoys: boys.length,
          absentGirls: girls.filter(isAbsent).length, absentBoys: boys.filter(isAbsent).length,
          total: tc.length, absent: tc.filter(isAbsent).length,
        }
      })
      setSummary(result)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const totals = summary.reduce((acc, t) => ({
    totalGirls: acc.totalGirls + t.totalGirls, totalBoys: acc.totalBoys + t.totalBoys,
    absentGirls: acc.absentGirls + t.absentGirls, absentBoys: acc.absentBoys + t.absentBoys,
    total: acc.total + t.total, absent: acc.absent + t.absent,
  }), { totalGirls:0, totalBoys:0, absentGirls:0, absentBoys:0, total:0, absent:0 })

  if (!activeSeason) return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Панель администратора</h1>
      <div className="card flex items-center gap-4 py-6">
        <AlertCircle className="w-10 h-10 text-yellow-500 flex-shrink-0" />
        <div>
          <div className="font-semibold text-lg">Нет активной смены</div>
          <p className="text-gray-500 mt-1">Перейдите в <Link to="/admin/control" className="text-blue-600 underline">Панель управления</Link>, чтобы создать и запустить смену.</p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Сводка — {todayLabel}</h1>
        <p className="text-gray-500 mt-1">Смена №{activeSeason.number} · {activeSeason.startDate} — {activeSeason.endDate}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Всего детей" value={totals.total} icon={<Users className="w-5 h-5 text-blue-600" />} color="blue" />
        <StatCard label="Присутствуют" value={totals.total - totals.absent} icon={<UserCheck className="w-5 h-5 text-green-600" />} color="green" />
        <StatCard label="Отсутствуют" value={totals.absent} icon={<UserX className="w-5 h-5 text-red-500" />} color="red" />
        <StatCard label="Команд" value={summary.length} icon={<BarChart2 className="w-5 h-5 text-purple-600" />} color="purple" />
      </div>

      {/* Night duties today */}
      <div className="card">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><Moon className="w-5 h-5 text-indigo-600" /> Ночные дежурные сегодня</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {BRIGADES.map(brigade => {
            const brigDuties = todayDuties.filter(d => d.brigadeId === brigade.id)
            const colors = getBrigadeColor(brigade.id)
            return (
              <div key={brigade.id} className={`rounded-lg border p-3 ${colors.bg} ${colors.border}`}>
                <div className={`text-sm font-semibold ${colors.text}`}>{brigade.short}</div>
                {brigDuties.length === 0 ? (
                  <div className="text-xs text-gray-400 mt-1 italic">Не назначены</div>
                ) : (
                  brigDuties.map(d => <div key={d.userId} className="text-xs mt-0.5">{d.fullName}</div>)
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Attendance table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold">Посещаемость по командам</h2>
        </div>
        {loading ? <div className="text-center py-10 text-gray-400">Загрузка...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Команда</th>
                  <th className="text-center px-3 py-3 font-medium text-pink-600">♀</th>
                  <th className="text-center px-3 py-3 font-medium text-blue-600">♂</th>
                  <th className="text-center px-3 py-3 font-medium text-red-500">♀ отс.</th>
                  <th className="text-center px-3 py-3 font-medium text-red-500">♂ отс.</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600">Всего</th>
                  <th className="text-center px-3 py-3 font-medium text-green-600">Присутств.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summary.map(t => (
                  <tr key={t.teamId} className="hover:bg-gray-50">
                    <td className="px-6 py-2.5 font-semibold">№{t.number}</td>
                    <td className="text-center px-3 py-2.5 text-pink-600">{t.totalGirls}</td>
                    <td className="text-center px-3 py-2.5 text-blue-600">{t.totalBoys}</td>
                    <td className="text-center px-3 py-2.5">{t.absentGirls > 0 ? <span className="badge-red">{t.absentGirls}</span> : <span className="text-gray-300">—</span>}</td>
                    <td className="text-center px-3 py-2.5">{t.absentBoys > 0 ? <span className="badge-red">{t.absentBoys}</span> : <span className="text-gray-300">—</span>}</td>
                    <td className="text-center px-3 py-2.5 font-medium">{t.total}</td>
                    <td className="text-center px-3 py-2.5"><span className={t.absent > 0 ? 'badge-yellow' : 'badge-green'}>{t.total - t.absent}</span></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                <tr>
                  <td className="px-6 py-2.5">ИТОГО</td>
                  <td className="text-center px-3 py-2.5 text-pink-600">{totals.totalGirls}</td>
                  <td className="text-center px-3 py-2.5 text-blue-600">{totals.totalBoys}</td>
                  <td className="text-center px-3 py-2.5 text-red-500">{totals.absentGirls}</td>
                  <td className="text-center px-3 py-2.5 text-red-500">{totals.absentBoys}</td>
                  <td className="text-center px-3 py-2.5">{totals.total}</td>
                  <td className="text-center px-3 py-2.5 text-green-700">{totals.total - totals.absent}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color }) {
  const colors = { blue: 'bg-blue-50', green: 'bg-green-50', red: 'bg-red-50', purple: 'bg-purple-50' }
  return (
    <div className="card flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg ${colors[color]} flex items-center justify-center flex-shrink-0`}>{icon}</div>
      <div><div className="text-2xl font-bold">{value}</div><div className="text-xs text-gray-500">{label}</div></div>
    </div>
  )
}
