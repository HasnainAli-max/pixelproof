// lib/billing/quota.js
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (!getApps().length) initializeApp();
const authAdmin = getAuth();
const db = getFirestore();

// Daily limits per plan
const DAILY_LIMITS = { basic: 1, pro: 2, elite: 4 };

export function limitForPlan(plan) {
  return DAILY_LIMITS[String(plan || "").toLowerCase()] ?? 0;
}

function toMs(tsLike) {
  if (!tsLike) return null;
  if (typeof tsLike?.toDate === "function") return tsLike.toDate().getTime();
  if (typeof tsLike === "number") return tsLike > 1e12 ? tsLike : tsLike * 1000;
  const t = Date.parse(tsLike);
  return Number.isNaN(t) ? null : t;
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

/**
 * Verifies idToken, checks subscription access (status + grace),
 * maps plan → limit, and consumes 1 from today's quota.
 * Throws Error with .code = 'NO_PLAN' or 'LIMIT_EXCEEDED'.
 */
export async function checkAndConsumeQuota(idToken) {
  const decoded = await authAdmin.verifyIdToken(idToken);
  const uid = decoded.uid;

  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const d = userSnap.exists ? userSnap.data() : {};

  const status = d?.subscriptionStatus || null;
  const cancelAtPeriodEnd = !!d?.cancelAtPeriodEnd;
  const endMs = toMs(d?.currentPeriodEnd);
  const now = Date.now();
  const inGrace = cancelAtPeriodEnd && endMs && endMs > now;

  const ok = new Set(["active", "trialing", "past_due"]);
  const hasAccess = ok.has(status) || inGrace;

  if (!hasAccess) {
    const e = new Error("No active subscription. Please buy a plan first.");
    e.code = "NO_PLAN";
    throw e;
  }

  const plan = String(d?.activePlan || "").toLowerCase();
  const max = limitForPlan(plan);
  if (max <= 0) {
    const e = new Error("No active plan. Please buy a plan first.");
    e.code = "NO_PLAN";
    throw e;
  }

  const quotaRef = userRef.collection("quota").doc("daily");
  const today = todayKey();

  await db.runTransaction(async (t) => {
    const s = await t.get(quotaRef);
    const sameDay = s.exists && s.get("day") === today;
    const used = sameDay ? Number(s.get("count") || 0) : 0;

    if (used >= max) {
      const e = new Error(`Daily limit reached for your ${plan} plan (${max}/day).`);
      e.code = "LIMIT_EXCEEDED";
      throw e;
    }

    t.set(
      quotaRef,
      { day: today, count: used + 1, max, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  });

  return { uid, plan, max };
}
