import { doc, getDoc, setDoc, arrayUnion, onSnapshot } from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import { AttendanceData, Timetable } from './types';
import { EncryptedData, encryptCredentials, decryptCredentials } from './crypto';

export interface PaymentRecord {
  orderId: string;
  paymentId: string;
  amount: number;
  currency: string;
  paidAt: string;
  premiumUntil: string;
}

export interface UserData {
  attendance: AttendanceData | null;
  threshold: number;
  subjectThresholds: Record<string, number>;
  timetable: Timetable;
  erpUrl: string;
  erpCredentials: EncryptedData | null;
  lastSynced: string;
  premiumUntil: string | null;
  trialEndsAt: string | null;
  refreshCount: number;
  refreshCountResetMonth: string;
  payments: PaymentRecord[];
}

const DEFAULT_USER_DATA: UserData = {
  attendance: null,
  threshold: 75,
  subjectThresholds: {},
  timetable: {},
  erpUrl: '',
  erpCredentials: null,
  lastSynced: '',
  premiumUntil: null,
  trialEndsAt: null,
  refreshCount: 0,
  refreshCountResetMonth: '',
  payments: [],
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
): Promise<void> {
  const plaintext = JSON.stringify({ username, password });
  const encrypted = await encryptCredentials(plaintext, uid);
  await saveUserData(uid, { erpUrl, erpCredentials: encrypted });
}

export async function loadErpCredentials(
  uid: string,
): Promise<{ username: string; password: string; erpUrl: string } | null> {
  const data = await loadUserData(uid);
  if (!data.erpCredentials || !data.erpUrl) return null;
  try {
    const plaintext = await decryptCredentials(data.erpCredentials, uid);
    const { username, password } = JSON.parse(plaintext);
    return { username, password, erpUrl: data.erpUrl };
  } catch {
    return null;
  }
}

export async function savePayment(uid: string, premiumUntil: string, payment: PaymentRecord): Promise<void> {
  await setDoc(doc(getFirebaseDb(), 'users', uid), {
    premiumUntil,
    payments: arrayUnion(payment),
  }, { merge: true });
}

export function subscribeToUserData(uid: string, callback: (data: UserData) => void): () => void {
  return onSnapshot(doc(getFirebaseDb(), 'users', uid), (snap) => {
    if (!snap.exists()) return;
    callback({ ...DEFAULT_USER_DATA, ...snap.data() } as UserData);
  });
}

export async function incrementRefreshCount(uid: string, currentMonth: string, currentCount: number, currentResetMonth: string): Promise<{ refreshCount: number; refreshCountResetMonth: string }> {
  // Lazy monthly reset: if the stored month differs from current, reset to 0
  const isNewMonth = currentResetMonth !== currentMonth;
  const newCount = isNewMonth ? 1 : currentCount + 1;
  const update = { refreshCount: newCount, refreshCountResetMonth: currentMonth };
  await saveUserData(uid, update);
  return update;
}
