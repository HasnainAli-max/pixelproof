// pages/api/stripe/webhook.js
import { buffer } from 'micro';
import { stripe } from '@/lib/stripe/stripe';
import { db, FieldValue, Timestamp } from '@/lib/firebase/firebaseAdmin';

export const config = { api: { bodyParser: false } };

// Map price IDs → your plan slugs
const PLAN_BY_PRICE = {
  [process.env.STRIPE_PRICE_BASIC]: 'basic',
  [process.env.STRIPE_PRICE_PRO]: 'pro',
  [process.env.STRIPE_PRICE_ELITE]: 'elite',
};

/** Compact event log (keeps docs small) */
async function logStripeEvent({ event, rawLength, uid = null, hint = {} }) {
  const obj = event?.data?.object || {};
  const isSub = obj?.object === 'subscription';

  const doc = {
    id: event.id,
    type: event.type,
    created: event.created
      ? Timestamp.fromMillis(event.created * 1000)
      : FieldValue.serverTimestamp(),
    livemode: !!event.livemode,
    apiVersion: event.api_version || null,
    requestId: event.request?.id || null,
    objectType: obj?.object || null,
    stripeCustomerId: obj?.customer || null,
    subscriptionId: isSub ? obj?.id : obj?.subscription || null,
    checkoutSessionId: obj?.object === 'checkout.session' ? obj?.id : null,
    uid,
    rawSizeBytes: rawLength ?? null,
    hint,
    receivedAt: FieldValue.serverTimestamp(),
  };

  await db.collection('stripeEvents').doc(event.id).set(doc, { merge: true });
}

/** Upsert user subscription record from a Subscription object */
async function writeFromSubscriptionEvent(subscription) {
  const customerId = subscription.customer;
  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.id || null;
  const plan = priceId ? (PLAN_BY_PRICE[priceId] || 'unknown') : 'unknown';

  // Find user via previously stored mapping
  const q = await db.collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (q.empty) {
    // Park synthetic/unmapped events
    await db.collection('stripeOrphans').doc(String(subscription.id)).set({
      reason: 'No user doc with this stripeCustomerId',
      customerId,
      status: subscription.status,
      createdAt: FieldValue.serverTimestamp(),
    });
    return null;
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
    currency: item?.price?.currency || null,
    amount: item?.price?.unit_amount ?? null,
    productId: item?.price?.product || null,
    updatedAt: FieldValue.serverTimestamp(),
  };

  await db.collection('users').doc(uid).set(payload, { merge: true });
  return uid;
}

/** Map uid ↔ customer on real subscription checkout; optionally enrich sub immediately */
async function handleCheckoutCompleted(session) {
  if (session.mode !== 'subscription') return { note: 'ignored non-subscription session' };

  const uid = session.metadata?.uid || null;
  const customerId = typeof session.customer === 'string' ? session.customer : null;
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;

  if (uid && customerId) {
    const cd = session.customer_details || {};
    await db.collection('users').doc(uid).set({
      stripeCustomerId: customerId,
      lastCheckoutSessionId: session.id,
      stripeCustomer: {
        email: cd.email || null,
        name: cd.name || null,
        address: cd.address || null,
      },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  // Optional: enrich immediately (sub events will also update shortly after)
  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(
        subscriptionId,
        { expand: ['items.data.price'] }
      );
      await writeFromSubscriptionEvent(sub);
    } catch (e) {
      console.warn('[webhook] could not retrieve subscription immediately:', e.message);
    }
  }

  return { uid, customerId, subscriptionId };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    const buf = await buffer(req);
    const event = stripe.webhooks.constructEvent(buf, sig, secret);
    console.log('🔔', event.type);

    // Always log the raw event first
    await logStripeEvent({ event, rawLength: buf.length });

    // Subscription lifecycle writes
    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      try {
        const subscription = event.data.object;
        const uid = await writeFromSubscriptionEvent(subscription);
        // update log with the discovered uid (if any)
        if (uid) await logStripeEvent({ event, rawLength: buf.length, uid, hint: { updatedFrom: 'sub' } });
      } catch (e) {
        console.error('[handler] sub-event write failed:', e);
        // Still return 200 so Stripe CLI doesn't hammer retries while you debug
        return res.status(200).json({ received: true, noted: 'sub write failed (see logs)' });
      }
    }

    // Map uid ↔ customer on real checkout
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const result = await handleCheckoutCompleted(session);
      await logStripeEvent({
        event,
        rawLength: buf.length,
        uid: result?.uid || null,
        hint: { mappedFrom: 'checkout.session.completed' },
      });
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[webhook] top-level error:', err?.stack || err?.message || err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
}
