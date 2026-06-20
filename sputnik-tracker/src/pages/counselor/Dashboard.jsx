import { useEffect, useState } from 'react'
import { collection, getDocs, doc, getDoc, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Clock, Calendar, CalendarDays, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DayInfoPreview } from '../admin/DayPlan'

export default function CounselorDashboard() {
  const { userProfile } = useAuth()
  const [todayPlan, setTodayPlan] = useState(null)
  const [fixedBlocks, setFixedBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  const today = format(new Date(), 'yyyy-MM-dd')
  const todayLabel = format(new Date(), 'd MMMM yyyy', { locale: ru })

  useEffect(() => {
    async function load() {
      try {
        const [fixedSnap, planSnap] = await Promise.all([
          getDocs(query(collection(db, 'fixedBlocks'), orderBy('order'))),
          getDoc(doc(db, 'dayPlans', today)),
        ])
        setFixedBlocks(fixedSnap.docs.map(d => ({ id: d.id, ...d.data(), isFixed: true })))
        if (planSnap.exists()) setTodayPlan(planSnap.data())
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    load()
  }, [today])

  const allBlocks = [...fixedBlocks, ...(todayPlan?.blocks || [])].sort((a, b) => a.time.localeCompare(b.time))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Добро пожаловать, {userProfile?.fullName?.split(' ')[1] || 'вожатый'}!</h1>
        <p className="text-gray-500 mt-1">Команда №{userProfile?.teamNumber} · {todayLabel}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/counselor/team" className="card hover:shadow-md transition-shadow flex items-center gap-4 group">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <CalendarDays className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">Моя команда</div>
            <div className="text-sm text-gray-500">Список детей и посещаемость</div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
        </Link>
        <Link to="/counselor/events" className="card hover:shadow-md transition-shadow flex items-center gap-4 group">
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-6 h-6 text-green-600" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">Мероприятия</div>
            <div className="text-sm text-gray-500">Номер вашей команды</div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-green-600 transition-colors" />
        </Link>
        <Link to="/counselor/schedule" className="card hover:shadow-md transition-shadow flex items-center gap-4 group">
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
            <Clock className="w-6 h-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">История планов</div>
            <div className="text-sm text-gray-500">Планы за прошлые дни</div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
        </Link>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            План дня — {todayLabel}
          </h2>
          {todayPlan?.publishedAt && <span className="badge-green">Опубликован</span>}
        </div>

        {loading ? (
          <div className="py-8 text-center text-gray-400">Загрузка...</div>
        ) : (
          <>
            <DayInfoPreview theme={todayPlan?.theme} dutyTeams={todayPlan?.dutyTeams} reminders={todayPlan?.reminders} />
            {allBlocks.length === 0 ? (
              <div className="py-8 text-center text-gray-400">
                <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p>План дня ещё не опубликован</p>
              </div>
            ) : (
              <div className="space-y-1 mt-3">
                {allBlocks.map((block, i) => (
                  <div key={block.id || i} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                    <span className="text-sm font-mono text-blue-700 font-semibold w-12 flex-shrink-0 pt-0.5">{block.time}</span>
                    <span className="text-gray-800">{block.title}</span>
                    {block.isFixed && <span className="ml-auto badge-gray text-xs flex-shrink-0">постоянно</span>}
                    {block.eventId && <span className="ml-auto badge-blue text-xs flex-shrink-0">мероприятие</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
