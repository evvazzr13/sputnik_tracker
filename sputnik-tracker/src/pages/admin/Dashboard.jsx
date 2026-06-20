import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Users, UserCheck, UserX, BarChart2 } from 'lucide-react'

export default function AdminDashboard() {
  const [summary, setSummary] = useState([])
  const [loading, setLoading] = useState(true)
  const today = format(new Date(), 'yyyy-MM-dd')
  const todayLabel = format(new Date(), 'd MMMM yyyy', { locale: ru })

  useEffect(() => {
    async function load() {
      try {
        const teamsSnap = await getDocs(query(collection(db, 'teams'), orderBy('number')))
        const teams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

        const childrenSnap = await getDocs(collection(db, 'children'))
        const children = childrenSnap.docs.map(d => ({ id: d.id, ...d.data() }))

        const attSnap = await getDocs(
          query(collection(db, 'attendance'), where('date', '==', today))
        )
        const attendance = {}
        attSnap.docs.forEach(d => {
          const data = d.data()
          attendance[`${data.teamId}_${data.childId}`] = data
        })

        const result = teams.map(team => {
          const teamChildren = children.filter(c => c.teamId === team.id)
          const girls = teamChildren.filter(c => c.gender === 'girl')
          const boys = teamChildren.filter(c => c.gender === 'boy')

          function isAbsent(child) {
            const key = `${team.id}_${child.id}`
            return attendance[key]?.status === 'absent'
          }

          return {
            teamId: team.id,
            number: team.number,
            totalGirls: girls.length,
            totalBoys: boys.length,
            absentGirls: girls.filter(isAbsent).length,
            absentBoys: boys.filter(isAbsent).length,
            total: teamChildren.length,
            absent: teamChildren.filter(isAbsent).length,
          }
        })
        setSummary(result)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [today])

  const totals = summary.reduce((acc, t) => ({
    totalGirls: acc.totalGirls + t.totalGirls,
    totalBoys: acc.totalBoys + t.totalBoys,
    absentGirls: acc.absentGirls + t.absentGirls,
    absentBoys: acc.absentBoys + t.absentBoys,
    total: acc.total + t.total,
    absent: acc.absent + t.absent,
  }), { totalGirls: 0, totalBoys: 0, absentGirls: 0, absentBoys: 0, total: 0, absent: 0 })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Панель администратора</h1>
        <p className="text-gray-500 mt-1">Сводка посещаемости на {todayLabel}</p>
      </div>

      {/* Total stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Всего детей" value={totals.total} icon={<Users className="w-5 h-5 text-blue-600" />} color="blue" />
        <StatCard label="Присутствуют" value={totals.total - totals.absent} icon={<UserCheck className="w-5 h-5 text-green-600" />} color="green" />
        <StatCard label="Отсутствуют" value={totals.absent} icon={<UserX className="w-5 h-5 text-red-500" />} color="red" />
        <StatCard label="Команд" value={summary.length} icon={<BarChart2 className="w-5 h-5 text-purple-600" />} color="purple" />
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-lg">По командам</h2>
        </div>
        {loading ? (
          <div className="text-center py-10 text-gray-400">Загрузка...</div>
        ) : summary.length === 0 ? (
          <div className="text-center py-10 text-gray-400">Нет данных. Создайте команды в разделе "Команды".</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Команда</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">♀ Всего</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">♂ Всего</th>
                  <th className="text-center px-4 py-3 font-medium text-red-500">♀ Отсутств.</th>
                  <th className="text-center px-4 py-3 font-medium text-red-500">♂ Отсутств.</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Итого</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Присутств.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summary.map(t => (
                  <tr key={t.teamId} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-semibold">Команда №{t.number}</td>
                    <td className="text-center px-4 py-3 text-pink-600">{t.totalGirls}</td>
                    <td className="text-center px-4 py-3 text-blue-600">{t.totalBoys}</td>
                    <td className="text-center px-4 py-3">
                      {t.absentGirls > 0 ? <span className="badge-red">{t.absentGirls}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="text-center px-4 py-3">
                      {t.absentBoys > 0 ? <span className="badge-red">{t.absentBoys}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="text-center px-4 py-3 font-medium">{t.total}</td>
                    <td className="text-center px-4 py-3">
                      <span className={t.absent > 0 ? 'badge-yellow' : 'badge-green'}>
                        {t.total - t.absent}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                <tr>
                  <td className="px-6 py-3">ИТОГО</td>
                  <td className="text-center px-4 py-3 text-pink-600">{totals.totalGirls}</td>
                  <td className="text-center px-4 py-3 text-blue-600">{totals.totalBoys}</td>
                  <td className="text-center px-4 py-3 text-red-500">{totals.absentGirls}</td>
                  <td className="text-center px-4 py-3 text-red-500">{totals.absentBoys}</td>
                  <td className="text-center px-4 py-3">{totals.total}</td>
                  <td className="text-center px-4 py-3">{totals.total - totals.absent}</td>
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
  const colors = {
    blue: 'bg-blue-50',
    green: 'bg-green-50',
    red: 'bg-red-50',
    purple: 'bg-purple-50',
  }
  return (
    <div className="card flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg ${colors[color]} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  )
}
