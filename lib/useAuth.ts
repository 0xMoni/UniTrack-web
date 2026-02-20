'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import { getFirebaseAuth } from './firebase';
import { saveUserData } from './firestore';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const isClient = typeof window !== 'undefined' && !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const [loading, setLoading] = useState(isClient);

  useEffect(() => {
    if (!isClient) return;

    const auth = getFirebaseAuth();

    // Wait for auth state to be fully restored from IndexedDB before
    // subscribing. This prevents a flash of the login form on page reload.
    let unsubscribe: (() => void) | undefined;

    auth.authStateReady().then(() => {
      setUser(auth.currentUser);
      setLoading(false);

      // Now subscribe for future changes (login, logout, token refresh)
      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        setUser(firebaseUser);
      });
    }).catch(() => {
      setLoading(false);
    });

    return () => unsubscribe?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    return cred.user;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
    // Set 7-day free trial for new sign-ups
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await saveUserData(cred.user.uid, { trialEndsAt });
    return cred.user;
  }, []);

  const logout = useCallback(async () => {
    await signOut(getFirebaseAuth());
  }, []);

  return { user, loading, login, signUp, logout };
}
