import { useEffect, useState, useCallback } from 'react'
import {
  collection, query, where, getDocs, addDoc, updateDoc, deleteDoc,
  doc, setDoc, getDoc, serverTimestamp, orderBy
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Plus, Trash2, Save, UserCheck, UserX, RefreshCw, Edit2, X } from 'lucide-react'

const ABSENCE_REASONS = {
  illness: 'Болезнь',
  family: 'Семейные обстоятельства',
}

export default function TeamPage() {
  const { userProfile } = useAuth()
  const [children, setChildren] = useState([])
  const [attendance, setAttendance] = useState({}) // { childId: { status, reason } }
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newChildName, setNewChildName] = useState('')
  const [addingChild, setAddingChild] = useState(false)
  const [editingGender, setEditingGender] = useState(null)
  const [saved, setSaved] = useState(false)

  const today = format(new Date(), 'yyyy-MM-dd')
  const todayLabel = format(new Date(), 'd MMMM yyyy', { locale: ru })
  const teamId = userProfile?.teamId

  const loadData = useCallback(async () => {
    if (!teamId) return
    setLoading(true)
    try {
      const childSnap = await getDocs(
        query(collection(db, 'children'), where('teamId', '==', teamId), orderBy('name'))
      )
      const childList = childSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      setChildren(childList)

      // Load today's attendance
      const attSnap = await getDocs(
        query(collection(db, 'attendance'),
          where('teamId', '==', teamId),
          where('date', '==', today))
      )
      const att = {}
      attSnap.docs.forEach(d => {
        const data = d.data()
        att[data.childId] = { docId: d.id, status: data.status, reason: data.reason || null }
      })
      setAttendance(att)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [teamId, today])

  useEffect(() => { loadData() }, [loadData])

  async function addChild() {
    if (!newChildName.trim()) return
    setAddingChild(true)
    try {
      const docRef = await addDoc(collection(db, 'children'), {
        teamId,
        name: newChildName.trim(),
        gender: null,
        createdAt: serverTimestamp(),
        addedBy: userProfile.uid,
      })
      setChildren(prev => [...prev, { id: docRef.id, teamId, name: newChildName.trim(), gender: null }].sort((a,b)=>a.name.localeCompare(b.name)))
      setNewChildName('')
    } catch (err) {
      console.error(err)
    } finally {
      setAddingChild(false)
    }
  }

  async function deleteChild(childId) {
    if (!confirm('Удалить ребёнка из списка?')) return
    await deleteDoc(doc(db, 'children', childId))
    setChildren(prev => prev.filter(c => c.id !== childId))
  }

  async function setGender(childId, gender) {
    await updateDoc(doc(db, 'children', childId), { gender })
    setChildren(prev => prev.map(c => c.id === childId ? { ...c, gender } : c))
    setEditingGender(null)
  }

  function toggleAttendance(childId) {
    setAttendance(prev => {
      const current = prev[childId]
      if (!current || current.status === 'present') {
        return { ...prev, [childId]: { ...current, status: 'absent', reason: 'illness' } }
      }
      return { ...prev, [childId]: { ...current, status: 'present', reason: null } }
    })
  }

  function setReason(childId, reason) {
    setAttendance(prev => ({
      ...prev,
      [childId]: { ...prev[childId], reason }
    }))
  }

  async function saveAttendance() {
    setSaving(true)
    try {
      for (const child of children) {
        const att = attendance[child.id]
        const status = att?.status || 'present'
        const reason = status === 'absent' ? (att?.reason || 'illness') : null
        const data = {
          teamId,
          childId: child.id,
          date: today,
          status,
          reason,
          updatedAt: serverTimestamp(),
          updatedBy: userProfile.uid,
        }
        if (att?.docId) {
          await updateDoc(doc(db, 'attendance', att.docId), data)
        } else {
          const ref = await addDoc(collection(db, 'attendance'), data)
          setAttendance(prev => ({
            ...prev,
            [child.id]: { ...prev[child.id], docId: ref.id }
          }))
        }
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error(err)
      alert('Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  const presentCount = children.filter(c => !attendance[c.id] || attendance[c.id].status !== 'absent').length
  const absentCount = children.length - presentCount

  if (loading) return <div className="text-center py-16 text-gray-400">Загрузка...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Команда №{userProfile?.teamNumber}</h1>
        <p className="text-gray-500 mt-1">Посещаемость на {todayLabel}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center py-4">
          <div className="text-3xl font-bold text-gray-800">{children.length}</div>
          <div className="text-sm text-gray-500 mt-1">Всего</div>
        </div>
        <div className="card text-center py-4">
          <div className="text-3xl font-bold text-green-600">{presentCount}</div>
          <div className="text-sm text-gray-500 mt-1">Присутствуют</div>
        </div>
        <div className="card text-center py-4">
          <div className="text-3xl font-bold text-red-500">{absentCount}</div>
          <div className="text-sm text-gray-500 mt-1">Отсутствуют</div>
        </div>
      </div>

      {/* Children list */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Список отряда</h2>
          <button onClick={loadData} className="btn-secondary text-sm flex items-center gap-1 px-3 py-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Обновить
          </button>
        </div>

        {/* Add child */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            className="input"
            value={newChildName}
            onChange={e => setNewChildName(e.target.value)}
            placeholder="ФИО ребёнка"
            onKeyDown={e => e.key === 'Enter' && addChild()}
          />
          <button
            onClick={addChild}
            disabled={addingChild || !newChildName.trim()}
            className="btn-primary flex items-center gap-1 px-3 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Добавить
          </button>
        </div>

        {children.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            Список отряда пуст. Добавьте детей выше.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left pb-2 font-medium text-gray-600">ФИО</th>
                  <th className="text-center pb-2 font-medium text-gray-600 w-24">Пол</th>
                  <th className="text-center pb-2 font-medium text-gray-600 w-28">Присутствие</th>
                  <th className="text-left pb-2 font-medium text-gray-600 w-48">Причина отсутствия</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {children.map(child => {
                  const att = attendance[child.id]
                  const isAbsent = att?.status === 'absent'
                  return (
                    <tr key={child.id} className={`${isAbsent ? 'bg-red-50' : ''}`}>
                      <td className="py-2.5 pr-2 font-medium">{child.name}</td>
                      <td className="py-2.5 text-center">
                        {editingGender === child.id ? (
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => setGender(child.id, 'girl')} className="px-2 py-1 text-xs bg-pink-100 text-pink-700 rounded hover:bg-pink-200">♀ Дев</button>
                            <button onClick={() => setGender(child.id, 'boy')} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">♂ Мал</button>
                            <button onClick={() => setEditingGender(null)} className="px-1 py-1 text-xs text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>
                          </div>
                        ) : (
                          <button onClick={() => setEditingGender(child.id)} className="flex items-center gap-1 mx-auto">
                            {child.gender === 'girl' ? (
                              <span className="badge-red">♀ Дев</span>
                            ) : child.gender === 'boy' ? (
                              <span className="badge-blue">♂ Мал</span>
                            ) : (
                              <span className="badge-gray text-xs">Указать</span>
                            )}
                          </button>
                        )}
                      </td>
                      <td className="py-2.5 text-center">
                        <button
                          onClick={() => toggleAttendance(child.id)}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors
                            ${isAbsent
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                        >
                          {isAbsent ? <><UserX className="w-3 h-3" />Нет</> : <><UserCheck className="w-3 h-3" />Есть</>}
                        </button>
                      </td>
                      <td className="py-2.5">
                        {isAbsent && (
                          <select
                            value={att?.reason || 'illness'}
                            onChange={e => setReason(child.id, e.target.value)}
                            className="text-xs border border-gray-200 rounded px-2 py-1 bg-white w-full"
                          >
                            <option value="illness">Болезнь</option>
                            <option value="family">Семейные обстоятельства</option>
                          </select>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => deleteChild(child.id)}
                          className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={saveAttendance}
            disabled={saving || children.length === 0}
            className="btn-primary flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Сохраняем...' : 'Сохранить посещаемость'}
          </button>
          {saved && <span className="text-green-600 text-sm font-medium">✓ Сохранено</span>}
        </div>
      </div>
    </div>
  )
}
