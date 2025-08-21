import Head from "next/head";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase/config";
import { doc, getDoc } from "firebase/firestore";
import Navbar from "@/components/Navbar";

const PLANS = [
  { slug: "basic", name: "Basic", price: "$9.99 / mo" },
  { slug: "pro",   name: "Pro",   price: "$49.99 / mo" },
  { slug: "elite", name: "Elite", price: "$99.99 / mo" },
];

// Helper: normalize Firestore Timestamp | seconds | millis | ISO → ms
function toMs(tsLike) {
  if (!tsLike) return null;
  if (typeof tsLike?.toDate === "function") return tsLike.toDate().getTime();
  if (typeof tsLike === "number") return tsLike > 1e12 ? tsLike : tsLike * 1000;
  const t = Date.parse(tsLike);
  return Number.isNaN(t) ? null : t;
}

// Helper: decide if a user doc currently has access
function hasActiveAccess(d) {
  const status = d?.subscriptionStatus || null;
  const cancelAtPeriodEnd = !!d?.cancelAtPeriodEnd;
  const endMs = toMs(d?.currentPeriodEnd);
  const now = Date.now();
  const inGrace = cancelAtPeriodEnd && endMs && endMs > now;

  // Count these as "active" access. Remove "past_due" if you want to be stricter.
  const ok = new Set(["active", "trialing", "past_due"]);
  return ok.has(status) || inGrace;
}

export default function BillingIndex() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [decidingSlug, setDecidingSlug] = useState(null); // which card is checking

  // Track auth (viewable while signed out)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, []);

  // Click handler: check Firestore then decide
  const choose = async (slug) => {
    const next = `/billing/checkout?plan=${encodeURIComponent(slug)}`;

    // If not signed in → go to signup first
    if (!auth.currentUser) {
      router.push(`/signup?next=${encodeURIComponent(next)}`);
      return;
    }

    try {
      setDecidingSlug(slug);

      // Read the latest user doc directly from Firestore
      const ref = doc(db, "users", auth.currentUser.uid);
      const snap = await getDoc(ref);
      const data = snap.exists() ? snap.data() : {};

      if (hasActiveAccess(data)) {
        alert("Your subscription is already active.");
        // Optional: also send them to the app
        // router.replace("/utility");
        return;
      }

      // No active access → proceed to checkout for this plan
      router.push(next);
    } catch (err) {
      console.error("Plan decide error:", err);
      // If the check fails, you can still let them try checkout:
      // alert("Could not verify your subscription right now. Sending you to checkout.");
      router.push(next);
    } finally {
      setDecidingSlug(null);
    }
  };

  return (
    <>
      <Head><title>Plans – PixelProof</title></Head>
      <Navbar user={user} />

      <main className="min-h-screen bg-gradient-to-b from-[#f7f8ff] to-white dark:from-slate-950 dark:to-slate-900">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mb-6">
            Choose a plan
          </h1>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PLANS.map((p) => {
              const waiting = decidingSlug === p.slug && !!user; // show spinner only when signed-in and checking
              return (
                <div
                  key={p.slug}
                  className="rounded-2xl p-6 bg-white dark:bg-slate-800 ring-1 ring-black/5 dark:ring-white/10"
                >
                  <div className="text-xl font-semibold">{p.name}</div>
                  <div className="mt-2 text-slate-600 dark:text-slate-300">{p.price}</div>

                  <button
                    onClick={() => choose(p.slug)}
                    disabled={waiting}
                    className="mt-6 w-full h-11 rounded-xl bg-[#6c2bd9] text-white font-medium hover:brightness-95 disabled:opacity-60"
                  >
                    {waiting ? "Checking…" : `Select ${p.name}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}
