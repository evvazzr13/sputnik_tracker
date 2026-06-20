import { useEffect, useState } from 'react'
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { BRIGADES, BRIGADE_GROUPS, getBrigadeColor } from '../../utils/brigade'
import { Plus, Trash2, ChevronDown, ChevronUp, Star } from 'lucide-react'

export default function AdminEvents() {
  const { userProfile } = useAuth()
  const [events, setEvents] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', brigadeGroup: 'all' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [eventsSnap, subsSnap] = await Promise.all([
        getDocs(query(collection(db, 'events'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'eventSubmissions')),
      ])
      setEvents(eventsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setSubmissions(subsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  async function createEvent(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const ref = await addDoc(collection(db, 'events'), {
        name: form.name.trim(),
        description: form.description.trim(),
        brigadeGroup: form.brigadeGroup || 'all',
        createdAt: serverTimestamp(),
        createdBy: userProfile.uid,
      })
      setEvents(prev => [{ id: ref.id, ...form }, ...prev])
      setForm({ name: '', description: '', brigadeGroup: 'all' })
      setShowForm(false)
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  async function deleteEvent(eventId) {
    if (!confirm('Удалить мероприятие?')) return
    await deleteDoc(doc(db, 'events', eventId))
    setEvents(prev => prev.filter(e => e.id !== eventId))
  }

  function getEventSubmissionsByBrigade(event) {
    const subs = submissions.filter(s => s.eventId === event.id)
    // Filter which brigades are relevant based on event's brigadeGroup
    const relevantBrigades = BRIGADES.filter(brigade => {
      const bg = event.brigadeGroup || 'all'
      if (bg === 'all') return true
      if (bg === 'olimp_zvezda') return ['olimp', 'zvezda'].includes(brigade.id)
      if (bg === 'kosmos_solnyshko') return ['kosmos', 'solnyshko'].includes(brigade.id)
      return brigade.id === bg
    })
    return relevantBrigades.map(brigade => {
      const brigSubs = subs.filter(s => brigade.teams.includes(parseInt(s.teamNumber)))
        .sort((a, b) => (a.teamNumber || 0) - (b.teamNumber || 0))
      return { brigade, submissions: brigSubs }
    })
  }

  function getBrigadeLabel(brigadeGroup) {
    return BRIGADE_GROUPS.find(g => g.value === brigadeGroup)?.label || 'Все дружины'
  }

  if (loading) return <div className="text-center py-16 text-gray-400">Загрузка...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Мероприятия</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Добавить
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h2 className="font-semibold mb-4">Новое мероприятие</h2>
          <form onSubmit={createEvent} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
              <input type="text" className="input" required value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Вечерний концерт" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
              <textarea className="input" rows={2} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Требования к номерам..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Для какой дружины</label>
              <select className="input" value={form.brigadeGroup} onChange={e => setForm(f => ({ ...f, brigadeGroup: e.target.value }))}>
                {BRIGADE_GROUPS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Создаём...' : 'Создать'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Отмена</button>
            </div>
          </form>
        </div>
      )}

      {events.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <Star className="w-10 h-10 mx-auto mb-2 opacity-40" /><p>Нет мероприятий</p>
        </div>
      ) : events.map(event => {
        const byBrigade = getEventSubmissionsByBrigade(event)
        const totalSubs = submissions.filter(s => s.eventId === event.id).length
        const isOpen = expanded === event.id
        const bg = event.brigadeGroup || 'all'

        return (
          <div key={event.id} className="card p-0 overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between">
              <button className="flex-1 text-left" onClick={() => setExpanded(isOpen ? null : event.id)}>
                <div className="flex items-center gap-3">
                  <Star className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{event.name}</span>
                      {bg !== 'all' && (
                        <span className="badge-yellow text-xs">{getBrigadeLabel(bg)}</span>
                      )}
                    </div>
                    {event.description && <div className="text-sm text-gray-500 mt-0.5">{event.description}</div>}
                  </div>
                </div>
              </button>
              <div className="flex items-center gap-3 ml-4">
                <span className="badge-blue text-xs">{totalSubs} заявок</span>
                <button onClick={() => setExpanded(isOpen ? null : event.id)} className="text-gray-400">
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <button onClick={() => deleteEvent(event.id)} className="text-gray-300 hover:text-red-500 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {isOpen && (
              <div className="border-t border-gray-100 px-6 pb-5 pt-3">
                <h3 className="font-medium text-sm text-gray-600 mb-3">Номера команд по дружинам:</h3>
                <div className="space-y-4">
                  {byBrigade.map(({ brigade, submissions: subs }) => {
                    const colors = getBrigadeColor(brigade.id)
                    return (
                      <div key={brigade.id}>
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold mb-2 ${colors.badge}`}>
                          {brigade.name}
                        </div>
                        <div className="space-y-1">
                          {brigade.teams.map(teamNum => {
                            const sub = subs.find(s => parseInt(s.teamNumber) === teamNum)
                            return (
                              <div key={teamNum} className="flex items-center gap-3 text-sm py-0.5">
                                <span className="text-gray-500 w-24">Команда №{teamNum}</span>
                                {sub ? (
                                  <span className="font-medium text-gray-800">{sub.performanceName}</span>
                                ) : (
                                  <span className="text-gray-300 italic">—</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
