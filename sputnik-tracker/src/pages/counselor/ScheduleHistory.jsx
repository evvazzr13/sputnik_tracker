import { useEffect, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import { DayInfoPreview } from '../admin/DayPlan'

export default function ScheduleHistory() {
  const [plans, setPlans] = useState([])
  const [fixedBlocks, setFixedBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const [fixedSnap, planSnap] = await Promise.all([
          getDocs(query(collection(db, 'fixedBlocks'), orderBy('order'))),
          getDocs(query(collection(db, 'dayPlans'), orderBy('date', 'desc'))),
        ])
        const fixed = fixedSnap.docs.map(d => ({ id: d.id, ...d.data(), isFixed: true }))
        setFixedBlocks(fixed)
        const list = planSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.isPublished)
        setPlans(list)
        if (list.length > 0) setExpanded(list[0].id)
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  function getAllBlocks(plan) {
    return [...fixedBlocks, ...(plan.blocks || [])].sort((a, b) => a.time.localeCompare(b.time))
  }

  function formatDate(dateStr) {
    try { return format(parseISO(dateStr), 'd MMMM yyyy (EEEE)', { locale: ru }) }
    catch { return dateStr }
  }

  if (loading) return <div className="text-center py-16 text-gray-400">Загрузка...</div>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">История планов дня</h1>
        <p className="text-gray-500 mt-1">Опубликованные планы за всю смену</p>
      </div>

      {plans.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>Планы ещё не публиковались</p>
        </div>
      ) : (
        plans.map(plan => {
          const isOpen = expanded === plan.id
          const blocks = getAllBlocks(plan)
          const today = format(new Date(), 'yyyy-MM-dd')
          return (
            <div key={plan.id} className="card p-0 overflow-hidden">
              <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(isOpen ? null : plan.id)}>
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div className="text-left">
                    <span className="font-semibold">{formatDate(plan.id)}</span>
                    {plan.id === today && <span className="ml-2 badge-blue">Сегодня</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <span>{blocks.length} событий</span>
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-gray-100 px-6 pb-4 pt-3">
                  <DayInfoPreview theme={plan.theme} dutyTeams={plan.dutyTeams} reminders={plan.reminders} />
                  <div className="space-y-1 mt-2">
                    {blocks.map((block, i) => (
                      <div key={block.id || i} className="flex items-start gap-3 py-1.5">
                        <span className="text-sm font-mono text-blue-700 font-semibold w-12 flex-shrink-0">{block.time}</span>
                        <span className="text-gray-800 text-sm">{block.title}</span>
                        {block.isFixed && <span className="ml-auto badge-gray text-xs flex-shrink-0">постоянно</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
