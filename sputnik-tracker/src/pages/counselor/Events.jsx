import { useEffect, useState } from 'react'
import {
  collection, getDocs, query, orderBy, where, addDoc, updateDoc, doc, serverTimestamp
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { blockVisibleForBrigade } from '../../utils/brigade'
import { Star, Save, CheckCircle } from 'lucide-react'

export default function CounselorEvents() {
  const { userProfile } = useAuth()
  const [events, setEvents] = useState([])
  const [mySubmissions, setMySubmissions] = useState({}) // eventId -> submission
  const [drafts, setDrafts] = useState({}) // eventId -> text
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null) // eventId being saved
  const [savedId, setSavedId] = useState(null)

  const teamId = userProfile?.teamId
  const teamNumber = userProfile?.teamNumber
  const brigadeId = userProfile?.brigadeId

  useEffect(() => {
    async function load() {
      if (!teamId) return
      try {
        const [eventsSnap, subsSnap] = await Promise.all([
          getDocs(query(collection(db, 'events'), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'eventSubmissions'), where('teamId', '==', teamId))),
        ])
        // Filter events by brigade
        const allEvents = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        setEvents(allEvents.filter(ev => blockVisibleForBrigade(ev.brigadeGroup || 'all', brigadeId)))
        const subs = {}
        const initDrafts = {}
        subsSnap.docs.forEach(d => {
          const data = { id: d.id, ...d.data() }
          subs[data.eventId] = data
          initDrafts[data.eventId] = data.performanceName || ''
        })
        setMySubmissions(subs)
        setDrafts(initDrafts)
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    load()
  }, [teamId])

  async function saveSubmission(eventId) {
    const text = drafts[eventId]?.trim()
    if (!text) return
    setSaving(eventId)
    try {
      const existing = mySubmissions[eventId]
      if (existing) {
        await updateDoc(doc(db, 'eventSubmissions', existing.id), {
          performanceName: text, updatedAt: serverTimestamp(), updatedBy: userProfile.uid,
        })
        setMySubmissions(prev => ({ ...prev, [eventId]: { ...existing, performanceName: text } }))
      } else {
        const ref = await addDoc(collection(db, 'eventSubmissions'), {
          eventId, teamId, teamNumber, performanceName: text,
          submittedAt: serverTimestamp(), submittedBy: userProfile.uid,
        })
        setMySubmissions(prev => ({ ...prev, [eventId]: { id: ref.id, eventId, teamId, teamNumber, performanceName: text } }))
      }
      setSavedId(eventId)
      setTimeout(() => setSavedId(null), 3000)
    } catch (err) { console.error(err); alert('Ошибка при сохранении') }
    finally { setSaving(null) }
  }

  if (loading) return <div className="text-center py-16 text-gray-400">Загрузка...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Мероприятия</h1>
        <p className="text-gray-500 mt-1">Команда №{teamNumber} — внесите название вашего номера</p>
      </div>

      {events.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <Star className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>Мероприятия пока не добавлены администрацией</p>
        </div>
      ) : (
        events.map(event => {
          const submitted = mySubmissions[event.id]
          const isSaved = savedId === event.id
          return (
            <div key={event.id} className="card">
              <div className="flex items-start gap-3 mb-4">
                <Star className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-semibold text-lg">{event.name}</h2>
                  {event.description && <p className="text-gray-500 text-sm mt-1">{event.description}</p>}
                </div>
                {submitted && <span className="ml-auto badge-green text-xs flex-shrink-0">Подано</span>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Название номера команды №{teamNumber}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input"
                    value={drafts[event.id] || ''}
                    onChange={e => setDrafts(prev => ({ ...prev, [event.id]: e.target.value }))}
                    placeholder="Введите название вашего номера..."
                    onKeyDown={e => e.key === 'Enter' && saveSubmission(event.id)}
                  />
                  <button
                    onClick={() => saveSubmission(event.id)}
                    disabled={saving === event.id || !drafts[event.id]?.trim()}
                    className="btn-primary flex items-center gap-2 flex-shrink-0"
                  >
                    <Save className="w-4 h-4" />
                    {saving === event.id ? 'Сохраняем...' : submitted ? 'Обновить' : 'Сохранить'}
                  </button>
                </div>
                {isSaved && (
                  <div className="flex items-center gap-1.5 text-green-600 text-sm mt-2">
                    <CheckCircle className="w-4 h-4" /> Сохранено
                  </div>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
