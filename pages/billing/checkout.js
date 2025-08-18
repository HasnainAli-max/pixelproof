// pages/billing/checkout.js
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { auth } from '@/lib/firebase/config'; // your client Firebase

export default function CheckoutRunner() {
  const router = useRouter();
  const [msg, setMsg] = useState('Preparing checkout…');
  const launched = useRef(false);

  useEffect(() => {
    if (!router.isReady) return;

    const raw = router.query.plan;       // 'basic' | 'pro' | 'elite'
    const plan = Array.isArray(raw) ? raw[0] : raw;

    if (!plan) {
      setMsg('Missing plan. Please go back and choose a plan.');
      return;
    }
    if (launched.current) return;
    launched.current = true;

    (async () => {
      const user = auth.currentUser;
      if (!user) {
        router.replace(`/login?next=/billing/checkout?plan=${encodeURIComponent(plan)}`);
        return;
      }
      try {
        const idToken = await user.getIdToken();
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ plan }), // ✅ send plan slug
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.url) {
          window.location.href = data.url; // Stripe Checkout
        } else {
          console.error('Checkout error:', res.status, data);
          setMsg(data?.error || 'Could not create checkout session. Please try again.');
        }
      } catch (e) {
        console.error(e);
        setMsg('Network error. Please try again.');
      }
    })();
  }, [router.isReady, router.query.plan]);

  return (
    <div style={{ padding: 24 }}>
      <h1>{msg}</h1>
      <p>If this takes more than a few seconds, go back to Pricing and pick a plan again.</p>
    </div>
  );
}
