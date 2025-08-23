// lib/billing/quota.js
import admin from 'firebase-admin';
import { limitForPlan, todayKey } from '@/lib/billing/limit';

/** Ensure Firebase Admin is initialized (safe, idempotent). */
function ensureAdmin() {
  if (admin.apps.length) return admin.app();

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT;

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey?.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin env (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY)'
    );
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
}

/**
 * Accepts either a UID or a full Firebase ID token string.
 * Verifies identity, checks subscription access (status + grace),
 * maps plan → limit, and consumes 1 from today's quota.
 * Throws Error with .code = 'NO_PLAN' or 'LIMIT_EXCEEDED'.
 */
export async function checkAndConsumeQuota(identity) {
  ensureAdmin();
  const authAdmin = admin.auth();
  const db = admin.firestore();

  // derive uid from token or treat identity as uid
  let uid = identity;
  if (typeof identity === 'string' && identity.includes('.') && identity.length > 200) {
    const decoded = await authAdmin.verifyIdToken(identity);
    uid = decoded.uid;
  }
  if (!uid) {
    const e = new Error('Missing user identity for quota check.');
    e.code = 'NO_PLAN';
    throw e;
  }

  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const d = userSnap.exists ? userSnap.data() : {};

  // access rules
  const status = d?.subscriptionStatus || null; // 'active' | 'trialing' | 'past_due' | null
  const cancelAtPeriodEnd = !!d?.cancelAtPeriodEnd;
  const endMs = (() => {
    const x = d?.currentPeriodEnd;
    if (!x) return null;
    if (typeof x?.toDate === 'function') return x.toDate().getTime();
    if (typeof x === 'number') return x > 1e12 ? x : x * 1000;
    const parsed = Date.parse(x);
    return Number.isNaN(parsed) ? null : parsed;
  })();
  const now = Date.now();
  const inGrace = cancelAtPeriodEnd && endMs && endMs > now;

  const ok = new Set(['active', 'trialing', 'past_due']);
  const hasAccess = ok.has(status) || inGrace;

  if (!hasAccess) {
    const e = new Error('No active subscription. Please buy a plan first.');
    e.code = 'NO_PLAN';
    throw e;
  }

  // plan → limit
  const plan = String(
    d?.activePlan ||
    d?.plan ||
    d?.tier ||
    d?.subscription?.plan ||
    d?.subscription?.tier
  ).toLowerCase();

  const max = limitForPlan(plan);
  if (max <= 0) {
    const e = new Error('No active plan. Please buy a plan first.');
    e.code = 'NO_PLAN';
    throw e;
  }

  // per-user daily counter under users/{uid}/quota/daily
  const quotaRef = userRef.collection('quota').doc('daily');
  const today = todayKey();

  await db.runTransaction(async (t) => {
    const s = await t.get(quotaRef);
    const sameDay = s.exists && s.get('day') === today;
    const used = sameDay ? Number(s.get('count') || 0) : 0;

    if (used >= max) {
      const e = new Error(`Daily limit reached for your ${plan} plan (${max}/day).`);
      e.code = 'LIMIT_EXCEEDED';
      throw e;
    }

    t.set(
      quotaRef,
      { day: today, count: used + 1, max, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
  });

  return { uid, plan, max };
}
