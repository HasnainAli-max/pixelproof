import Head from "next/head";
import { useRouter } from "next/router";

export default function Success() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>Payment Successful – PixelProof</title>
      </Head>

      <main className="min-h-screen bg-gradient-to-b from-[#f7f8ff] to-white dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl p-6 bg-white dark:bg-slate-800 ring-1 ring-black/5 dark:ring-white/10 text-center">
          {/* Icon */}
          <div className="mx-auto h-14 w-14 grid place-items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 mb-4">
            <svg
              className="h-7 w-7 text-emerald-600 dark:text-emerald-300"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M20 7L9 18l-5-5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Text */}
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Payment successful
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            Thanks! Your subscription is now active. You can start using PixelProof right away.
          </p>

          {/* Primary CTA */}
          <button
            type="button"
            onClick={() => router.push("/utility")}
            className="mt-6 w-full h-11 rounded-xl bg-[#6c2bd9] text-white font-medium shadow-sm hover:brightness-95 transition"
          >
            Go to Utility
          </button>

          {/* Helper note */}
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            If you don’t get access, please wait a few seconds for your subscription to sync.
          </p>
        </div>
      </main>
    </>
  );
}
