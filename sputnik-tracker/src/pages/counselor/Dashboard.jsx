import { useEffect, useState } from 'react'
import { collection, getDocs, orderBy, query, where, doc, getDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { format, parseISO, addDays, subDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Clock, Calendar, CalendarDays, ChevronRight, Sparkles, ChevronLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DayInfoPreview } from '../admin/DayPlan'
import { blockVisibleForBrigade, BRIGADE_GROUPS } from '../../utils/brigade'

export default function CounselorDashboard() {
  const { userProfile } = useAuth()
  const [plansByDate, setPlansByDate] = useState({}) // date -> plan data
  const [fixedBlocks, setFixedBlocks] = useState([])
  const [hasEventInPlan, setHasEventInPlan] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const today = format(new Date(), 'yyyy-MM-dd')
  const todayLabel = format(new Date(), 'd MMMM yyyy', { locale: ru })
  const myBrigadeId = userProfile?.brigadeId

  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')

  useEffect(() => {
    async function load() {
      try {
        const [fixedSnap, plansSnap] = await Promise.all([
          getDocs(query(collection(db, 'fixedBlocks'), orderBy('order'))),
          getDocs(query(collection(db, 'dayPlans'), where('isPublished', '==', true))),
        ])
        setFixedBlocks(fixedSnap.docs.map(d => ({ id: d.id, ...d.data(), isFixed: true })))

        const byDate = {}
        plansSnap.docs.forEach(d => { byDate[d.id] = { id: d.id, ...d.data() } })
        setPlansByDate(byDate)
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const activePlan = plansByDate[selectedDate] || null

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
    if (dateStr === today) return 'Сегодня'
    if (dateStr === format(addDays(new Date(), 1), 'yyyy-MM-dd')) return 'Завтра'
    if (dateStr === format(subDays(new Date(), 1), 'yyyy-MM-dd')) return 'Вчера'
    try { return format(parseISO(dateStr), 'd MMM', { locale: ru }) }
    catch { return dateStr }
  }

  function getBrigadeLabel(brigadeGroup) {
    if (!brigadeGroup || brigadeGroup === 'all') return null
    return BRIGADE_GROUPS.find(g => g.value === brigadeGroup)?.label
  }

  function prevDate() {
    const d = subDays(parseISO(selectedDate), 1)
    setSelectedDate(format(d, 'yyyy-MM-dd'))
  }

  function nextDate() {
    const d = addDays(parseISO(selectedDate), 1)
    setSelectedDate(format(d, 'yyyy-MM-dd'))
  }

  // Can go next if there's a published plan for the next day
  const nextDayDate = format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd')
  const canGoNext = !!plansByDate[nextDayDate]

  // Show last 5 days + today + tomorrow if published
  const dateRange = []
  for (let i = 4; i >= 0; i--) {
    dateRange.push(format(subDays(new Date(), i), 'yyyy-MM-dd'))
  }
  // Add tomorrow tab only if a plan is published for it
  if (plansByDate[tomorrow]) {
    dateRange.push(tomorrow)
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

      {/* Day plan card */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            План дня
          </h2>
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-2 mb-4">
          <button onClick={prevDate} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>

          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-1 min-w-0">
              {dateRange.map(date => {
                const hasPlan = !!plansByDate[date]
                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors relative
                      ${selectedDate === date
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-500 hover:bg-gray-100 border border-gray-200'}`}
                  >
                    {formatDateLabel(date)}
                    {hasPlan && selectedDate !== date && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <button onClick={nextDate} disabled={!canGoNext}
            className={`p-1.5 rounded-lg border border-gray-200 transition-colors
              ${canGoNext ? 'hover:bg-gray-50' : 'opacity-30 cursor-not-allowed'}`}>
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="text-sm text-gray-400 mb-3">
          {format(parseISO(selectedDate), 'd MMMM yyyy (EEEE)', { locale: ru })}
        </div>

        {loading ? (
          <div className="py-8 text-center text-gray-400">Загрузка...</div>
        ) : !activePlan ? (
          <div className="py-6 text-center text-gray-400">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">План на этот день не опубликован</p>
          </div>
        ) : (
          <>
            <DayInfoPreview
              theme={activePlan.theme}
              dutyTeams={activePlan.dutyTeams}
              reminders={activePlan.reminders}
            />
            {myBlocks.length === 0 ? (
              <div className="py-4 text-center text-gray-400 text-sm">Нет событий для вашей дружины</div>
            ) : (
              <div className="space-y-1 mt-2">
                {myBlocks.map((block, i) => {
                  const brigLabel = getBrigadeLabel(block.brigadeGroup)
                  return (
                    <div key={block.id || i} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                      <span className="text-sm font-mono text-blue-700 font-semibold w-12 flex-shrink-0 pt-0.5">
                        {block.time}
                      </span>
                      <span className="text-gray-800 flex-1">{block.title}</span>
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
