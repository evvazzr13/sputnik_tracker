import { useEffect, useState } from 'react'
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, where, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, Trash2, ChevronDown, ChevronUp, Star } from 'lucide-react'

export default function AdminEvents() {
  const { userProfile } = useAuth()
  const [events, setEvents] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [eventsSnap, subsSnap, teamsSnap] = await Promise.all([
        getDocs(query(collection(db, 'events'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'eventSubmissions')),
        getDocs(query(collection(db, 'teams'), orderBy('number'))),
      ])
      setEvents(eventsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setSubmissions(subsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setTeams(teamsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  async function createEvent(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const ref = await addDoc(collection(db, 'events'), {
        name: form.name.trim(),
        description: form.description.trim(),
        createdAt: serverTimestamp(),
        createdBy: userProfile.uid,
      })
      setEvents(prev => [{ id: ref.id, name: form.name.trim(), description: form.description.trim() }, ...prev])
      setForm({ name: '', description: '' })
      setShowForm(false)
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  async function deleteEvent(eventId) {
    if (!confirm('Удалить мероприятие?')) return
    await deleteDoc(doc(db, 'events', eventId))
    setEvents(prev => prev.filter(e => e.id !== eventId))
  }

  function getEventSubmissions(eventId) {
    return submissions.filter(s => s.eventId === eventId)
  }

  if (loading) return <div className="text-center py-16 text-gray-400">Загрузка...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Мероприятия</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Добавить мероприятие
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h2 className="font-semibold mb-4">Новое мероприятие</h2>
          <form onSubmit={createEvent} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название мероприятия</label>
              <input type="text" className="input" required value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Например: Вечерний концерт" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
              <textarea className="input" rows={3} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Описание мероприятия, требования к номерам и т.д." />
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
          <Star className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>Мероприятия не созданы</p>
        </div>
      ) : (
        events.map(event => {
          const subs = getEventSubmissions(event.id)
          const isOpen = expanded === event.id
          return (
            <div key={event.id} className="card p-0 overflow-hidden">
              <div className="px-6 py-4 flex items-center justify-between">
                <button className="flex-1 text-left" onClick={() => setExpanded(isOpen ? null : event.id)}>
                  <div className="flex items-center gap-3">
                    <Star className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                    <div>
                      <div className="font-semibold">{event.name}</div>
                      {event.description && <div className="text-sm text-gray-500 mt-0.5">{event.description}</div>}
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-3 ml-4">
                  <span className="badge-blue text-xs">{subs.length} заявок</span>
                  <button onClick={() => setExpanded(isOpen ? null : event.id)} className="text-gray-400">
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button onClick={() => deleteEvent(event.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-gray-100 px-6 pb-4 pt-3">
                  <h3 className="font-medium text-sm text-gray-600 mb-3">Номера команд ({subs.length}):</h3>
                  {subs.length === 0 ? (
                    <div className="text-sm text-gray-400 italic">Команды ещё не подали заявки</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="text-left px-4 py-2 font-medium text-gray-600">Команда</th>
                            <th className="text-left px-4 py-2 font-medium text-gray-600">Название номера</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {subs.sort((a, b) => (a.teamNumber || 0) - (b.teamNumber || 0)).map(sub => (
                            <tr key={sub.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2 font-medium">Команда №{sub.teamNumber}</td>
                              <td className="px-4 py-2 text-gray-700">{sub.performanceName}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
