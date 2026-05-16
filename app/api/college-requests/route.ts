import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const ADMIN_PASSWORD = 'unitrack-admin-0xmoni';

function getAdminDb() {
  if (getApps().length === 0) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccount) {
      initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
    } else {
      const projectId = (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '').trim();
      initializeApp({ projectId });
    }
  }
  return getFirestore();
}

export async function POST(request: NextRequest) {
  try {
    const { college, erpUrl, email } = await request.json();

    if (!college || !erpUrl) {
      return NextResponse.json({ error: 'Missing college or erpUrl' }, { status: 400 });
    }

    const db = getAdminDb();
    await db.collection('college_requests').add({
      college,
      erpUrl,
      email: email || '',
      createdAt: new Date().toISOString(),
      status: 'pending',
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save request' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const password = request.nextUrl.searchParams.get('password');
  if (password !== ADMIN_PASSWORD) {
    const body = await request.text().catch(() => '');
    try {
      const json = JSON.parse(body);
      if (json.password !== ADMIN_PASSWORD) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const db = getAdminDb();
    const snapshot = await db.collection('college_requests').orderBy('createdAt', 'desc').get();
    const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ requests });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch requests' },
      { status: 500 },
    );
  }
}
