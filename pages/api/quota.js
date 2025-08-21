// lib/billing/quota.js
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (!getApps().length) initializeApp();
const authAdmin = getAuth();
const db = getFirestore();

// per-day limits
const DAILY_LIMITS = { basic: 1, pro: 2, elite: 3 };

export function limitForPlan(plan) {
  return DAILY_LIMITS[String(plan || "").toLowerCase()] ?? 0;
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

/**
 * Verifies idToken, reads users/{uid}, and consumes 1 quota for today.
 * Throws if no access or limit reached.
 */
export async function checkAndConsumeQuota(idToken) {
  const decoded = await authAdmin.verifyIdToken(idToken);
  const uid = decoded.uid;

  const userSnap = await db.collection("users").doc(uid).get();
  const user = userSnap.exists ? userSnap.data() : {};
  const plan = String(user?.activePlan || "").toLowerCase();
  const max = limitForPlan(plan);

  if (max <= 0) throw new Error("No active plan. Please choose a plan.");

  const quotaRef = db.collection("users").doc(uid).collection("quota").doc("daily");
  const today = todayKey();

  await db.runTransaction(async (t) => {
    const s = await t.get(quotaRef);
    const currentDay = s.exists ? s.get("day") : null;
    const used = s.exists && currentDay === today ? (s.get("count") || 0) : 0;

    if (used >= max) {
      throw new Error(`Daily limit reached for your ${plan || "current"} plan (${max}/day).`);
    }

    t.set(
      quotaRef,
      { day: today, count: used + 1, max, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  });

  return { uid, plan, max };
}
