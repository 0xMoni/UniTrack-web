import { NextResponse } from 'next/server';
import crypto from 'crypto';

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
      amount: 2900,
      currency: 'INR',
      paidAt: now.toISOString(),
      premiumUntil,
    };

    return NextResponse.json({ premiumUntil, payment });
  } catch (err) {
    console.error('Verify payment error:', err);
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 });
  }
}
