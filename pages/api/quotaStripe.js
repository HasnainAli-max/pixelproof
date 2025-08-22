// lib/billing/quotaStripe.js
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import Stripe from "stripe";

if (!getApps().length) initializeApp();
const authAdmin = getAuth();
const db = getFirestore();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

const DAILY_LIMITS = { basic: 1, pro: 2, elite: 3 };

function limitForPlan(plan) {
  return DAILY_LIMITS[String(plan || "").toLowerCase()] ?? 0;
}
function todayKey() { return new Date().toISOString().slice(0, 10); }

function mapPriceIdToPlan(priceId) {
  try {
    if (!process.env.STRIPE_PRICE_PLAN_MAP) return null;
    const map = JSON.parse(process.env.STRIPE_PRICE_PLAN_MAP);
    return map[priceId] || null;
  } catch { return null; }
}

function fromPriceMeta(price) {
  const lk = (price?.lookup_key || "").toLowerCase();
  if (["basic","pro","elite"].includes(lk)) return lk;
  const nick = (price?.nickname || "").toLowerCase();
  if (["basic","pro","elite"].includes(nick)) return nick;
  const fromMap = mapPriceIdToPlan(price?.id);
  if (fromMap) return fromMap;
  return null;
}

export async function checkAndConsumeQuotaStripe(idToken) {
  const decoded = await authAdmin.verifyIdToken(idToken);
  const uid = decoded.uid;

  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const user = userSnap.exists ? userSnap.data() : {};
  const stripeCustomerId = user?.stripeCustomerId || user?.stripeCustomer?.id;
  if (!stripeCustomerId) {
    const e = new Error("No Stripe customer on file."); e.code = "NO_CUSTOMER"; throw e;
  }

  // Shallow expand only (NO price.product)
  const subs = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
    limit: 5,
    expand: ["data.items.data.price"],
  });

  const now = Date.now() / 1000;
  const sub = subs.data.find((s) =>
    s.status === "active" ||
    s.status === "trialing" ||
    (s.cancel_at_period_end && s.current_period_end > now)
  );
  if (!sub) {
    const e = new Error("No active plan. Please choose a plan."); e.code = "NO_PLAN"; throw e;
  }

  const price = sub.items?.data?.[0]?.price;
  let plan = fromPriceMeta(price);

  // Fallback: fetch product name (no deep expand)
  if (!plan && price?.product) {
    try {
      const prodId = typeof price.product === "string" ? price.product : price.product.id;
      const product = await stripe.products.retrieve(prodId);
      const pname = (product?.name || "").toLowerCase();
      if (pname.includes("elite")) plan = "elite";
      else if (pname.includes("pro")) plan = "pro";
      else if (pname.includes("basic")) plan = "basic";
    } catch (_) {}
  }

  const max = limitForPlan(plan);
  if (max <= 0) {
    const e = new Error("No active plan. Please choose a plan."); e.code = "NO_PLAN"; throw e;
  }

  const quotaRef = userRef.collection("quota").doc("daily");
  const today = todayKey();

  await db.runTransaction(async (t) => {
    const s = await t.get(quotaRef);
    const used = s.exists && s.get("day") === today ? (s.get("count") || 0) : 0;
    if (used >= max) {
      const e = new Error(`Daily limit reached for your ${plan} plan (${max}/day).`);
      e.code = "LIMIT_EXCEEDED"; throw e;
    }
    t.set(quotaRef, { day: today, count: used + 1, max, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });

  return { uid, plan, max };
}
