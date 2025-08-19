// pages/accounts.js
import Head from "next/head";

export default function Accounts() {
  return (
    <>
      <Head>
        <title>Account – PixelProof</title>
      </Head>

      <main className="min-h-screen bg-gradient-to-b from-[#f7f8ff] to-white">
        {/* Top bar: signed-in banner (static) */}
        <div className="max-w-6xl mx-auto px-6 pt-8 pb-4 flex items-center justify-end gap-3">
          <span className="text-[15px] text-slate-600">
            Signed in as <span className="font-semibold text-slate-800">Hasnain Ali</span>
          </span>
          <div className="h-9 w-9 rounded-full overflow-hidden ring-1 ring-black/5">
            {/* Static avatar image; swap src if you like */}
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
                HA
              </div>
              <div>
                <div className="text-slate-900 font-semibold">Hasnain Ali</div>
                <div className="text-slate-600 text-sm">hasnain@gmail.com</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                <div className="text-slate-600 text-sm mb-1">Billing email</div>
                <div className="font-semibold text-slate-900">billing@example.com</div>
                <div className="text-xs text-slate-500 mt-1">(different email is okay)</div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                <div className="text-slate-600 text-sm mb-1">Login email</div>
                <div className="font-semibold text-slate-900">hasnain@gmail.com</div>
              </div>
            </div>
          </section>

          {/* Plan card */}
          <aside className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Current Plan</h2>

            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 mb-5 relative">
              <div className="absolute right-3 top-3">
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                  active
                </span>
              </div>
              <div className="text-slate-800 font-semibold">Elite</div>
              <div className="mt-1">
                <span className="text-3xl font-extrabold text-slate-900">$99.99</span>
                <span className="text-slate-600"> / mo</span>
              </div>
              <div className="text-slate-600 text-sm mt-2">
                Renews on Sep 19, 2025
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                className="w-full h-11 rounded-xl bg-[#6c2bd9] text-white font-medium shadow-sm hover:brightness-95 transition"
                aria-label="Upgrade plan"
              >
                Upgrade plan
              </button>

              <button
                type="button"
                className="w-full h-11 rounded-xl border border-violet-300 text-[#6c2bd9] bg-white font-medium hover:bg-violet-50 transition"
                aria-label="Downgrade plan"
              >
                Downgrade plan
              </button>

              <button
                type="button"
                className="w-full h-11 rounded-xl border border-amber-300 text-amber-800 bg-amber-50 font-medium hover:bg-amber-100 transition"
                aria-label="Cancel subscription"
              >
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
            <button
              type="button"
              className="h-11 px-5 rounded-xl bg-rose-600 text-white font-medium shadow-sm hover:bg-rose-700 transition"
              aria-label="Delete subscription"
            >
              Delete subscription
            </button>
          </section>
        </div>
      </main>
    </>
  );
}
