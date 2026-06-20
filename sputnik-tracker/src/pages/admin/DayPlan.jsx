import { useEffect, useState } from 'react'
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, setDoc, getDoc, orderBy, query, serverTimestamp
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { format, addDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Plus, Trash2, Send, Save, Pin, Calendar, CheckCircle, Bell, Star, Users } from 'lucide-react'
import { BRIGADE_GROUPS } from '../../utils/brigade'

export default function AdminDayPlan() {
  const { userProfile } = useAuth()
  const [fixedBlocks, setFixedBlocks] = useState([])
  const [draftBlocks, setDraftBlocks] = useState([])
  const [publishedDates, setPublishedDates] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [newFixed, setNewFixed] = useState({ time: '', title: '', brigadeGroup: 'all' })
  const [newDraft, setNewDraft] = useState({ time: '', title: '' })
  const [activeTab, setActiveTab] = useState('plan')
  const [newReminder, setNewReminder] = useState('')

  // Day info fields
  const [theme, setTheme] = useState('')
  const [dutyTeam1, setDutyTeam1] = useState('')
  const [dutyTeam2, setDutyTeam2] = useState('')
  const [reminders, setReminders] = useState([])

  // Compute dutyTeams string for storage/display
  function getDutyTeamsString(t1, t2) {
    const parts = [t1, t2].filter(Boolean).map(n => `Команда №${n}`)
    return parts.join(', ')
  }

  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
  const tomorrowLabel = format(addDays(new Date(), 1), 'd MMMM yyyy (EEEE)', { locale: ru })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [fixedSnap, draftSnap, publishedSnap, eventsSnap] = await Promise.all([
        getDocs(query(collection(db, 'fixedBlocks'), orderBy('order'))),
        getDoc(doc(db, 'dayPlanDrafts', tomorrow)),
        getDocs(query(collection(db, 'dayPlans'), orderBy('date', 'desc'))),
        getDocs(query(collection(db, 'events'), orderBy('createdAt', 'desc'))),
      ])
      setFixedBlocks(fixedSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setEvents(eventsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      if (draftSnap.exists()) {
        const data = draftSnap.data()
        setDraftBlocks(data.blocks || [])
        setTheme(data.theme || '')
        setReminders(data.reminders || [])
        // Parse dutyTeam1/dutyTeam2 (new format) or legacy dutyTeams string
        if (data.dutyTeam1 !== undefined) {
          setDutyTeam1(data.dutyTeam1 || '')
          setDutyTeam2(data.dutyTeam2 || '')
        }
      }
      setPublishedDates(publishedSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.isPublished))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function addFixedBlock() {
    if (!newFixed.time || !newFixed.title.trim()) return
    const order = fixedBlocks.length
    const ref = await addDoc(collection(db, 'fixedBlocks'), {
      time: newFixed.time, title: newFixed.title.trim(),
      brigadeGroup: newFixed.brigadeGroup || 'all', order,
    })
    setFixedBlocks(prev => [...prev, { id: ref.id, time: newFixed.time, title: newFixed.title.trim(), brigadeGroup: newFixed.brigadeGroup || 'all', order }]
      .sort((a, b) => a.time.localeCompare(b.time)))
    setNewFixed({ time: '', title: '', brigadeGroup: 'all' })
  }

  async function deleteFixedBlock(id) {
    await deleteDoc(doc(db, 'fixedBlocks', id))
    setFixedBlocks(prev => prev.filter(b => b.id !== id))
  }

  const [newBrigadeGroup, setNewBrigadeGroup] = useState('all')
  const [selectedEventId, setSelectedEventId] = useState('')

  function addDraftBlock() {
    if (!newDraft.time || !newDraft.title.trim()) return
    setDraftBlocks(prev => [...prev, { id: Date.now().toString(), time: newDraft.time, title: newDraft.title.trim(), brigadeGroup: newBrigadeGroup }].sort((a, b) => a.time.localeCompare(b.time)))
    setNewDraft({ time: '', title: '' })
  }

  function addEventBlock() {
    if (!selectedEventId || !newDraft.time) return
    const event = events.find(e => e.id === selectedEventId)
    if (!event) return
    setDraftBlocks(prev => [...prev, {
      id: Date.now().toString(),
      time: newDraft.time,
      title: event.name,
      eventId: selectedEventId,
      brigadeGroup: newBrigadeGroup,
    }].sort((a, b) => a.time.localeCompare(b.time)))
    setSelectedEventId('')
  }

  function removeDraftBlock(id) {
    setDraftBlocks(prev => prev.filter(b => b.id !== id))
  }

  function addReminder() {
    if (!newReminder.trim()) return
    setReminders(prev => [...prev, newReminder.trim()])
    setNewReminder('')
  }

  function removeReminder(i) {
    setReminders(prev => prev.filter((_, idx) => idx !== i))
  }

  const draftData = {
    date: tomorrow, blocks: draftBlocks, theme,
    dutyTeam1, dutyTeam2,
    dutyTeams: getDutyTeamsString(dutyTeam1, dutyTeam2),
    reminders,
  }

  async function saveDraft() {
    setSaving(true)
    try {
      await setDoc(doc(db, 'dayPlanDrafts', tomorrow), { ...draftData, savedAt: serverTimestamp(), savedBy: userProfile.uid })
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  async function publishPlan() {
    if (!confirm(`Опубликовать план дня на ${tomorrowLabel}?`)) return
    setPublishing(true)
    try {
      await setDoc(doc(db, 'dayPlans', tomorrow), { ...draftData, isPublished: true, publishedAt: serverTimestamp(), publishedBy: userProfile.uid })
      setPublished(true)
      setTimeout(() => setPublished(false), 4000)
      loadAll()
    } catch (err) { console.error(err) }
    finally { setPublishing(false) }
  }

  const allPreview = [...fixedBlocks.map(b => ({ ...b, isFixed: true })), ...draftBlocks].sort((a, b) => a.time.localeCompare(b.time))

  if (loading) return <div className="text-center py-16 text-gray-400">Загрузка...</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Управление планом дня</h1>

      <div className="flex gap-2 border-b border-gray-200">
        {[
          { id: 'plan', label: 'План на завтра' },
          { id: 'fixed', label: 'Постоянные блоки' },
          { id: 'history', label: 'История' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors
              ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'plan' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {/* Day info */}
            <div className="card space-y-4">
              <h2 className="font-semibold flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500" /> Информация дня</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Тематика дня</label>
                <input type="text" className="input" value={theme} onChange={e => setTheme(e.target.value)} placeholder="Например: День народной культуры" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Дежурные команды (из команд 1–8)</label>
                <div className="flex gap-2">
                  <select className="input" value={dutyTeam1} onChange={e => setDutyTeam1(e.target.value)}>
                    <option value="">— Команда 1 —</option>
                    {[1,2,3,4,5,6,7,8].map(n => (
                      <option key={n} value={n} disabled={String(n) === dutyTeam2}>Команда №{n}</option>
                    ))}
                  </select>
                  <select className="input" value={dutyTeam2} onChange={e => setDutyTeam2(e.target.value)}>
                    <option value="">— Команда 2 —</option>
                    {[1,2,3,4,5,6,7,8].map(n => (
                      <option key={n} value={n} disabled={String(n) === dutyTeam1}>Команда №{n}</option>
                    ))}
                  </select>
                </div>
                {(dutyTeam1 || dutyTeam2) && (
                  <div className="text-xs text-gray-500 mt-1">
                    Итого: {getDutyTeamsString(dutyTeam1, dutyTeam2)}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Bell className="w-3.5 h-3.5" /> Важные напоминания</label>
                <div className="flex gap-2 mb-2">
                  <input type="text" className="input" value={newReminder} onChange={e => setNewReminder(e.target.value)}
                    placeholder="Текст напоминания" onKeyDown={e => e.key === 'Enter' && addReminder()} />
                  <button onClick={addReminder} disabled={!newReminder.trim()} className="btn-primary px-3 flex-shrink-0"><Plus className="w-4 h-4" /></button>
                </div>
                {reminders.length === 0 ? (
                  <div className="text-sm text-gray-400 italic">Нет напоминаний</div>
                ) : (
                  <div className="space-y-1">
                    {reminders.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5">
                        <Bell className="w-3.5 h-3.5 text-yellow-600 flex-shrink-0" />
                        <span className="flex-1 text-sm">{r}</span>
                        <button onClick={() => removeReminder(i)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Variable blocks */}
            <div className="card space-y-4">
              <h2 className="font-semibold">Переменные события на {tomorrowLabel}</h2>

              {/* Brigade group selector */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Для какой дружины:</label>
                <select className="input text-sm" value={newBrigadeGroup} onChange={e => setNewBrigadeGroup(e.target.value)}>
                  {BRIGADE_GROUPS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>

              <div className="flex gap-2">
                <input type="time" className="input w-28 flex-shrink-0" value={newDraft.time} onChange={e => setNewDraft(p => ({ ...p, time: e.target.value }))} />
                <input type="text" className="input" value={newDraft.title} onChange={e => setNewDraft(p => ({ ...p, title: e.target.value }))}
                  placeholder="Название события" onKeyDown={e => e.key === 'Enter' && addDraftBlock()} />
                <button onClick={addDraftBlock} disabled={!newDraft.time || !newDraft.title.trim()} className="btn-primary px-3 flex-shrink-0"><Plus className="w-4 h-4" /></button>
              </div>

              {events.length > 0 && (
                <div className="border-t border-gray-100 pt-3">
                  <div className="text-sm font-medium text-gray-600 mb-2">Добавить мероприятие в план:</div>
                  <div className="flex gap-2 flex-wrap">
                    <input
                      type="time"
                      className="input w-28 flex-shrink-0"
                      value={newDraft.time}
                      onChange={e => setNewDraft(p => ({ ...p, time: e.target.value }))}
                    />
                    <select
                      className="input flex-1 min-w-0"
                      value={selectedEventId}
                      onChange={e => setSelectedEventId(e.target.value)}
                    >
                      <option value="">— Выбрать мероприятие —</option>
                      {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                    </select>
                    <button
                      onClick={addEventBlock}
                      disabled={!selectedEventId || !newDraft.time}
                      className="btn-primary px-3 flex-shrink-0"
                      title="Добавить мероприятие в план"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Дружина и время берутся из выбранных выше полей
                  </div>
                </div>
              )}

              {draftBlocks.length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">Добавьте события выше</div>
              ) : (
                <div className="space-y-1.5">
                  {draftBlocks.map(block => {
                    const bgLabel = BRIGADE_GROUPS.find(g => g.value === (block.brigadeGroup || 'all'))?.label
                    return (
                      <div key={block.id} className={`flex items-center gap-2 p-2 rounded-lg ${block.eventId ? 'bg-purple-50' : 'bg-gray-50'}`}>
                        <span className="text-sm font-mono text-blue-700 font-semibold w-12">{block.time}</span>
                        <span className="flex-1 text-sm">{block.title}</span>
                        {block.brigadeGroup && block.brigadeGroup !== 'all' && (
                          <span className="badge-yellow text-xs flex-shrink-0">{bgLabel}</span>
                        )}
                        {block.eventId && <span className="badge-blue text-xs flex-shrink-0">мероприятие</span>}
                        <button onClick={() => removeDraftBlock(block.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button onClick={saveDraft} disabled={saving} className="btn-secondary flex items-center gap-2 text-sm">
                  <Save className="w-4 h-4" /> {saving ? 'Сохраняем...' : 'Сохранить черновик'}
                </button>
                <button onClick={publishPlan} disabled={publishing} className="btn-green flex items-center gap-2 text-sm">
                  <Send className="w-4 h-4" /> {publishing ? 'Публикуем...' : 'Отправить план на завтра'}
                </button>
              </div>
              {published && <div className="flex items-center gap-2 text-green-600 text-sm font-medium"><CheckCircle className="w-4 h-4" /> Опубликовано!</div>}
            </div>
          </div>

          {/* Preview */}
          <div className="card">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-600" /> Предпросмотр</h2>
            <DayInfoPreview theme={theme} dutyTeams={getDutyTeamsString(dutyTeam1, dutyTeam2)} reminders={reminders} />
            {allPreview.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">Нет событий</div>
            ) : (
              <div className="space-y-1.5 mt-3">
                {allPreview.map((block, i) => {
                  const bgValue = block.brigadeGroup || 'all'
                  const bgLabel = BRIGADE_GROUPS.find(g => g.value === bgValue)?.label
                  return (
                    <div key={block.id || i} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50">
                      <span className="text-sm font-mono text-blue-700 font-semibold w-12 flex-shrink-0">{block.time}</span>
                      <span className="flex-1 text-sm">{block.title}</span>
                      {bgValue !== 'all' && (
                        <span className="badge-yellow text-xs flex-shrink-0">{bgLabel}</span>
                      )}
                      {block.isFixed && <span className="badge-gray text-xs flex-shrink-0">постоянно</span>}
                      {block.eventId && <span className="badge-blue text-xs flex-shrink-0">мероприятие</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'fixed' && (
        <div className="card space-y-4 max-w-xl">
          <h2 className="font-semibold flex items-center gap-2"><Pin className="w-4 h-4 text-orange-500" /> Постоянные блоки</h2>
          <p className="text-sm text-gray-500">Отображаются каждый день. Можно ограничить по дружине.</p>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Для какой дружины:</label>
            <select className="input text-sm" value={newFixed.brigadeGroup} onChange={e => setNewFixed(p => ({ ...p, brigadeGroup: e.target.value }))}>
              {BRIGADE_GROUPS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </div>

          <div className="flex gap-2">
            <input type="time" className="input w-28 flex-shrink-0" value={newFixed.time} onChange={e => setNewFixed(p => ({ ...p, time: e.target.value }))} />
            <input type="text" className="input" value={newFixed.title} onChange={e => setNewFixed(p => ({ ...p, title: e.target.value }))}
              placeholder="Название события" onKeyDown={e => e.key === 'Enter' && addFixedBlock()} />
            <button onClick={addFixedBlock} disabled={!newFixed.time || !newFixed.title.trim()} className="btn-primary px-3 flex-shrink-0"><Plus className="w-4 h-4" /></button>
          </div>

          {fixedBlocks.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">Постоянные блоки не добавлены</div>
          ) : (
            <div className="space-y-1.5">
              {fixedBlocks.map(block => {
                const brigLabel = BRIGADE_GROUPS.find(g => g.value === (block.brigadeGroup || 'all'))?.label
                return (
                  <div key={block.id} className="flex items-center gap-2 p-2 rounded-lg bg-orange-50">
                    <span className="text-sm font-mono text-orange-700 font-semibold w-12">{block.time}</span>
                    <span className="flex-1 text-sm">{block.title}</span>
                    {block.brigadeGroup && block.brigadeGroup !== 'all'
                      ? <span className="badge-yellow text-xs">{brigLabel}</span>
                      : <span className="badge-yellow text-xs">все дружины</span>
                    }
                    <button onClick={() => deleteFixedBlock(block.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-3">
          {publishedDates.length === 0 ? (
            <div className="card text-center py-10 text-gray-400">История пуста</div>
          ) : (
            publishedDates.map(plan => (
              <div key={plan.id} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold">{format(new Date(plan.date), 'd MMMM yyyy (EEEE)', { locale: ru })}</span>
                  <span className="badge-green text-xs">Опубликован</span>
                </div>
                <DayInfoPreview theme={plan.theme} dutyTeams={plan.dutyTeams} reminders={plan.reminders} />
                <div className="space-y-1 mt-3">
                  {[...fixedBlocks.map(b => ({ ...b, isFixed: true })), ...(plan.blocks || [])]
                    .sort((a, b) => a.time.localeCompare(b.time))
                    .map((block, i) => {
                      const bgValue = block.brigadeGroup || 'all'
                      const bgLabel = BRIGADE_GROUPS.find(g => g.value === bgValue)?.label
                      return (
                        <div key={i} className="flex items-center gap-2 text-sm py-1">
                          <span className="font-mono text-blue-600 w-12">{block.time}</span>
                          <span className="text-gray-700 flex-1">{block.title}</span>
                          {bgValue !== 'all' && <span className="badge-yellow text-xs">{bgLabel}</span>}
                          {block.isFixed && <span className="text-xs text-gray-400">(постоянно)</span>}
                        </div>
                      )
                    })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function DayInfoPreview({ theme, dutyTeams, reminders }) {
  const hasAny = theme || dutyTeams || (reminders && reminders.length > 0)
  if (!hasAny) return null
  return (
    <div className="space-y-2 mb-1">
      {theme && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <Star className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <div>
            <span className="text-xs text-blue-500 font-medium">Тематика дня</span>
            <div className="text-sm font-semibold text-blue-800">{theme}</div>
          </div>
        </div>
      )}
      {dutyTeams && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <Users className="w-4 h-4 text-green-600 flex-shrink-0" />
          <div>
            <span className="text-xs text-green-500 font-medium">Дежурные команды</span>
            <div className="text-sm font-semibold text-green-800">{dutyTeams}</div>
          </div>
        </div>
      )}
      {reminders && reminders.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Bell className="w-4 h-4 text-yellow-600" />
            <span className="text-xs text-yellow-600 font-medium">Важные напоминания</span>
          </div>
          <ul className="space-y-0.5">
            {reminders.map((r, i) => (
              <li key={i} className="text-sm text-yellow-800 flex items-start gap-1.5">
                <span className="text-yellow-500 mt-0.5">•</span>{r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
