// pages/accounts.js
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import Navbar from "@/components/Navbar";

export default function Accounts() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch (e) {
      console.error("Sign out failed:", e);
    }
  };

  // auth guard
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.replace("/login");
      else setAuthUser(u);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // user doc
  useEffect(() => {
    if (!authUser?.uid) return;
    const unsub = onSnapshot(
      doc(db, "users", authUser.uid),
      (snap) => {
        setUserDoc(snap.exists() ? snap.data() : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [authUser?.uid]);

  // derive display fields
  const view = useMemo(() => {
    const name =
      userDoc?.displayName ||
      [userDoc?.firstName, userDoc?.lastName].filter(Boolean).join(" ") ||
      authUser?.displayName ||
      "—";

    const loginEmail = authUser?.email || userDoc?.email || "—";
    const billingEmail = userDoc?.stripeCustomer?.email || userDoc?.email || loginEmail;

    const planRaw = userDoc?.activePlan || null;
    const plan = planRaw ? planRaw.charAt(0).toUpperCase() + planRaw.slice(1) : "No plan";

    const amount =
      typeof userDoc?.amount === "number" ? (userDoc.amount / 100).toFixed(2) : "—";

    const status = userDoc?.subscriptionStatus || "inactive";
    const cancelAtPeriodEnd = !!userDoc?.cancelAtPeriodEnd;

    const renewDate = formatDate(userDoc?.currentPeriodEnd);
    const endedOn = formatDate(userDoc?.endedAt);

    const statusLabel =
      status === "canceled" ? "canceled" : cancelAtPeriodEnd ? "canceling" : status;

    // ▼▼ UPDATED: show “Access until …” when active
    let subline = "—";
    if (status === "canceled") {
      subline = endedOn
        ? `Ended on ${endedOn}`
        : renewDate
        ? `Ended on ${renewDate}`
        : "Ended";
    } else if (cancelAtPeriodEnd) {
      subline = renewDate
        ? `Cancels on ${renewDate} • Access until ${renewDate}`
        : "Cancels at period end";
    } else if (status === "active") {
      subline = renewDate
        ? `Access until ${renewDate}`
        : "Access until end of current cycle";
    } else if (renewDate) {
      subline = `Access until ${renewDate}`;
    }

    return { name, loginEmail, billingEmail, plan, amount, statusLabel, subline };
  }, [userDoc, authUser]);

  async function openPortal(intent) {
    try {
      setBusy(true);
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ intent }), // 'update' | 'cancel' | 'delete'
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text);
      }
      if (!res.ok) throw new Error(data.error || "Failed to create portal session");

      window.location.href = data.url;
    } catch (e) {
      console.error("openPortal error:", e);
      alert(e.message || "Could not open customer portal.");
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen grid place-items-center text-slate-600 dark:text-slate-300">
        Loading account…
      </main>
    );
  }
  if (!authUser) return null;

  return (
    <>
      <Head>
        <title>Account – PixelProof</title>
      </Head>

      <Navbar user={authUser} onSignOut={handleSignOut} />

      <main className="min-h-screen bg-gradient-to-b from-[#f7f8ff] to-white dark:from-slate-950 dark:to-slate-900">
        <div className="max-w-6xl mx-auto px-6 pt-8 pb-4" />

        <div className="max-w-6xl mx-auto px-6 pb-14 grid lg:grid-cols-3 gap-6">
          {/* Profile */}
          <section className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm ring-1 ring-black/5 dark:ring-white/10 p-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-6">Profile</h2>

            <div className="flex items-center gap-4 mb-6">
              <div className="h-14 w-14 flex items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200 font-bold">
                {initials(view.name)}
              </div>
              <div>
                <div className="text-slate-900 dark:text-slate-100 font-semibold">{view.name}</div>
                <div className="text-slate-600 dark:text-slate-300 text-sm">{view.loginEmail}</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-700/60">
                <div className="text-slate-600 dark:text-slate-300 text-sm mb-1">Billing email</div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">{view.billingEmail}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">(different email is okay)</div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-700/60">
                <div className="text-slate-600 dark:text-slate-300 text-sm mb-1">Login email</div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">{view.loginEmail}</div>
              </div>
            </div>
          </section>

          {/* Plan */}
          <aside className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm ring-1 ring-black/5 dark:ring-white/10 p-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">Current Plan</h2>

            <div className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/40 p-5 mb-5 relative">
              <div className="absolute right-3 top-3">
                <Badge label={view.statusLabel} />
              </div>
              <div className="text-slate-800 dark:text-slate-100 font-semibold">{view.plan}</div>
              <div className="mt-1">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  {view.amount !== "—" ? `$${view.amount}` : "—"}
                </span>
                {view.amount !== "—" && (
                  <span className="text-slate-600 dark:text-slate-300"> / mo</span>
                )}
              </div>
              <div className="text-slate-600 dark:text-slate-300 text-sm mt-2">
                {view.subline}
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => openPortal("update")}
                className="w-full h-11 rounded-xl bg-[#6c2bd9] text-white font-medium shadow-sm hover:brightness-95 disabled:opacity-50 transition"
              >
                Update plan
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => openPortal("cancel")}
                className="w-full h-11 rounded-xl border border-amber-300 dark:border-amber-600 text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 font-medium hover:bg-amber-100 dark:hover:bg-amber-900/50 disabled:opacity-50 transition"
              >
                Cancel subscription
              </button>
            </div>
          </aside>

          {/* Danger Zone */}
          {/* <section className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm ring-1 ring-black/5 dark:ring-white/10 p-6 mt-2">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Danger Zone
            </h3>
            <p className="text-slate-600 dark:text-slate-300 text-sm mb-4">
              Deleting the subscription removes access immediately and cannot be undone.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => openPortal("delete")}
              className="h-11 px-5 rounded-xl bg-rose-600 text-white font-medium shadow-sm hover:bg-rose-700 disabled:opacity-50 transition dark:bg-rose-700 dark:hover:bg-rose-600"
            >
              Delete subscription
            </button>
          </section> */}
        </div>
      </main>
    </>
  );
}

/* ---------- small components/helpers ---------- */
function Badge({ label }) {
  const cls =
    label === "canceled"
      ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
      : label === "canceling"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}>{label}</span>
  );
}

function initials(name = "") {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "PP";
}

/** Robustly turn many "timestamp-like" shapes into a date string */
function formatDate(tsLike) {
  const ms = toMillis(tsLike);
  if (!ms) return "";
  return new Date(ms).toLocaleDateString();
}
function toMillis(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate().getTime();
  if (typeof v === "object") {
    if (typeof v.seconds === "number") return v.seconds * 1000;
    if (typeof v._seconds === "number") return v._seconds * 1000;
  }
  if (typeof v === "number" || (typeof v === "string" && v.trim() !== "")) {
    const n = Number(v);
    if (!Number.isNaN(n)) return n > 1e12 ? n : n * 1000;
  }
  const d = Date.parse(v);
  return Number.isNaN(d) ? null : d;
}
