import { useEffect, useState } from 'react'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { format, parseISO, addDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Clock, Calendar, CalendarDays, ChevronRight, Sparkles, ChevronLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DayInfoPreview } from '../admin/DayPlan'
import { blockVisibleForBrigade, BRIGADE_GROUPS } from '../../utils/brigade'

export default function CounselorDashboard() {
  const { userProfile } = useAuth()
  const [allPlans, setAllPlans] = useState([])
  const [fixedBlocks, setFixedBlocks] = useState([])
  const [hasEventInPlan, setHasEventInPlan] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)

  const today = format(new Date(), 'yyyy-MM-dd')
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
  const todayLabel = format(new Date(), 'd MMMM yyyy', { locale: ru })
  const myBrigadeId = userProfile?.brigadeId

  // Tomorrow's plan is available after 23:30
  const now = new Date()
  const tomorrowAvailable = now.getHours() > 23 || (now.getHours() === 23 && now.getMinutes() >= 30)

  useEffect(() => {
    async function load() {
      try {
        const [fixedSnap, plansSnap] = await Promise.all([
          getDocs(query(collection(db, 'fixedBlocks'), orderBy('order'))),
          getDocs(query(collection(db, 'dayPlans'), where('isPublished', '==', true), orderBy('date', 'asc'))),
        ])
        setFixedBlocks(fixedSnap.docs.map(d => ({ id: d.id, ...d.data(), isFixed: true })))

        let plans = plansSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        // Filter out tomorrow if not available yet
        if (!tomorrowAvailable) {
          plans = plans.filter(p => p.date <= today)
        }
        setAllPlans(plans)

        // Default: today's plan (or latest past)
        const todayPlan = plans.find(p => p.date === today)
        setSelectedDate(todayPlan ? today : (plans[plans.length - 1]?.date || null))
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    load()
  }, [today, tomorrowAvailable, myBrigadeId])

  const activePlan = allPlans.find(p => p.date === selectedDate)

  useEffect(() => {
    if (!activePlan) { setHasEventInPlan(false); return }
    const visible = (activePlan.blocks || []).filter(b =>
      b.eventId && blockVisibleForBrigade(b.brigadeGroup, myBrigadeId)
    )
    setHasEventInPlan(visible.length > 0)
  }, [activePlan, myBrigadeId])

  const myBlocks = [
    ...fixedBlocks.filter(b => blockVisibleForBrigade(b.brigadeGroup, myBrigadeId)),
    ...(activePlan?.blocks || []).filter(b => blockVisibleForBrigade(b.brigadeGroup, myBrigadeId)),
  ].sort((a, b) => a.time.localeCompare(b.time))

  function formatDateLabel(dateStr) {
    if (!dateStr) return ''
    try {
      if (dateStr === today) return 'Сегодня'
      if (dateStr === tomorrow) return 'Завтра'
      return format(parseISO(dateStr), 'd MMMM', { locale: ru })
    } catch { return dateStr }
  }

  function getBrigadeLabel(brigadeGroup) {
    if (!brigadeGroup || brigadeGroup === 'all') return null
    return BRIGADE_GROUPS.find(g => g.value === brigadeGroup)?.label
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Добро пожаловать, {userProfile?.fullName?.split(' ')[1] || 'вожатый'}!
        </h1>
        <p className="text-gray-500 mt-1">
          Команда №{userProfile?.teamNumber}
          {userProfile?.brigadeName && <span className="ml-1 text-gray-400">· {userProfile.brigadeName}</span>}
          {' '}· {todayLabel}
        </p>
      </div>

      {/* Quick links */}
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

      {/* Day plan */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            План дня
          </h2>

          {/* Date tabs */}
          {allPlans.length > 0 && (
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {allPlans.map(plan => (
                <button
                  key={plan.date}
                  onClick={() => setSelectedDate(plan.date)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                    ${selectedDate === plan.date
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {formatDateLabel(plan.date)}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-8 text-center text-gray-400">Загрузка...</div>
        ) : !activePlan ? (
          <div className="py-8 text-center text-gray-400">
            <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>
              {allPlans.length === 0
                ? 'План дня ещё не опубликован'
                : 'Выберите дату выше'}
            </p>
            {!tomorrowAvailable && (
              <p className="text-sm mt-1 text-gray-400">План на завтра станет доступен в 23:30</p>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-gray-500">
                {format(parseISO(activePlan.date), 'd MMMM yyyy (EEEE)', { locale: ru })}
              </span>
              <span className="badge-green text-xs">Опубликован</span>
              {activePlan.date === tomorrow && <span className="badge-blue text-xs">На завтра</span>}
            </div>

            <DayInfoPreview
              theme={activePlan.theme}
              dutyTeams={activePlan.dutyTeams}
              reminders={activePlan.reminders}
            />

            {myBlocks.length === 0 ? (
              <div className="py-4 text-center text-gray-400 text-sm">Нет событий для вашей дружины</div>
            ) : (
              <div className="space-y-1 mt-3">
                {myBlocks.map((block, i) => {
                  const brigLabel = getBrigadeLabel(block.brigadeGroup)
                  return (
                    <div key={block.id || i} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                      <span className="text-sm font-mono text-blue-700 font-semibold w-12 flex-shrink-0 pt-0.5">
                        {block.time}
                      </span>
                      <span className="text-gray-800 flex-1">{block.title}</span>
                      {/* Only show brigade badge if event is for specific brigades, NOT for all */}
                      {brigLabel && (
                        <span className="ml-auto badge-yellow text-xs flex-shrink-0">{brigLabel}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
