"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase/config";
import { onAuthStateChanged, signOut as fbSignOut } from "firebase/auth";

export default function Navbar({ user: userProp, onSignOut }) {
  const [open, setOpen] = useState(false);
  const [selfUser, setSelfUser] = useState(null);

  // If no user prop is provided, listen to Firebase auth as a fallback
  useEffect(() => {
    let unsub;
    if (!userProp) {
      unsub = onAuthStateChanged(auth, (u) => setSelfUser(u));
    } else {
      setSelfUser(userProp);
    }
    return () => unsub && unsub();
  }, [userProp]);

  const user = userProp || selfUser;

  // Close on Esc
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Initials fallback for avatar
  const initials = useMemo(() => {
    if (!user) return "";
    const name = user.displayName || user.email || "";
    const parts = name.replace(/@.*$/, "").split(/[.\s_-]+/).filter(Boolean);
    const first = parts[0]?.[0] || "";
    const second = parts[1]?.[0] || "";
    return (first + second).toUpperCase();
  }, [user]);

  const handleLogout = async () => {
    try {
      if (onSignOut) {
        await onSignOut();
      } else {
        await fbSignOut(auth);
      }
    } catch (e) {
      console.error("Sign out failed:", e);
    }
  };

  return (
    <header className="w-full border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-2">
          <img src="/logo.svg" alt="Logo" className="h-6 w-6" />
          <span className="text-lg font-bold text-purple-800 dark:text-purple-300">PixelProof</span>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-4 text-sm">
          {user && (
            <>
              <span className="text-gray-600 dark:text-gray-300 hidden sm:inline">
                Signed in as <strong>{user.displayName || user.email}</strong>
              </span>

              {/* Avatar button (opens sidebar) */}
              <button
                onClick={() => setOpen(true)}
                className="relative inline-flex items-center justify-center h-9 w-9 rounded-full ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                aria-label="Open menu"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Profile"
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-full w-full grid place-items-center bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white font-semibold">
                    {initials || "U"}
                  </div>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Offcanvas Sidebar (always mounted for smooth close animation) */}
      {user && (
        <div
          className={`fixed inset-0 z-50 transition-opacity duration-300 ${
            open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          aria-hidden={!open}
          onClick={() => setOpen(false)} // click anywhere to close
        >
          {/* Backdrop */}
          <div
            className={`absolute inset-0 bg-black/40 backdrop-blur-[1px] transition-opacity duration-300 ${
              open ? "opacity-100" : "opacity-0"
            }`}
          />

          {/* Panel */}
          <aside
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
            className={`absolute right-0 top-0 h-full w-80 max-w-[90%] bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-800 transform transition-transform duration-300 ease-in-out
              ${open ? "translate-x-0" : "translate-x-full"}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Profile"
                    className="h-9 w-9 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-700"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full grid place-items-center bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white font-semibold ring-1 ring-gray-200 dark:ring-gray-700">
                    {initials || "U"}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {user.displayName || user.email}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                </div>
              </div>

              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {/* X icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700 dark:text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            {/* Menu */}
            <nav className="px-2 py-3">
              <Link
                href="/utility"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200"
                onClick={() => setOpen(false)}
              >
                <span className="inline-block h-2 w-2 rounded-full bg-fuchsia-600" />
                <span className="text-sm font-medium">Home</span>
              </Link>
              <Link
                href="/profile"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200"
                onClick={() => setOpen(false)}
              >
                <span className="inline-block h-2 w-2 rounded-full bg-purple-600" />
                <span className="text-sm font-medium">Profile</span>
              </Link>

              <Link
                href="/accounts"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200"
                onClick={() => setOpen(false)}
              >
                <span className="inline-block h-2 w-2 rounded-full bg-fuchsia-600" />
                <span className="text-sm font-medium">Accounts</span>
              </Link>

              <button
                onClick={async () => {
                  setOpen(false);
                  await handleLogout();
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200"
              >
                Logout
              </button>
            </nav>
          </aside>
        </div>
      )}
    </header>
  );
}
