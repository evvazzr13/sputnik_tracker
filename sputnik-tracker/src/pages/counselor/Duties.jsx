import { useEffect, useState, useCallback } from 'react'
import {
  collection, getDocs, addDoc, deleteDoc, doc, query,
  where, orderBy, serverTimestamp, getDoc, updateDoc, setDoc
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { useSeason } from '../../contexts/SeasonContext'
import { format, parseISO, eachDayOfInterval } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Moon, Sun, Music, Trash2, CheckCircle, Lock } from 'lucide-react'

const STAGE_MORNING = ['10:30','11:00','11:30','12:00','12:30']
const STAGE_EVENING = ['16:30','17:00','17:30','18:00','18:30']

export default function Duties() {
  const { userProfile } = useAuth()
  const { activeSeason } = useSeason()
  const [activeTab, setActiveTab] = useState('night')

  const tabs = [
    { id: 'night', label: 'Ночные дежурства', icon: Moon },
    { id: 'dayoff', label: 'Выходные', icon: Sun },
    { id: 'stage', label: 'Бронь эстрады', icon: Music },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Запись</h1>

      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors
              ${activeTab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {!activeSeason ? (
        <div className="card text-center py-8 text-gray-400">Нет активной смены</div>
      ) : (
        <>
          {activeTab === 'night' && <NightDuties userProfile={userProfile} activeSeason={activeSeason} />}
          {activeTab === 'dayoff' && <DaysOff userProfile={userProfile} activeSeason={activeSeason} />}
          {activeTab === 'stage' && <StageBooking userProfile={userProfile} activeSeason={activeSeason} />}
        </>
      )}
    </div>
  )
}

// ─── Night Duties ──────────────────────────────────────────────
function NightDuties({ userProfile, activeSeason }) {
  const [duties, setDuties] = useState([])
  const [brigadeMembers, setBrigadeMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  const brigadeId = userProfile?.brigadeId
  const seasonId = activeSeason.id

  const seasonDates = getSeasonDates(activeSeason)

  const loadDuties = useCallback(async () => {
    if (!brigadeId) return
    setLoading(true)
    try {
      const [dutiesSnap, membersSnap] = await Promise.all([
        getDocs(query(collection(db, 'nightDuties'), where('seasonId', '==', seasonId), where('brigadeId', '==', brigadeId))),
        getDocs(query(collection(db, 'users'), where('role', '==', 'counselor'), where('brigadeId', '==', brigadeId))),
      ])
      setDuties(dutiesSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setBrigadeMembers(membersSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [seasonId, brigadeId])

  useEffect(() => { loadDuties() }, [loadDuties])

  async function toggleDuty(date) {
    const myDuty = duties.find(d => d.date === date && d.userId === userProfile.uid)
    if (myDuty) {
      await deleteDoc(doc(db, 'nightDuties', myDuty.id))
      setDuties(prev => prev.filter(d => d.id !== myDuty.id))
      return
    }
    const dayDuties = duties.filter(d => d.date === date)
    if (dayDuties.length >= 2) return
    setSaving(date)
    try {
      const ref = await addDoc(collection(db, 'nightDuties'), {
        seasonId, brigadeId, date,
        userId: userProfile.uid, fullName: userProfile.fullName,
        teamNumber: userProfile.teamNumber, createdAt: serverTimestamp(),
      })
      setDuties(prev => [...prev, { id: ref.id, seasonId, brigadeId, date, userId: userProfile.uid, fullName: userProfile.fullName }])
    } catch (err) { console.error(err) }
    finally { setSaving(null) }
  }

  if (!brigadeId) return <div className="card text-center py-8 text-gray-400">Дружина не назначена</div>
  if (loading) return <div className="text-center py-8 text-gray-400">Загрузка...</div>

  return (
    <div className="card overflow-x-auto">
      <h2 className="font-semibold mb-1">{userProfile.brigadeName} — Ночные дежурства</h2>
      <p className="text-sm text-gray-500 mb-4">Максимум 2 дежурных в одну ночь. Нажмите на дату, чтобы записаться.</p>
      <div className="space-y-2">
        {seasonDates.map(date => {
          const dayDuties = duties.filter(d => d.date === date)
          const isMine = dayDuties.some(d => d.userId === userProfile.uid)
          const isFull = dayDuties.length >= 2 && !isMine
          const dateLabel = format(parseISO(date), 'd MMMM (EEEE)', { locale: ru })
          return (
            <div key={date} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors
              ${isMine ? 'bg-blue-50 border-blue-200' : isFull ? 'bg-gray-50 border-gray-200' : 'border-gray-100 hover:bg-gray-50'}`}>
              <button onClick={() => !isFull && toggleDuty(date)} disabled={isFull || saving === date}
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors
                  ${isMine ? 'bg-blue-600 text-white' : isFull ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'border-2 border-gray-300 hover:border-blue-400'}`}>
                {isMine ? <CheckCircle className="w-4 h-4" /> : isFull ? <Lock className="w-4 h-4" /> : null}
              </button>
              <div className="flex-1">
                <div className="font-medium text-sm">{dateLabel}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {dayDuties.length === 0 ? 'Свободно' : dayDuties.map(d => d.fullName).join(', ')}
                  {dayDuties.length < 2 && dayDuties.length > 0 ? ` (ещё ${2 - dayDuties.length} место)` : ''}
                  {isFull ? ' — занято' : ''}
                </div>
              </div>
              <span className={`text-xs font-medium ${dayDuties.length >= 2 ? 'text-red-500' : 'text-green-600'}`}>
                {dayDuties.length}/2
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Days Off ─────────────────────────────────────────────────
function DaysOff({ userProfile, activeSeason }) {
  const [daysOff, setDaysOff] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [editingDate, setEditingDate] = useState(null)
  const [startTime, setStartTime] = useState('09:00')

  const brigadeId = userProfile?.brigadeId
  const seasonId = activeSeason.id
  const seasonDates = getSeasonDates(activeSeason)

  const loadDaysOff = useCallback(async () => {
    if (!brigadeId) return
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'daysOff'), where('seasonId', '==', seasonId), where('brigadeId', '==', brigadeId)))
      setDaysOff(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [seasonId, brigadeId])

  useEffect(() => { loadDaysOff() }, [loadDaysOff])

  const MAX_DAYS_OFF = 2
  const myDaysOffCount = daysOff.filter(d => d.userId === userProfile.uid).length
  const limitReached = myDaysOffCount >= MAX_DAYS_OFF

  async function saveDayOff(date) {
    const myDayOff = daysOff.find(d => d.date === date && d.userId === userProfile.uid)
    if (myDayOff) {
      await deleteDoc(doc(db, 'daysOff', myDayOff.id))
      setDaysOff(prev => prev.filter(d => d.id !== myDayOff.id))
      setEditingDate(null)
      return
    }
    if (limitReached) return
    setSaving(date)
    try {
      const ref = await addDoc(collection(db, 'daysOff'), {
        seasonId, brigadeId, date, startTime,
        userId: userProfile.uid, fullName: userProfile.fullName,
        teamNumber: userProfile.teamNumber, createdAt: serverTimestamp(),
      })
      setDaysOff(prev => [...prev, { id: ref.id, seasonId, brigadeId, date, startTime, userId: userProfile.uid, fullName: userProfile.fullName }])
      setEditingDate(null)
    } catch (err) { console.error(err) }
    finally { setSaving(null) }
  }

  if (!brigadeId) return <div className="card text-center py-8 text-gray-400">Дружина не назначена</div>
  if (loading) return <div className="text-center py-8 text-gray-400">Загрузка...</div>

  return (
    <div className="card overflow-x-auto">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold">{userProfile.brigadeName} — Выходные дни</h2>
        <span className={`text-sm font-medium px-3 py-1 rounded-full ${limitReached ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {myDaysOffCount}/{MAX_DAYS_OFF} использовано
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {limitReached
          ? '⚠️ Лимит выходных на смену исчерпан. Вы можете отменить уже записанный выходной.'
          : `Нажмите на дату чтобы записать выходной (ровно 24 часа). Лимит: ${MAX_DAYS_OFF} выходных за смену.`}
      </p>
      <div className="space-y-2">
        {seasonDates.map(date => {
          const myDayOff = daysOff.find(d => d.date === date && d.userId === userProfile.uid)
          const allOnDate = daysOff.filter(d => d.date === date)
          const dateLabel = format(parseISO(date), 'd MMMM (EEEE)', { locale: ru })
          const canBook = !limitReached || !!myDayOff
          return (
            <div key={date} className={`p-3 rounded-lg border transition-colors
              ${myDayOff ? 'bg-green-50 border-green-200' : !canBook ? 'bg-gray-50 border-gray-100 opacity-60' : 'border-gray-100 hover:bg-gray-50'}`}>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => canBook && (myDayOff ? saveDayOff(date) : setEditingDate(editingDate === date ? null : date))}
                  disabled={!canBook}
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors
                    ${myDayOff ? 'bg-green-600 text-white' : !canBook ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'border-2 border-gray-300 hover:border-green-400'}`}>
                  {myDayOff && <CheckCircle className="w-4 h-4" />}
                  {!myDayOff && !canBook && <Lock className="w-4 h-4" />}
                </button>
                <div className="flex-1">
                  <div className="font-medium text-sm">{dateLabel}</div>
                  {myDayOff && <div className="text-xs text-green-600">Вы: с {myDayOff.startTime}</div>}
                  {allOnDate.filter(d => d.userId !== userProfile.uid).length > 0 && (
                    <div className="text-xs text-gray-400">{allOnDate.filter(d => d.userId !== userProfile.uid).map(d => d.fullName).join(', ')}</div>
                  )}
                </div>
              </div>
              {editingDate === date && !myDayOff && canBook && (
                <div className="mt-2 flex items-center gap-2 pl-11">
                  <span className="text-sm text-gray-600">Начало выходного:</span>
                  <input type="time" className="input w-28 text-sm py-1" value={startTime} onChange={e => setStartTime(e.target.value)} />
                  <button onClick={() => saveDayOff(date)} disabled={saving === date} className="btn-primary text-sm px-3 py-1.5">
                    {saving === date ? '...' : 'Сохранить'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Stage Booking ────────────────────────────────────────────
function StageBooking({ userProfile, activeSeason }) {
  const [events, setEvents] = useState([])
  const [slots, setSlots] = useState({}) // eventId → {time → bookingDoc | null}
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const seasonId = activeSeason.id

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [eventsSnap, slotsSnap, bookingsSnap] = await Promise.all([
        getDocs(query(collection(db, 'stageEvents'), where('isOpen', '==', true))),
        getDocs(collection(db, 'stageSlots')),
        getDocs(query(collection(db, 'stageBookings'), where('seasonId', '==', seasonId))),
      ])
      const evs = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      setEvents(evs)

      const slotsByEvent = {}
      slotsSnap.docs.forEach(d => {
        const data = d.data()
        if (!slotsByEvent[data.eventId]) slotsByEvent[data.eventId] = {}
        slotsByEvent[data.eventId][data.time] = { slotId: d.id, ...data, booking: null }
      })
      bookingsSnap.docs.forEach(d => {
        const data = d.data()
        if (slotsByEvent[data.eventId]?.[data.time]) {
          slotsByEvent[data.eventId][data.time].booking = { id: d.id, ...data }
        }
      })
      setSlots(slotsByEvent)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [seasonId])

  useEffect(() => { loadData() }, [loadData])

  async function bookSlot(eventId, time, slotId) {
    const myBooking = Object.values(slots[eventId] || {}).find(s => s.booking?.teamId === userProfile.teamId)
    if (myBooking) { alert('Ваша команда уже забронировала слот для этого мероприятия'); return }
    const existing = slots[eventId]?.[time]?.booking
    if (existing) { alert('Этот слот уже занят'); return }
    setSaving(`${eventId}_${time}`)
    try {
      await addDoc(collection(db, 'stageBookings'), {
        eventId, slotId, time, seasonId,
        teamId: userProfile.teamId, teamNumber: userProfile.teamNumber,
        brigadeId: userProfile.brigadeId, createdAt: serverTimestamp(),
      })
      await loadData()
    } catch (err) { console.error(err) }
    finally { setSaving(null) }
  }

  async function cancelBooking(bookingId, eventId, time) {
    if (!confirm('Отменить бронь?')) return
    await deleteDoc(doc(db, 'stageBookings', bookingId))
    setSlots(prev => ({
      ...prev,
      [eventId]: { ...prev[eventId], [time]: { ...prev[eventId][time], booking: null } }
    }))
  }

  if (loading) return <div className="text-center py-8 text-gray-400">Загрузка...</div>
  if (events.length === 0) return (
    <div className="card text-center py-8 text-gray-400">
      <Music className="w-10 h-10 mx-auto mb-2 opacity-40" />
      <p>Бронь эстрады пока не открыта</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {events.map(event => {
        const eventSlots = slots[event.id] || {}
        const myBooking = Object.values(eventSlots).find(s => s.booking?.teamId === userProfile.teamId)
        const slotTimes = [...STAGE_MORNING, ...STAGE_EVENING].filter(t => eventSlots[t])

        return (
          <div key={event.id} className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold">{event.name}</h2>
                <p className="text-sm text-gray-500">{event.date}</p>
              </div>
              {myBooking && <span className="badge-green text-xs">Забронировано: {myBooking.booking.time}</span>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Утро (10:30–13:00)', times: STAGE_MORNING.filter(t => eventSlots[t]) },
                { label: 'Вечер (16:30–19:00)', times: STAGE_EVENING.filter(t => eventSlots[t]) },
              ].map(({ label, times }) => times.length > 0 && (
                <div key={label}>
                  <div className="text-xs font-medium text-gray-500 mb-2">{label}</div>
                  <div className="space-y-1.5">
                    {times.map(time => {
                      const slot = eventSlots[time]
                      const isBooked = !!slot?.booking
                      const isMine = slot?.booking?.teamId === userProfile.teamId
                      const isSaving = saving === `${event.id}_${time}`
                      return (
                        <div key={time} className={`flex items-center justify-between p-2 rounded-lg text-sm
                          ${isMine ? 'bg-blue-50 border border-blue-200' : isBooked ? 'bg-red-50 border border-red-100' : 'border border-gray-200 hover:bg-gray-50'}`}>
                          <span className="font-mono font-medium">{time}</span>
                          {isMine ? (
                            <div className="flex items-center gap-2">
                              <span className="text-blue-600 text-xs">Ваша команда</span>
                              <button onClick={() => cancelBooking(slot.booking.id, event.id, time)} className="text-red-400 hover:text-red-600 text-xs">Отмена</button>
                            </div>
                          ) : isBooked ? (
                            <span className="text-red-500 text-xs">Команда №{slot.booking.teamNumber}</span>
                          ) : (
                            <button onClick={() => bookSlot(event.id, time, slot.slotId)} disabled={!!myBooking || isSaving}
                              className={`text-xs px-2 py-0.5 rounded ${myBooking ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-100'}`}>
                              {isSaving ? '...' : 'Забронировать'}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function getSeasonDates(season) {
  try {
    const days = eachDayOfInterval({ start: parseISO(season.startDate), end: parseISO(season.endDate) })
    return days.map(d => format(d, 'yyyy-MM-dd'))
  } catch { return [] }
}
