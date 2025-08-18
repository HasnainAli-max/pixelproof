// pages/api/stripe/webhook.js
import { buffer } from 'micro';
import { stripe } from '@/lib/stripe/stripe'; // ← adjust path if needed
import { db, FieldValue, Timestamp } from '@/lib/firebase/firebaseAdmin'; // ← adjust path if needed

export const config = { api: { bodyParser: false } }; // REQUIRED

// Map price IDs → your plan slugs
const PLAN_BY_PRICE = {
  [process.env.STRIPE_PRICE_BASIC]: 'basic',
  [process.env.STRIPE_PRICE_PRO]: 'pro',
  [process.env.STRIPE_PRICE_ELITE]: 'elite',
};

// Write from a Subscription event object ONLY (no extra Stripe calls)
async function writeFromSubscriptionEvent(subscription) {
  const customerId = subscription.customer; // string "cus_..."
  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.id || null;
  const plan = priceId ? (PLAN_BY_PRICE[priceId] || 'unknown') : 'unknown';

  // Try to find uid by prior mapping (optional; if not found, park as orphan)
  const q = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
  if (q.empty) {
    await db.collection('stripeOrphans').doc(String(subscription.id)).set({
      reason: 'No user doc with this stripeCustomerId',
      customerId,
      status: subscription.status,
      createdAt: FieldValue.serverTimestamp(),
    });
    return; // nothing else to do for synthetic events
  }

  const uid = q.docs[0].id;

  const payload = {
    stripeCustomerId: customerId,
    subscriptionId: subscription.id,
    priceId,
    activePlan: plan,
    subscriptionStatus: subscription.status,
    currentPeriodStart: subscription.current_period_start
      ? Timestamp.fromMillis(subscription.current_period_start * 1000)
      : null,
    currentPeriodEnd: subscription.current_period_end
      ? Timestamp.fromMillis(subscription.current_period_end * 1000)
      : null,
    cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
    // Optional (if present in event)
    currency: item?.price?.currency || null,
    amount: item?.price?.unit_amount ?? null,
    productId: item?.price?.product || null,
    updatedAt: FieldValue.serverTimestamp(),
  };

  await db.collection('users').doc(uid).set(payload, { merge: true });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    // 1) Verify signature with exact raw bytes
    const buf = await buffer(req);
    const event = stripe.webhooks.constructEvent(buf, sig, secret);
    const { type } = event;
    console.log('🔔', type);

    // 2) (Optional) store raw event for debugging
    // await db.collection('stripeEvents').doc(event.id).set({
    //   type,
    //   created: event.created,
    //   receivedAt: FieldValue.serverTimestamp(),
    //   // DO NOT store full event in production if you’re worried about size
    // });

    // 3) Handle subscription lifecycle from the event payload directly
    if (
      type === 'customer.subscription.created' ||
      type === 'customer.subscription.updated' ||
      type === 'customer.subscription.deleted'
    ) {
      try {
        const subscription = event.data.object;
        await writeFromSubscriptionEvent(subscription);
      } catch (innerErr) {
        console.error('[handler] sub-event write failed:', innerErr?.stack || innerErr?.message || innerErr);
        // Still return 200 so Stripe CLI won’t retry while you debug
        return res.status(200).json({ received: true, noted: 'sub write failed (see logs)' });
      }
    }

    // 4) checkout.session.completed (CLI fixture is mode:"payment" — ignore)
    if (type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.mode !== 'subscription') {
        console.log('Ignoring non-subscription checkout session (mode=', session.mode, ')');
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[webhook] top-level error:', err?.stack || err?.message || err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
}
