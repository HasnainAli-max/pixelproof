import { useEffect } from 'react';
import { getAuth } from 'firebase/auth';

export default function Success() {
  useEffect(() => {
    (async () => {
      const auth = getAuth();
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) return;

      // Pull latest subscription and update Firestore
      await fetch('/api/subscription/status', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
    })();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Payment successful</h1>
      <p>Your subscription status has been refreshed. You can close this tab.</p>
    </div>
  );
}
