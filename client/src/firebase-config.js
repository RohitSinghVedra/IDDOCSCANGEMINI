import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyDc3NRFfW4bfF2xCJUBZL_csQNky6-b687k",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "iddocscan-g.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "iddocscan-g",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "iddocscan-g.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "204640137638",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:204640137638:web:b92180f1bf49d2ec415f67",
  measurementId: "G-E2YVNFR1J4"
};

// Debug logging
console.log('Firebase Config:', firebaseConfig);

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
