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
  const [loading, setLoading] = useState(true);
  const [uniTrackPassword, setUniTrackPassword] = useState('');

  useEffect(() => {
    // Only subscribe on client when Firebase is configured
    if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      setLoading(false);
      return;
    }

    try {
      const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (firebaseUser) => {
        setUser(firebaseUser);
        setLoading(false);
      });
      return unsubscribe;
    } catch {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    setUniTrackPassword(password);
    return cred.user;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
    setUniTrackPassword(password);
    // Set 7-day free trial for new sign-ups
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await saveUserData(cred.user.uid, { trialEndsAt });
    return cred.user;
  }, []);

  const logout = useCallback(async () => {
    await signOut(getFirebaseAuth());
    setUniTrackPassword('');
  }, []);

  return { user, loading, uniTrackPassword, setUniTrackPassword, login, signUp, logout };
}
