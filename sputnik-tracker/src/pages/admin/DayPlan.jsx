import { useEffect, useState } from 'react'
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, setDoc, getDoc, orderBy, query, serverTimestamp
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { format, addDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Plus, Trash2, Send, Save, Pin, Calendar, CheckCircle } from 'lucide-react'

export default function AdminDayPlan() {
  const { userProfile } = useAuth()
  const [fixedBlocks, setFixedBlocks] = useState([])
  const [draftBlocks, setDraftBlocks] = useState([])
  const [publishedDates, setPublishedDates] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [newFixed, setNewFixed] = useState({ time: '', title: '' })
  const [newDraft, setNewDraft] = useState({ time: '', title: '' })
  const [activeTab, setActiveTab] = useState('plan')

  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
  const tomorrowLabel = format(addDays(new Date(), 1), 'd MMMM yyyy (EEEE)', { locale: ru })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const fixedSnap = await getDocs(query(collection(db, 'fixedBlocks'), orderBy('order')))
      const fixed = fixedSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      setFixedBlocks(fixed)

      // Load draft for tomorrow
      const draftSnap = await getDoc(doc(db, 'dayPlanDrafts', tomorrow))
      if (draftSnap.exists()) {
        setDraftBlocks(draftSnap.data().blocks || [])
      }

      // Load published plans list
      const publishedSnap = await getDocs(query(collection(db, 'dayPlans'), orderBy('date', 'desc')))
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
      time: newFixed.time,
      title: newFixed.title.trim(),
      order,
    })
    setFixedBlocks(prev => [...prev, { id: ref.id, time: newFixed.time, title: newFixed.title.trim(), order }]
      .sort((a, b) => a.time.localeCompare(b.time)))
    setNewFixed({ time: '', title: '' })
  }

  async function deleteFixedBlock(id) {
    await deleteDoc(doc(db, 'fixedBlocks', id))
    setFixedBlocks(prev => prev.filter(b => b.id !== id))
  }

  function addDraftBlock() {
    if (!newDraft.time || !newDraft.title.trim()) return
    setDraftBlocks(prev => [...prev, { id: Date.now().toString(), time: newDraft.time, title: newDraft.title.trim() }]
      .sort((a, b) => a.time.localeCompare(b.time)))
    setNewDraft({ time: '', title: '' })
  }

  function removeDraftBlock(id) {
    setDraftBlocks(prev => prev.filter(b => b.id !== id))
  }

  async function saveDraft() {
    setSaving(true)
    try {
      await setDoc(doc(db, 'dayPlanDrafts', tomorrow), {
        date: tomorrow,
        blocks: draftBlocks,
        savedAt: serverTimestamp(),
        savedBy: userProfile.uid,
      })
      setSaving(false)
    } catch (err) {
      console.error(err)
      setSaving(false)
    }
  }

  async function publishPlan() {
    if (!confirm(`Опубликовать план дня на ${tomorrowLabel}? Вожатые увидят его на главной странице.`)) return
    setPublishing(true)
    try {
      await setDoc(doc(db, 'dayPlans', tomorrow), {
        date: tomorrow,
        blocks: draftBlocks,
        isPublished: true,
        publishedAt: serverTimestamp(),
        publishedBy: userProfile.uid,
      })
      setPublished(true)
      setTimeout(() => setPublished(false), 4000)
      loadAll()
    } catch (err) {
      console.error(err)
    } finally {
      setPublishing(false)
    }
  }

  const allPreview = [...fixedBlocks.map(b => ({ ...b, isFixed: true })), ...draftBlocks]
    .sort((a, b) => a.time.localeCompare(b.time))

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
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors
              ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Plan for tomorrow */}
      {activeTab === 'plan' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Editor */}
          <div className="card space-y-4">
            <div>
              <h2 className="font-semibold">Переменные события на {tomorrowLabel}</h2>
              <p className="text-sm text-gray-500 mt-1">Добавьте события, которые актуальны только на этот день</p>
            </div>

            {/* Add block */}
            <div className="flex gap-2">
              <input
                type="time"
                className="input w-28 flex-shrink-0"
                value={newDraft.time}
                onChange={e => setNewDraft(p => ({ ...p, time: e.target.value }))}
              />
              <input
                type="text"
                className="input"
                value={newDraft.title}
                onChange={e => setNewDraft(p => ({ ...p, title: e.target.value }))}
                placeholder="Название события"
                onKeyDown={e => e.key === 'Enter' && addDraftBlock()}
              />
              <button onClick={addDraftBlock} disabled={!newDraft.time || !newDraft.title.trim()}
                className="btn-primary px-3 flex-shrink-0">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {draftBlocks.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                Добавьте переменные события выше
              </div>
            ) : (
              <div className="space-y-1.5">
                {draftBlocks.map(block => (
                  <div key={block.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                    <span className="text-sm font-mono text-blue-700 font-semibold w-12">{block.time}</span>
                    <span className="flex-1 text-sm">{block.title}</span>
                    <button onClick={() => removeDraftBlock(block.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={saveDraft} disabled={saving} className="btn-secondary flex items-center gap-2 text-sm">
                <Save className="w-4 h-4" /> {saving ? 'Сохраняем...' : 'Сохранить черновик'}
              </button>
              <button onClick={publishPlan} disabled={publishing} className="btn-green flex items-center gap-2 text-sm">
                <Send className="w-4 h-4" /> {publishing ? 'Публикуем...' : 'Отправить план на завтра'}
              </button>
            </div>
            {published && (
              <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                <CheckCircle className="w-4 h-4" /> План опубликован! Вожатые увидят его на главной.
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="card">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              Предпросмотр полного плана
            </h2>
            {allPreview.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">Нет событий</div>
            ) : (
              <div className="space-y-1.5">
                {allPreview.map((block, i) => (
                  <div key={block.id || i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                    <span className="text-sm font-mono text-blue-700 font-semibold w-12">{block.time}</span>
                    <span className="flex-1 text-sm">{block.title}</span>
                    {block.isFixed && <span className="badge-gray text-xs">постоянно</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Fixed blocks */}
      {activeTab === 'fixed' && (
        <div className="card space-y-4 max-w-xl">
          <div>
            <h2 className="font-semibold flex items-center gap-2"><Pin className="w-4 h-4 text-orange-500" /> Постоянные блоки расписания</h2>
            <p className="text-sm text-gray-500 mt-1">Отображаются у вожатых каждый день без изменений</p>
          </div>

          <div className="flex gap-2">
            <input type="time" className="input w-28 flex-shrink-0"
              value={newFixed.time} onChange={e => setNewFixed(p => ({ ...p, time: e.target.value }))} />
            <input type="text" className="input" value={newFixed.title}
              onChange={e => setNewFixed(p => ({ ...p, title: e.target.value }))}
              placeholder="Название события"
              onKeyDown={e => e.key === 'Enter' && addFixedBlock()} />
            <button onClick={addFixedBlock} disabled={!newFixed.time || !newFixed.title.trim()}
              className="btn-primary px-3 flex-shrink-0">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {fixedBlocks.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
              Постоянные блоки не добавлены
            </div>
          ) : (
            <div className="space-y-1.5">
              {fixedBlocks.map(block => (
                <div key={block.id} className="flex items-center gap-2 p-2 rounded-lg bg-orange-50">
                  <span className="text-sm font-mono text-orange-700 font-semibold w-12">{block.time}</span>
                  <span className="flex-1 text-sm">{block.title}</span>
                  <span className="badge-yellow text-xs">постоянно</span>
                  <button onClick={() => deleteFixedBlock(block.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: History */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {publishedDates.length === 0 ? (
            <div className="card text-center py-10 text-gray-400">История пуста — планы ещё не публиковались</div>
          ) : (
            publishedDates.map(plan => (
              <div key={plan.id} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">
                    {format(new Date(plan.date), 'd MMMM yyyy (EEEE)', { locale: ru })}
                  </span>
                  <span className="badge-green text-xs">Опубликован</span>
                </div>
                <div className="space-y-1">
                  {[...fixedBlocks.map(b => ({ ...b, isFixed: true })), ...(plan.blocks || [])]
                    .sort((a, b) => a.time.localeCompare(b.time))
                    .map((block, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="font-mono text-blue-600 w-12">{block.time}</span>
                        <span className="text-gray-700">{block.title}</span>
                        {block.isFixed && <span className="text-xs text-gray-400">(постоянно)</span>}
                      </div>
                    ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
