import { stripe } from '@/lib/stripe/stripe';
import { authAdmin, db, adminSdk } from '@lib/firebase/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing ID token' });
    const { uid } = await authAdmin.verifyIdToken(token);

    const { priceId } = req.body || {};
    if (!priceId) return res.status(400).json({ error: 'priceId is required' });

    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    let customerId = snap.get('stripeCustomerId');

    if (!customerId) {
      const userRecord = await authAdmin.getUser(uid);
      const customer = await stripe.customers.create({
        email: userRecord.email || undefined,
        metadata: { uid },
      });
      customerId = customer.id;
      await userRef.set({
        stripeCustomerId: customerId,
        updatedAt: adminSdk.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/`,
      metadata: { uid },
    });

    res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('checkout error', e);
    res.status(500).json({ error: 'Internal error' });
  }
}
