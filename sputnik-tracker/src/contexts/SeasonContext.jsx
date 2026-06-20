import { createContext, useContext, useEffect, useState } from 'react'
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'

const SeasonContext = createContext(null)

export function useSeason() {
  return useContext(SeasonContext)
}

export function SeasonProvider({ children }) {
  const [activeSeason, setActiveSeason] = useState(null)
  const [allSeasons, setAllSeasons] = useState([])
  const [loading, setLoading] = useState(true)

  async function loadSeasons() {
    try {
      const [configSnap, seasonsSnap] = await Promise.all([
        getDoc(doc(db, 'config', 'app')),
        getDocs(query(collection(db, 'seasons'), orderBy('number'))),
      ])
      const seasons = seasonsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      setAllSeasons(seasons)

      const activeId = configSnap.exists() ? configSnap.data().activeSeasonId : null
      if (activeId) {
        const active = seasons.find(s => s.id === activeId)
        setActiveSeason(active || null)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function createSeason(number, startDate, endDate) {
    const ref = doc(collection(db, 'seasons'))
    const season = { number, startDate, endDate, status: 'pending', createdAt: serverTimestamp() }
    await setDoc(ref, season)
    await loadSeasons()
    return ref.id
  }

  async function startSeason(seasonId) {
    await updateDoc(doc(db, 'seasons', seasonId), { status: 'active', startedAt: serverTimestamp() })
    await setDoc(doc(db, 'config', 'app'), { activeSeasonId: seasonId }, { merge: true })
    await loadSeasons()
  }

  async function endSeason(seasonId, usersToReset) {
    // Archive assignments before resetting
    for (const user of usersToReset) {
      if (user.teamId) {
        await setDoc(doc(db, 'seasonArchive', `${seasonId}_${user.id}`), {
          seasonId, userId: user.id, fullName: user.fullName,
          teamId: user.teamId, teamNumber: user.teamNumber,
          brigadeName: user.brigadeName, brigadeId: user.brigadeId,
        })
      }
    }
    await updateDoc(doc(db, 'seasons', seasonId), { status: 'completed', endedAt: serverTimestamp() })
    await setDoc(doc(db, 'config', 'app'), { activeSeasonId: null }, { merge: true })
    setActiveSeason(null)
    await loadSeasons()
  }

  useEffect(() => { loadSeasons() }, [])

  return (
    <SeasonContext.Provider value={{ activeSeason, allSeasons, loading, loadSeasons, createSeason, startSeason, endSeason }}>
      {children}
    </SeasonContext.Provider>
  )
}
