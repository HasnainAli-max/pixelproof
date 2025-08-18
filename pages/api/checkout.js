// // pages/api/checkout.js
// import { stripe } from '@/lib/stripe/stripe';
// import { authAdmin } from '@/lib/firebase/firebaseAdmin';

// const PRICE_MAP = {
//   basic: process.env.STRIPE_PRICE_BASIC,
//   pro:   process.env.STRIPE_PRICE_PRO,
//   elite: process.env.STRIPE_PRICE_ELITE,
// };

// export default async function handler(req, res) {
//   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

//   try {
//     // Verify Firebase ID token
//     const auth = req.headers.authorization || '';
//     const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
//     if (!token) return res.status(401).json({ error: 'Missing ID token' });
//     const decoded = await authAdmin.verifyIdToken(token);

//     // Accept either { plan: 'basic'|'pro'|'elite' } or { priceId: 'price_...' }
//     const { plan, priceId } = req.body || {};
//     const resolvedPrice = priceId || (plan ? PRICE_MAP[plan] : null);

//     if (!resolvedPrice || !/^price_/.test(resolvedPrice)) {
//       return res.status(400).json({
//         error:
//           'Invalid or missing price. Set STRIPE_PRICE_BASIC/PRO/ELITE in .env.local, pass { plan: "basic|pro|elite" }.',
//       });
//     }

//     // Use user email from token
//     const userEmail = decoded.email || undefined;

//     const session = await stripe.checkout.sessions.create({
//       mode: 'subscription',
//       customer_email: userEmail, // Stripe will reuse or create a customer with this email
//       line_items: [{ price: resolvedPrice, quantity: 1 }],
//       success_url: `${process.env.APP_URL || 'http://localhost:3000'}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
//       cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/billing/cancel`,
//       metadata: { uid: decoded.uid, plan: plan || 'custom' },
//     });

//     return res.status(200).json({ url: session.url });
//   } catch (e) {
//     console.error('checkout error', e);
//     return res.status(500).json({ error: 'Internal Server Error' });
//   }
// }



import { stripe } from '@/lib/stripe/stripe';
import { authAdmin } from '@/lib/firebase/firebaseAdmin';

const PRICE_MAP = {
  basic: process.env.STRIPE_PRICE_BASIC,
  pro:   process.env.STRIPE_PRICE_PRO,
  elite: process.env.STRIPE_PRICE_ELITE,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing ID token' });

    const decoded = await authAdmin.verifyIdToken(token);
    const { plan, priceId } = req.body || {};
    const resolvedPrice = priceId || (plan ? PRICE_MAP[plan] : null);

    if (!resolvedPrice || !/^price_/.test(resolvedPrice)) {
      return res.status(400).json({
        error: 'Invalid or missing price. Check STRIPE_PRICE_* envs or pass { plan } or { priceId }.',
      });
    }

    const userEmail = decoded.email || undefined;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: userEmail,
      line_items: [{ price: resolvedPrice, quantity: 1 }],
      success_url: `${process.env.APP_URL || 'http://localhost:3000'}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/billing/cancel`,
      metadata: { uid: decoded.uid, plan: plan || 'custom' },
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('checkout error', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

