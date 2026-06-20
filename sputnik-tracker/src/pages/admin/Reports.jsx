import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { format, parseISO, subDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { FileDown, Calendar } from 'lucide-react'
import { exportToDocx, exportToPdf } from '../../utils/export'

export default function AdminReports() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [reportData, setReportData] = useState([])
  const [loading, setLoading] = useState(false)
  const [availableDates, setAvailableDates] = useState([])

  useEffect(() => {
    loadAvailableDates()
  }, [])

  useEffect(() => {
    if (selectedDate) loadReport(selectedDate)
  }, [selectedDate])

  async function loadAvailableDates() {
    try {
      // Get distinct dates from attendance
      const snap = await getDocs(query(collection(db, 'attendance'), orderBy('date', 'desc')))
      const dates = [...new Set(snap.docs.map(d => d.data().date))].slice(0, 30)
      setAvailableDates(dates)
    } catch (err) {
      console.error(err)
    }
  }

  async function loadReport(date) {
    setLoading(true)
    try {
      const [teamsSnap, childrenSnap, attSnap] = await Promise.all([
        getDocs(query(collection(db, 'teams'), orderBy('number'))),
        getDocs(collection(db, 'children')),
        getDocs(query(collection(db, 'attendance'), where('date', '==', date))),
      ])

      const teams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const children = childrenSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const attendance = {}
      attSnap.docs.forEach(d => {
        const data = d.data()
        attendance[`${data.teamId}_${data.childId}`] = data
      })

      const result = teams.map(team => {
        const teamChildren = children.filter(c => c.teamId === team.id)
        const girls = teamChildren.filter(c => c.gender === 'girl')
        const boys = teamChildren.filter(c => c.gender === 'boy')

        function getAtt(child) { return attendance[`${team.id}_${child.id}`] }
        function isAbsent(child) { return getAtt(child)?.status === 'absent' }
        function getReason(child) { return getAtt(child)?.reason }

        const absentChildren = teamChildren.filter(isAbsent).map(c => ({
          name: c.name,
          gender: c.gender,
          reason: getReason(c) === 'illness' ? 'Болезнь' : 'Семейные обстоятельства',
        }))

        return {
          teamId: team.id,
          number: team.number,
          totalGirls: girls.length,
          totalBoys: boys.length,
          presentGirls: girls.filter(c => !isAbsent(c)).length,
          presentBoys: boys.filter(c => !isAbsent(c)).length,
          absentGirls: girls.filter(isAbsent).length,
          absentBoys: boys.filter(isAbsent).length,
          total: teamChildren.length,
          absent: teamChildren.filter(isAbsent).length,
          absentChildren,
        }
      })
      setReportData(result)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const totals = reportData.reduce((acc, t) => ({
    totalGirls: acc.totalGirls + t.totalGirls,
    totalBoys: acc.totalBoys + t.totalBoys,
    presentGirls: acc.presentGirls + t.presentGirls,
    presentBoys: acc.presentBoys + t.presentBoys,
    absentGirls: acc.absentGirls + t.absentGirls,
    absentBoys: acc.absentBoys + t.absentBoys,
    total: acc.total + t.total,
    absent: acc.absent + t.absent,
  }), { totalGirls:0, totalBoys:0, presentGirls:0, presentBoys:0, absentGirls:0, absentBoys:0, total:0, absent:0 })

  function formatDateLabel(dateStr) {
    try { return format(parseISO(dateStr), 'd MMMM yyyy', { locale: ru }) }
    catch { return dateStr }
  }

  async function handleExportDocx() {
    await exportToDocx(reportData, totals, selectedDate)
  }

  async function handleExportPdf() {
    exportToPdf(reportData, totals, selectedDate)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">Отчёты по посещаемости</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleExportDocx} disabled={reportData.length === 0} className="btn-secondary flex items-center gap-2 text-sm">
            <FileDown className="w-4 h-4" /> Скачать Word
          </button>
          <button onClick={handleExportPdf} disabled={reportData.length === 0} className="btn-primary flex items-center gap-2 text-sm">
            <FileDown className="w-4 h-4" /> Скачать PDF
          </button>
        </div>
      </div>

      {/* Date selector */}
      <div className="card">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <label className="font-medium text-sm">Дата отчёта:</label>
          </div>
          <input
            type="date"
            className="input max-w-xs"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          />
          {availableDates.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <span className="text-sm text-gray-500">Быстрый выбор:</span>
              {availableDates.slice(0, 7).map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  className={`text-xs px-2 py-1 rounded-full transition-colors
                    ${selectedDate === d ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {format(parseISO(d), 'd MMM', { locale: ru })}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Report table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold">Отчёт за {formatDateLabel(selectedDate)}</h2>
        </div>
        {loading ? (
          <div className="text-center py-10 text-gray-400">Загрузка...</div>
        ) : reportData.length === 0 ? (
          <div className="text-center py-10 text-gray-400">Данные за выбранную дату отсутствуют</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-gray-600" rowSpan={2}>Команда</th>
                  <th className="text-center px-2 py-2 font-medium text-pink-600 border-l border-gray-200" colSpan={2}>Девочки</th>
                  <th className="text-center px-2 py-2 font-medium text-blue-600 border-l border-gray-200" colSpan={2}>Мальчики</th>
                  <th className="text-center px-4 py-2 font-medium text-gray-600 border-l border-gray-200" rowSpan={2}>Всего</th>
                  <th className="text-center px-4 py-2 font-medium text-green-600 border-l border-gray-200" rowSpan={2}>Присутств.</th>
                  <th className="text-center px-4 py-2 font-medium text-red-500 border-l border-gray-200" rowSpan={2}>Отсутств.</th>
                </tr>
                <tr>
                  <th className="text-center px-2 pb-2 text-xs font-medium text-gray-500 border-l border-gray-200">Всего</th>
                  <th className="text-center px-2 pb-2 text-xs font-medium text-red-400">Отсутств.</th>
                  <th className="text-center px-2 pb-2 text-xs font-medium text-gray-500 border-l border-gray-200">Всего</th>
                  <th className="text-center px-2 pb-2 text-xs font-medium text-red-400">Отсутств.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reportData.map(t => (
                  <>
                    <tr key={t.teamId} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-semibold">Команда №{t.number}</td>
                      <td className="text-center px-2 py-3 text-pink-600 border-l border-gray-100">{t.totalGirls}</td>
                      <td className="text-center px-2 py-3">
                        {t.absentGirls > 0 ? <span className="badge-red">{t.absentGirls}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="text-center px-2 py-3 text-blue-600 border-l border-gray-100">{t.totalBoys}</td>
                      <td className="text-center px-2 py-3">
                        {t.absentBoys > 0 ? <span className="badge-red">{t.absentBoys}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="text-center px-4 py-3 font-medium border-l border-gray-100">{t.total}</td>
                      <td className="text-center px-4 py-3 border-l border-gray-100">
                        <span className="badge-green">{t.total - t.absent}</span>
                      </td>
                      <td className="text-center px-4 py-3 border-l border-gray-100">
                        {t.absent > 0 ? <span className="badge-red">{t.absent}</span> : <span className="text-gray-300">0</span>}
                      </td>
                    </tr>
                    {t.absentChildren.length > 0 && (
                      <tr key={`${t.teamId}-absent`} className="bg-red-50">
                        <td colSpan={8} className="px-6 pb-2 pt-0">
                          <div className="text-xs text-red-600 flex flex-wrap gap-2">
                            {t.absentChildren.map((c, i) => (
                              <span key={i} className="inline-flex items-center gap-1">
                                <span>{c.name}</span>
                                <span className="text-red-400">({c.reason})</span>
                                {i < t.absentChildren.length - 1 && <span className="text-red-300">·</span>}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                <tr>
                  <td className="px-6 py-3">ИТОГО</td>
                  <td className="text-center px-2 py-3 text-pink-600 border-l border-gray-200">{totals.totalGirls}</td>
                  <td className="text-center px-2 py-3 text-red-500">{totals.absentGirls}</td>
                  <td className="text-center px-2 py-3 text-blue-600 border-l border-gray-200">{totals.totalBoys}</td>
                  <td className="text-center px-2 py-3 text-red-500">{totals.absentBoys}</td>
                  <td className="text-center px-4 py-3 border-l border-gray-200">{totals.total}</td>
                  <td className="text-center px-4 py-3 border-l border-gray-200 text-green-700">{totals.total - totals.absent}</td>
                  <td className="text-center px-4 py-3 border-l border-gray-200 text-red-600">{totals.absent}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
