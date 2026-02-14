import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import { AttendanceData, Timetable } from './types';
import { EncryptedData, encryptCredentials, decryptCredentials } from './crypto';

export interface UserData {
  attendance: AttendanceData | null;
  threshold: number;
  subjectThresholds: Record<string, number>;
  timetable: Timetable;
  erpUrl: string;
  erpCredentials: EncryptedData | null;
  lastSynced: string;
}

const DEFAULT_USER_DATA: UserData = {
  attendance: null,
  threshold: 75,
  subjectThresholds: {},
  timetable: {},
  erpUrl: '',
  erpCredentials: null,
  lastSynced: '',
};

export async function loadUserData(uid: string): Promise<UserData> {
  const snap = await getDoc(doc(getFirebaseDb(), 'users', uid));
  if (!snap.exists()) return { ...DEFAULT_USER_DATA };
  return { ...DEFAULT_USER_DATA, ...snap.data() } as UserData;
}

export async function saveUserData(uid: string, partial: Partial<UserData>): Promise<void> {
  await setDoc(doc(getFirebaseDb(), 'users', uid), partial, { merge: true });
}

export async function saveErpCredentials(
  uid: string,
  erpUrl: string,
  username: string,
  password: string,
  uniTrackPassword: string
): Promise<void> {
  const plaintext = JSON.stringify({ username, password });
  const encrypted = await encryptCredentials(plaintext, uniTrackPassword);
  await saveUserData(uid, { erpUrl, erpCredentials: encrypted });
}

export async function loadErpCredentials(
  uid: string,
  uniTrackPassword: string
): Promise<{ username: string; password: string; erpUrl: string } | null> {
  const data = await loadUserData(uid);
  if (!data.erpCredentials || !data.erpUrl) return null;
  try {
    const plaintext = await decryptCredentials(data.erpCredentials, uniTrackPassword);
    const { username, password } = JSON.parse(plaintext);
    return { username, password, erpUrl: data.erpUrl };
  } catch {
    return null;
  }
}
