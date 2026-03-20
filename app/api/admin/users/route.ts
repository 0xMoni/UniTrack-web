import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const ADMIN_PASSWORD = 'unitrack-admin-0xmoni';

function getAdminDb() {
  if (getApps().length === 0) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccount) {
      const parsed = JSON.parse(serviceAccount);
      initializeApp({ credential: cert(parsed) });
    } else {
      const projectId = (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '').trim();
      initializeApp({ projectId });
    }
  }
  return getFirestore();
}

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getAdminDb();
    const snap = await db.collection('users').get();

    // Fetch emails from Firebase Auth
    const uids = snap.docs.map((doc) => doc.id);
    const emailMap: Record<string, string> = {};
    // getUsers accepts up to 100 identifiers at a time
    for (let i = 0; i < uids.length; i += 100) {
      const batch = uids.slice(i, i + 100).map((uid) => ({ uid }));
      try {
        const authResult = await getAuth().getUsers(batch);
        for (const user of authResult.users) {
          emailMap[user.uid] = user.email || '';
        }
      } catch {
        // Auth lookup failed — continue without emails
      }
    }

    const users = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        uid: doc.id,
        email: emailMap[doc.id] || '',
        studentName: d.attendance?.student?.name ?? '',
        usn: d.attendance?.student?.usn ?? '',
        erpUrl: d.erpUrl ?? '',
        premiumUntil: d.premiumUntil ?? null,
        trialEndsAt: d.trialEndsAt ?? null,
        refreshCount: d.refreshCount ?? 0,
        lastSynced: d.lastSynced ?? '',
        payments: d.payments ?? [],
      };
    });

    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
