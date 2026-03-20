import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin (server-side)
function getAdminDb() {
  if (getApps().length === 0) {
    const projectId = (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '').trim();
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (clientEmail && privateKey) {
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    } else {
      // Fallback: initialize without credentials (works in some environments)
      initializeApp({ projectId });
    }
  }
  return getFirestore();
}

export async function POST(request: Request) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, uid, currentPremiumUntil } = await request.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !uid) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify HMAC signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
    }

    // Compute premiumUntil: max(currentPremiumUntil, now) + 30 days
    const now = new Date();
    let baseDate = now;
    if (currentPremiumUntil) {
      const existing = new Date(currentPremiumUntil);
      if (existing > now) baseDate = existing;
    }
    const premiumUntil = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const payment = {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      amount: 1900,
      currency: 'INR',
      paidAt: now.toISOString(),
      premiumUntil,
    };

    // Write to Firestore server-side as a safety net
    // This ensures premium is saved even if the client-side write fails
    try {
      const db = getAdminDb();
      await db.collection('users').doc(uid).set({
        premiumUntil,
        payments: FieldValue.arrayUnion(payment),
      }, { merge: true });
    } catch {
      // Don't fail the request if server-side write fails
      // Client will still try to write on its end
    }

    return NextResponse.json({ premiumUntil, payment });
  } catch {
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 });
  }
}
