import React from 'react';
import Link from 'next/link';
import Head from 'next/head';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Head>
        <title>PixelProof – AI-powered QA</title>
      </Head>

      {/* Header */}
      <header className="bg-purple-800 text-white px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">PIXELPROOF</h1>
        <div>
          <Link href="/login">
            <button className="text-white hover:underline">Sign in</button>
          </Link>
          <Link href="/signup">
            <button className="ml-2 border border-white text-white hover:bg-white hover:text-purple-800 px-4 py-1 rounded">
              Sign up
            </button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-purple-800 text-white py-10 px-6 animate-fade-in">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between">
          <div className="md:w-1/2 mb-6 md:mb-0">
            <img
              src="/images/pixelproof-ai-assistant.png"
              alt="AI QA Assistant"
              className="w-full max-w-sm object-contain mx-auto md:mx-0"
            />
          </div>
          <div className="md:w-1/2 text-center md:text-left space-y-4 px-2">
            <h2 className="text-3xl md:text-4xl font-bold leading-snug">
              Eliminate UI Bugs <br className="hidden md:block" /> Before They Reach Production
            </h2>
            <p className="text-base md:text-lg text-purple-100">
              PixelProof automates your design-to-code validation process, ensuring consistent UI delivery —
              without manual QA bottlenecks.
            </p>
            <ul className="text-sm md:text-base space-y-1 list-disc list-inside text-purple-100">
              <li>Instant visual comparisons between design and final build</li>
              <li>Well Formatted AI-generated QA reports ready for stakeholder sharing</li>
              <li>No setup, no guessing — just accurate detection</li>
            </ul>
            <Link href="/login">
              <button className="mt-4 bg-white text-purple-800 font-bold py-2 px-6 rounded-full hover:bg-purple-100 transition">
                Get Started
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="bg-white text-center py-16 px-6">
        <h2 className="text-3xl font-bold mb-8 text-purple-800">Pricing Plans</h2>
        <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto">
          {/* Starter */}
          <div className="border rounded-lg p-6 shadow hover:shadow-lg transition transform hover:scale-105">
            <h3 className="text-xl font-semibold text-purple-700 mb-2">Starter</h3>
            <p className="text-4xl font-bold text-purple-800 mb-2">$19.99</p>
            <p className="text-sm text-gray-600 mb-4">100 comparisons / month</p>
            <Link href="/login">
              <button className="bg-purple-800 text-white w-full py-2 rounded">Choose Starter</button>
            </Link>
          </div>

          {/* Pro */}
          <div className="border-2 border-purple-600 rounded-lg p-6 shadow-lg transform scale-105 bg-purple-50">
            <h3 className="text-xl font-semibold text-purple-700 mb-2">Pro</h3>
            <p className="text-4xl font-bold text-purple-800 mb-2">$49.99</p>
            <p className="text-sm text-gray-600 mb-4">500 comparisons / month</p>
            <Link href="/login">
              <button className="bg-purple-800 text-white w-full py-2 rounded">Choose Pro</button>
            </Link>
          </div>

          {/* Unlimited */}
          <div className="border rounded-lg p-6 shadow hover:shadow-lg transition transform hover:scale-105">
            <h3 className="text-xl font-semibold text-purple-700 mb-2">Unlimited</h3>
            <p className="text-4xl font-bold text-purple-800 mb-2">$99.99</p>
            <p className="text-sm text-gray-600 mb-4">Unlimited comparisons</p>
            <Link href="/login">
              <button className="bg-purple-800 text-white w-full py-2 rounded">Choose Unlimited</button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-6 text-gray-500 text-sm">
        PixelProof © 2025 | Privacy Policy | Terms of Service
      </footer>

      {/* Animation Style */}
      <style jsx global>{`
        .animate-fade-in {
          animation: fadeIn 1.2s ease-out;
        }
        @keyframes fadeIn {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

