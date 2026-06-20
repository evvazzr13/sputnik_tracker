import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyCag51woLlWxt3Bv31c7iAThZD8rrDC_2c",
  authDomain: "sputnik-6370f.firebaseapp.com",
  databaseURL: "https://sputnik-6370f-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "sputnik-6370f",
  storageBucket: "sputnik-6370f.firebasestorage.app",
  messagingSenderId: "700967950971",
  appId: "1:700967950971:web:99d2e706e75ca6862660de"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export default app
