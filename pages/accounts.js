// pages/accounts.js
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";

export default function Accounts() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1) Watch auth, redirect if not logged in
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace("/login");
      } else {
        setAuthUser(u);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Watch Firestore user doc once we have a uid
  useEffect(() => {
    if (!authUser?.uid) return;
    const ref = doc(db, "users", authUser.uid);
    const unsub = onSnapshot(ref, (snap) => {
      setUserDoc(snap.exists() ? snap.data() : null);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [authUser?.uid]);

  // 3) Derived display fields (safe fallbacks)
  const view = useMemo(() => {
    const name =
      userDoc?.displayName ||
      [userDoc?.firstName, userDoc?.lastName].filter(Boolean).join(" ") ||
      authUser?.displayName ||
      "—";

    const loginEmail = authUser?.email || userDoc?.email || "—";
    const billingEmail =
      userDoc?.stripeCustomer?.email || userDoc?.email || loginEmail;

    const planRaw = userDoc?.activePlan || null;
    const plan =
      planRaw ? planRaw.charAt(0).toUpperCase() + planRaw.slice(1) : "No plan";

    const amount =
      typeof userDoc?.amount === "number"
        ? (userDoc.amount / 100).toFixed(2)
        : "—";

    const status = userDoc?.subscriptionStatus || "inactive";

    const renewDate = formatDate(userDoc?.currentPeriodEnd);

    return { name, loginEmail, billingEmail, plan, amount, status, renewDate };
  }, [userDoc, authUser]);

  if (loading) {
    return (
      <main className="min-h-screen grid place-items-center text-slate-600">
        Loading account…
      </main>
    );
  }

  if (!authUser) return null; // brief guard during redirect

  return (
    <>
      <Head>
        <title>Account – PixelProof</title>
      </Head>

      <main className="min-h-screen bg-gradient-to-b from-[#f7f8ff] to-white">
        {/* Top bar: signed-in banner */}
        <div className="max-w-6xl mx-auto px-6 pt-8 pb-4 flex items-center justify-end gap-3">
          <span className="text-[15px] text-slate-600">
            Signed in as{" "}
            <span className="font-semibold text-slate-800">{view.name}</span>
          </span>
          <div className="h-9 w-9 rounded-full overflow-hidden ring-1 ring-black/5">
            <img
              alt="avatar"
              className="h-full w-full object-cover"
              src="https://images.unsplash.com/photo-1527980965255-d3b416303d12?q=80&w=200&auto=format&fit=crop"
            />
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 pb-14 grid lg:grid-cols-3 gap-6">
          {/* Profile card */}
          <section className="lg:col-span-2 bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Profile</h2>

            <div className="flex items-center gap-4 mb-6">
              <div className="h-14 w-14 flex items-center justify-center rounded-full bg-violet-100 text-violet-700 font-bold">
                {initials(view.name)}
              </div>
              <div>
                <div className="text-slate-900 font-semibold">{view.name}</div>
                <div className="text-slate-600 text-sm">{view.loginEmail}</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                <div className="text-slate-600 text-sm mb-1">Billing email</div>
                <div className="font-semibold text-slate-900">{view.billingEmail}</div>
                <div className="text-xs text-slate-500 mt-1">(different email is okay)</div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                <div className="text-slate-600 text-sm mb-1">Login email</div>
                <div className="font-semibold text-slate-900">{view.loginEmail}</div>
              </div>
            </div>
          </section>

          {/* Plan card */}
          <aside className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Current Plan</h2>

            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 mb-5 relative">
              <div className="absolute right-3 top-3">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  view.status === "active"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-200 text-slate-700"
                }`}>
                  {view.status}
                </span>
              </div>
              <div className="text-slate-800 font-semibold">{view.plan}</div>
              <div className="mt-1">
                <span className="text-3xl font-extrabold text-slate-900">
                  {view.amount !== "—" ? `$${view.amount}` : "—"}
                </span>
                {view.amount !== "—" && <span className="text-slate-600"> / mo</span>}
              </div>
              <div className="text-slate-600 text-sm mt-2">
                {view.renewDate ? `Renews on ${view.renewDate}` : "No renewal scheduled"}
              </div>
            </div>

            {/* Buttons are static (no handlers) */}
            <div className="space-y-3">
              <button type="button" className="w-full h-11 rounded-xl bg-[#6c2bd9] text-white font-medium shadow-sm hover:brightness-95 transition">
                Upgrade plan
              </button>
              <button type="button" className="w-full h-11 rounded-xl border border-violet-300 text-[#6c2bd9] bg-white font-medium hover:bg-violet-50 transition">
                Downgrade plan
              </button>
              <button type="button" className="w-full h-11 rounded-xl border border-amber-300 text-amber-800 bg-amber-50 font-medium hover:bg-amber-100 transition">
                Cancel subscription
              </button>
            </div>
          </aside>

          {/* Danger Zone */}
          <section className="lg:col-span-3 bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-6 mt-2">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Danger Zone</h3>
            <p className="text-slate-600 text-sm mb-4">
              Deleting the subscription removes access immediately and cannot be undone.
            </p>
            <button type="button" className="h-11 px-5 rounded-xl bg-rose-600 text-white font-medium shadow-sm hover:bg-rose-700 transition">
              Delete subscription
            </button>
          </section>
        </div>
      </main>
    </>
  );
}

/* ---------- helpers ---------- */
function initials(name = "") {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase() || "").join("") || "PP";
}

function formatDate(tsLike) {
  if (!tsLike) return "";
  // Firestore Timestamp
  if (typeof tsLike?.toDate === "function") return tsLike.toDate().toLocaleDateString();
  // seconds (Stripe) or millis
  if (typeof tsLike === "number") {
    const ms = tsLike > 1e12 ? tsLike : tsLike * 1000;
    return new Date(ms).toLocaleDateString();
  }
  // ISO string
  const d = new Date(tsLike);
  return isNaN(d) ? "" : d.toLocaleDateString();
}
