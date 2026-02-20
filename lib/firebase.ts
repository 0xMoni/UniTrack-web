import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, browserLocalPersistence, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

function getApp(): FirebaseApp {
  if (!_app) {
    if (!firebaseConfig.apiKey) {
      throw new Error('Firebase config missing — set NEXT_PUBLIC_FIREBASE_* env vars');
    }
    _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return _app;
}

export function getFirebaseAuth(): Auth {
  if (!_auth) {
    const app = getApp();
    if (typeof window !== 'undefined') {
      // Use browserLocalPersistence (localStorage-based) which is synchronous
      // and reliable. IndexedDB persistence has a known issue where
      // onAuthStateChanged fires with null before the DB finishes loading,
      // causing the user to appear logged-out on refresh.
      try {
        _auth = initializeAuth(app, {
          persistence: browserLocalPersistence,
        });
      } catch {
        // Auth already initialized (e.g. HMR) — reuse existing instance
        _auth = getAuth(app);
      }
    } else {
      _auth = getAuth(app);
    }
  }
  return _auth;
}

export function getFirebaseDb(): Firestore {
  if (!_db) {
    _db = getFirestore(getApp());
  }
  return _db;
}
