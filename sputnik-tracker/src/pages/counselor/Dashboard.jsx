import { useEffect, useState } from 'react'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Clock, Calendar, CalendarDays, ChevronRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DayInfoPreview } from '../admin/DayPlan'
import { blockVisibleForBrigade } from '../../utils/brigade'

export default function CounselorDashboard() {
  const { userProfile } = useAuth()
  const [activePlan, setActivePlan] = useState(null)
  const [planDateLabel, setPlanDateLabel] = useState('')
  const [fixedBlocks, setFixedBlocks] = useState([])
  const [hasEventInPlan, setHasEventInPlan] = useState(false)
  const [loading, setLoading] = useState(true)

  const today = format(new Date(), 'yyyy-MM-dd')
  const todayLabel = format(new Date(), 'd MMMM yyyy', { locale: ru })
  const myBrigadeId = userProfile?.brigadeId

  useEffect(() => {
    async function load() {
      try {
        const [fixedSnap, plansSnap] = await Promise.all([
          getDocs(query(collection(db, 'fixedBlocks'), orderBy('order'))),
          getDocs(query(collection(db, 'dayPlans'), where('isPublished', '==', true), orderBy('date', 'desc'))),
        ])
        setFixedBlocks(fixedSnap.docs.map(d => ({ id: d.id, ...d.data(), isFixed: true })))

        const plans = plansSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        const todayPlan = plans.find(p => p.date === today)
        const upcomingPlan = plans.find(p => p.date >= today)
        const chosen = todayPlan || upcomingPlan || plans[0] || null

        if (chosen) {
          setActivePlan(chosen)
          try { setPlanDateLabel(format(parseISO(chosen.date), 'd MMMM yyyy', { locale: ru })) }
          catch { setPlanDateLabel(chosen.date) }

          // Check if there's an event in plan visible to this brigade
          const visibleBlocks = (chosen.blocks || []).filter(b =>
            b.eventId && blockVisibleForBrigade(b.brigadeGroup, myBrigadeId)
          )
          setHasEventInPlan(visibleBlocks.length > 0)
        }
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    load()
  }, [today, myBrigadeId])

  // Filter blocks by brigade
  const myBlocks = [
    ...fixedBlocks.filter(b => blockVisibleForBrigade(b.brigadeGroup, myBrigadeId)),
    ...(activePlan?.blocks || []).filter(b => blockVisibleForBrigade(b.brigadeGroup, myBrigadeId)),
  ].sort((a, b) => a.time.localeCompare(b.time))

  const isTomorrow = activePlan && activePlan.date !== today

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Добро пожаловать, {userProfile?.fullName?.split(' ')[1] || 'вожатый'}!</h1>
        <p className="text-gray-500 mt-1">
          Команда №{userProfile?.teamNumber}
          {userProfile?.brigadeName && <span className="ml-1 text-gray-400">· {userProfile.brigadeName}</span>}
          {' '}· {todayLabel}
        </p>
      </div>

      <div className={`grid grid-cols-1 gap-4 ${hasEventInPlan ? 'sm:grid-cols-2' : 'sm:grid-cols-1 max-w-xs'}`}>
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

        {hasEventInPlan && (
          <Link to="/counselor/events" className="card hover:shadow-md transition-shadow flex items-center gap-4 group">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">Мероприятия</div>
              <div className="text-sm text-gray-500">Внести название номера</div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-green-600 transition-colors" />
          </Link>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            {isTomorrow ? `План на завтра — ${planDateLabel}` : `План дня — ${planDateLabel || todayLabel}`}
          </h2>
          <div className="flex items-center gap-2">
            {isTomorrow && <span className="badge-blue">На завтра</span>}
            {activePlan && <span className="badge-green">Опубликован</span>}
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-gray-400">Загрузка...</div>
        ) : !activePlan ? (
          <div className="py-8 text-center text-gray-400">
            <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>План дня ещё не опубликован</p>
          </div>
        ) : (
          <>
            <DayInfoPreview theme={activePlan.theme} dutyTeams={activePlan.dutyTeams} reminders={activePlan.reminders} />
            {myBlocks.length === 0 ? (
              <div className="py-4 text-center text-gray-400 text-sm">Нет событий для вашей дружины</div>
            ) : (
              <div className="space-y-1 mt-3">
                {myBlocks.map((block, i) => (
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
