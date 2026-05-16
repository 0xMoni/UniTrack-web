import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
    const { password, uid, premiumUntil } = await request.json();

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!uid || typeof uid !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid uid' }, { status: 400 });
    }

    if (!premiumUntil || typeof premiumUntil !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid premiumUntil' }, { status: 400 });
    }

    const date = new Date(premiumUntil);
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Invalid date format for premiumUntil' }, { status: 400 });
    }

    const db = getAdminDb();
    const userRef = db.collection('users').doc(uid);

    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await userRef.update({ premiumUntil: premiumUntil });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to set premium' },
      { status: 500 },
    );
  }
}
