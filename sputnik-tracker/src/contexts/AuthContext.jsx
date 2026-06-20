import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase/config'
import { getBrigade } from '../utils/brigade'

const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function registerCounselor(email, password, fullName) {
    const credential = await createUserWithEmailAndPassword(auth, email, password)
    await setDoc(doc(db, 'users', credential.user.uid), {
      email, fullName, role: 'counselor',
      teamId: null, approved: false, createdAt: serverTimestamp(),
    })
    return credential
  }

  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    return signOut(auth)
  }

  async function fetchUserProfile(uid) {
    const snap = await getDoc(doc(db, 'users', uid))
    if (!snap.exists()) return null

    let profile = { uid, ...snap.data() }

    // Auto-fix: if counselor has teamNumber but no brigadeId, compute and save it
    if (profile.role === 'counselor' && profile.teamNumber && !profile.brigadeId) {
      const brigade = getBrigade(profile.teamNumber)
      if (brigade.id) {
        await updateDoc(doc(db, 'users', uid), {
          brigadeId: brigade.id,
          brigadeName: brigade.short,
        })
        profile = { ...profile, brigadeId: brigade.id, brigadeName: brigade.short }
      }
    }

    return profile
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const profile = await fetchUserProfile(user.uid)
        setCurrentUser(user)
        setUserProfile(profile)
      } else {
        setCurrentUser(null)
        setUserProfile(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const value = {
    currentUser,
    userProfile,
    setUserProfile,
    registerCounselor,
    login,
    logout,
    loading,
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
