import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const ADMIN_PASSWORD = 'unitrack-admin-0xmoni';

function getAdminDb() {
  if (getApps().length === 0) {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (clientEmail && privateKey) {
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    } else {
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

    const users = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        uid: doc.id,
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
