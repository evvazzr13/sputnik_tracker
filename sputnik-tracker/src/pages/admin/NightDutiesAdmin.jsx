import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, addDoc, deleteDoc, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useSeason } from '../../contexts/SeasonContext'
import { BRIGADES, getBrigadeColor } from '../../utils/brigade'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Moon, Sun, Music, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'

const STAGE_MORNING = ['10:30','11:00','11:30','12:00','12:30']
const STAGE_EVENING = ['16:30','17:00','17:30','18:00','18:30']

export default function NightDutiesAdmin() {
  const { activeSeason } = useSeason()
  const [activeTab, setActiveTab] = useState('night')
  const [duties, setDuties] = useState([])
  const [daysOff, setDaysOff] = useState([])
  const [events, setEvents] = useState([])
  const [stageEvents, setStageEvents] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [newSlotEvent, setNewSlotEvent] = useState({ eventId: '', times: [] })

  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => { if (activeSeason) loadAll() }, [activeSeason])

  async function loadAll() {
    setLoading(true)
    try {
      const seasonId = activeSeason.id
      const [dutiesSnap, daysOffSnap, eventsSnap, stageSnap, bookingsSnap] = await Promise.all([
        getDocs(query(collection(db, 'nightDuties'), where('seasonId', '==', seasonId))),
        getDocs(query(collection(db, 'daysOff'), where('seasonId', '==', seasonId))),
        getDocs(collection(db, 'events')),
        getDocs(collection(db, 'stageEvents')),
        getDocs(query(collection(db, 'stageBookings'), where('seasonId', '==', seasonId))),
      ])
      setDuties(dutiesSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setDaysOff(daysOffSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setEvents(eventsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setStageEvents(stageSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setBookings(bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  async function toggleStageOpen(stageEventId, currentlyOpen) {
    await setDoc(doc(db, 'stageEvents', stageEventId), { isOpen: !currentlyOpen }, { merge: true })
    setStageEvents(prev => prev.map(e => e.id === stageEventId ? { ...e, isOpen: !currentlyOpen } : e))
  }

  async function createStageEvent(eventId) {
    const event = events.find(e => e.id === eventId)
    if (!event) return
    const ref = doc(collection(db, 'stageEvents'))
    await setDoc(ref, { eventId, name: event.name, date: today, isOpen: false, createdAt: serverTimestamp() })

    // Create default slots
    const defaultSlots = [...STAGE_MORNING, ...STAGE_EVENING]
    for (const time of defaultSlots) {
      await addDoc(collection(db, 'stageSlots'), { eventId: ref.id, time, isAvailable: true })
    }
    await loadAll()
  }

  async function removeSlot(slotId) {
    await deleteDoc(doc(db, 'stageSlots', slotId))
    await loadAll()
  }

  if (!activeSeason) return <div className="text-center py-16 text-gray-400">Нет активной смены</div>
  if (loading) return <div className="text-center py-16 text-gray-400">Загрузка...</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">График дежурств и бронь эстрады</h1>

      {/* Today's night duties banner */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {BRIGADES.map(brigade => {
          const todayDuties = duties.filter(d => d.date === today && d.brigadeId === brigade.id)
          const colors = getBrigadeColor(brigade.id)
          return (
            <div key={brigade.id} className={`rounded-xl border p-4 ${colors.bg} ${colors.border}`}>
              <div className="text-xs font-medium text-gray-500 mb-1">{format(new Date(), 'd MMMM', { locale: ru })}</div>
              <div className={`font-bold ${colors.text}`}>{brigade.short}</div>
              <div className="text-sm mt-1">
                <div className="text-xs text-gray-500 mb-0.5 flex items-center gap-1"><Moon className="w-3 h-3" /> Ночные:</div>
                {todayDuties.length === 0 ? (
                  <div className="text-xs text-gray-400 italic">Не назначены</div>
                ) : (
                  todayDuties.map(d => <div key={d.id} className="text-xs font-medium">{d.fullName}</div>)
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {[
          { id: 'night', label: 'Ночные дежурства', icon: Moon },
          { id: 'dayoff', label: 'Выходные', icon: Sun },
          { id: 'stage', label: 'Бронь эстрады', icon: Music },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors
              ${activeTab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {activeTab === 'night' && (
        <div className="space-y-4">
          {BRIGADES.map(brigade => {
            const brigDuties = duties.filter(d => d.brigadeId === brigade.id)
            const byDate = {}
            brigDuties.forEach(d => { if (!byDate[d.date]) byDate[d.date] = []; byDate[d.date].push(d) })
            const colors = getBrigadeColor(brigade.id)
            return (
              <div key={brigade.id} className={`card border ${colors.border}`}>
                <h2 className={`font-semibold mb-3 ${colors.text}`}>{brigade.name}</h2>
                {Object.keys(byDate).length === 0 ? (
                  <div className="text-sm text-gray-400 italic">Нет записей</div>
                ) : (
                  Object.entries(byDate).sort(([a],[b]) => a.localeCompare(b)).map(([date, ds]) => (
                    <div key={date} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                      <span className="text-sm font-medium w-36">{format(parseISO(date), 'd MMMM (EE)', { locale: ru })}</span>
                      <div className="flex gap-2 flex-wrap">
                        {ds.map(d => <span key={d.id} className="badge-blue text-xs">{d.fullName}</span>)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )
          })}
        </div>
      )}

      {activeTab === 'dayoff' && (
        <div className="space-y-4">
          {BRIGADES.map(brigade => {
            const brigOff = daysOff.filter(d => d.brigadeId === brigade.id)
            const byDate = {}
            brigOff.forEach(d => { if (!byDate[d.date]) byDate[d.date] = []; byDate[d.date].push(d) })
            const colors = getBrigadeColor(brigade.id)
            return (
              <div key={brigade.id} className={`card border ${colors.border}`}>
                <h2 className={`font-semibold mb-3 ${colors.text}`}>{brigade.name}</h2>
                {Object.keys(byDate).length === 0 ? (
                  <div className="text-sm text-gray-400 italic">Нет записей</div>
                ) : (
                  Object.entries(byDate).sort(([a],[b]) => a.localeCompare(b)).map(([date, ds]) => (
                    <div key={date} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                      <span className="text-sm font-medium w-36">{format(parseISO(date), 'd MMMM (EE)', { locale: ru })}</span>
                      <div className="flex gap-2 flex-wrap">
                        {ds.map(d => <span key={d.id} className="badge-green text-xs">{d.fullName} с {d.startTime}</span>)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )
          })}
        </div>
      )}

      {activeTab === 'stage' && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold mb-3">Открыть бронь эстрады для мероприятия</h2>
            <div className="flex gap-2">
              <select className="input" value={newSlotEvent.eventId} onChange={e => setNewSlotEvent(p => ({ ...p, eventId: e.target.value }))}>
                <option value="">— Выбрать мероприятие —</option>
                {events.filter(e => !stageEvents.find(se => se.eventId === e.id)).map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              <button onClick={() => newSlotEvent.eventId && createStageEvent(newSlotEvent.eventId)}
                disabled={!newSlotEvent.eventId} className="btn-primary whitespace-nowrap">Открыть бронь</button>
            </div>
          </div>

          {stageEvents.map(stageEvent => {
            const eventSlots = bookings.filter(b => b.eventId === stageEvent.id)
            return (
              <div key={stageEvent.id} className="card">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{stageEvent.name}</h3>
                    <span className="text-sm text-gray-500">{stageEvent.date}</span>
                  </div>
                  <button onClick={() => toggleStageOpen(stageEvent.id, stageEvent.isOpen)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${stageEvent.isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {stageEvent.isOpen ? <><ToggleRight className="w-4 h-4" /> Открыта</> : <><ToggleLeft className="w-4 h-4" /> Закрыта</>}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {[
                    { label: 'Утро', times: STAGE_MORNING },
                    { label: 'Вечер', times: STAGE_EVENING },
                  ].map(({ label, times }) => (
                    <div key={label}>
                      <div className="text-xs font-medium text-gray-500 mb-1">{label}</div>
                      {times.map(time => {
                        const booking = eventSlots.find(b => b.time === time)
                        return (
                          <div key={time} className={`flex items-center justify-between py-1.5 border-b border-gray-50 text-xs
                            ${booking ? 'text-blue-700' : 'text-gray-400'}`}>
                            <span className="font-mono">{time}</span>
                            {booking ? <span className="font-medium">Команда №{booking.teamNumber}</span> : <span>Свободно</span>}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
