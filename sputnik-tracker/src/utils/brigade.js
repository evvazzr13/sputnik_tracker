export const BRIGADES = [
  { id: 'olimp', name: 'Олимпийская дружина', short: 'Олимп', teams: [1,2,3,4,5,6] },
  { id: 'zvezda', name: 'Звёздная дружина', short: 'Звездный', teams: [7,8,9,10,11,12,13,14] },
  { id: 'kosmos', name: 'Космическая дружина', short: 'Космос', teams: [15,16,17,18,19,20,21,22] },
  { id: 'solnyshko', name: 'Солнечная дружина', short: 'Солнышко', teams: [23,24,25,26,27,28] },
]

export const BRIGADE_GROUPS = [
  { value: 'all', label: 'Все дружины' },
  { value: 'olimp_zvezda', label: 'Олимп и Звездный' },
  { value: 'kosmos_solnyshko', label: 'Космос и Солнышко' },
  { value: 'olimp', label: 'Олимп' },
  { value: 'zvezda', label: 'Звездный' },
  { value: 'kosmos', label: 'Космос' },
  { value: 'solnyshko', label: 'Солнышко' },
]

export function getBrigade(teamNumber) {
  const n = parseInt(teamNumber)
  const brigade = BRIGADES.find(b => b.teams.includes(n))
  return brigade || { id: null, name: '—', short: '—', teams: [] }
}

export function blockVisibleForBrigade(blockBrigadeGroup, myBrigadeId) {
  if (!blockBrigadeGroup || blockBrigadeGroup === 'all') return true
  if (blockBrigadeGroup === 'olimp_zvezda') return ['olimp', 'zvezda'].includes(myBrigadeId)
  if (blockBrigadeGroup === 'kosmos_solnyshko') return ['kosmos', 'solnyshko'].includes(myBrigadeId)
  return blockBrigadeGroup === myBrigadeId
}

export function getBrigadeColor(brigadeId) {
  switch (brigadeId) {
    case 'olimp': return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', badge: 'badge-blue' }
    case 'zvezda': return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', badge: 'badge-yellow' }
    case 'kosmos': return { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', badge: 'bg-purple-100 text-purple-800' }
    case 'solnyshko': return { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', badge: 'bg-orange-100 text-orange-800' }
    default: return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800', badge: 'badge-gray' }
  }
}
