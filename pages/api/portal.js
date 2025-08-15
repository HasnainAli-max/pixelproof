import { stripe } from '@/lib/stripe';
import { authAdmin, db } from '@/lib/firebase/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing ID token' });
    const { uid } = await authAdmin.verifyIdToken(token);

    const doc = await db.collection('users').doc(uid).get();
    const customerId = doc.get('stripeCustomerId');
    if (!customerId) return res.status(400).json({ error: 'No Stripe customer for user' });

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.APP_URL}/billing`,
    });

    res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('portal error', e);
    res.status(500).json({ error: 'Internal error' });
  }
}
