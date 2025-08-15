// pages/profile.js
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import { auth, db } from "@/lib/firebase/config";
import { onAuthStateChanged, updateProfile, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { Toaster, toast } from "sonner";
import Navbar from "@/components/Navbar";
import ChangePassword from "@/components/ChangePassword";

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  // display-only
  const [email, setEmail] = useState("");
  const [photoURL, setPhotoURL] = useState("");

  // editable fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(true);

  // derived
  const displayName = useMemo(() => {
    const name = `${firstName || ""} ${lastName || ""}`.trim();
    return name || "No name set";
  }, [firstName, lastName]);

  const initials = useMemo(() => {
    const a = (firstName || "").trim();
    const b = (lastName || "").trim();
    if (a || b) {
      return `${a?.[0] || ""}${b?.[0] || ""}`.toUpperCase() || "U";
    }
    const fromEmail = (email || "").trim().charAt(0);
    return (fromEmail || "U").toUpperCase();
  }, [firstName, lastName, email]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace("/login");
        return;
      }
      setUser(u);
      setEmail(u.email || "");
      setPhotoURL(u.photoURL || ""); // EXACTLY what Navbar uses

      // Load names from Firestore if present, otherwise parse from Auth displayName
      try {
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const d = snap.data();
          setFirstName(d.firstName || (u.displayName?.split(" ")?.[0] ?? ""));
          setLastName(d.lastName || (u.displayName?.split(" ")?.slice(1).join(" ") ?? ""));
        } else {
          const parts = (u.displayName || "").trim().split(" ").filter(Boolean);
          setFirstName(parts[0] || "");
          setLastName(parts.slice(1).join(" ") || "");
        }
      } catch (e) {
        console.error("Failed to read user doc:", e);
        const parts = (u.displayName || "").trim().split(" ").filter(Boolean);
        setFirstName(parts[0] || "");
        setLastName(parts.slice(1).join(" ") || "");
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  const handleSave = async () => {
    if (!user) return toast.error("Not signed in.");
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn) return toast.error("First name is required.");

    try {
      setSaving(true);
      const newDisplayName = `${fn} ${ln}`.trim();

      // 1) Update Firebase Auth (affects Navbar immediately)
      await updateProfile(user, { displayName: newDisplayName });

      // 2) Upsert Firestore profile
      await setDoc(
        doc(db, "users", user.uid),
        {
          firstName: fn,
          lastName: ln,
          displayName: newDisplayName,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // ensure local navbar shows new name right away
      setUser({ ...user, displayName: newDisplayName });

      toast.success("Name updated!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to update name.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Navbar gets the same user object + sign out */}
      <Navbar user={user} onSignOut={() => signOut(auth)} />

      <Toaster richColors position="top-right" closeButton />

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Header / Hero */}
        <section className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            {/* Avatar + basic info */}
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-24 md:w-28 md:h-28 shrink-0">
                {/* If photoURL exists and loads: show photo; else show generated avatar */}
                {photoURL ? (
                  <img
                    src={photoURL}
                    alt="Profile avatar"
                    className="w-24 h-24 md:w-28 md:h-28 rounded-full object-cover border border-gray-200 bg-gray-100 dark:bg-gray-800"
                    referrerPolicy="no-referrer"
                    onError={() => setPhotoURL("")} // fallback to initials if URL fails
                  />
                ) : (
                  <div
                    className="w-24 h-24 md:w-28 md:h-28 rounded-full flex items-center justify-center
                               bg-gradient-to-br from-purple-500 to-indigo-600
                               text-white border border-gray-200 shadow-sm select-none"
                    aria-label="Default avatar"
                    title="Default avatar"
                  >
                    <span className="text-2xl md:text-3xl font-semibold tracking-wide">
                      {initials}
                    </span>
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {loading ? "Loading..." : displayName}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{email}</p>
              </div>
            </div>

            
          </div>

          {/* Divider */}
          <div className="my-6 border-t border-gray-200 dark:border-gray-800" />

          {/* Edit Name Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                First name
              </label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter first name"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={loading || saving}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Last name
              </label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter last name"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={loading || saving}
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSave}
              disabled={loading || saving}
              className={`inline-flex items-center justify-center px-4 py-2 rounded-lg text-white text-sm font-medium
                ${saving ? "bg-purple-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"}
              `}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>

            <button
              onClick={() => {
                // reset fields from current user displayName
                const parts = (user?.displayName || "").trim().split(" ").filter(Boolean);
                setFirstName(parts[0] || "");
                setLastName(parts.slice(1).join(" ") || "");
                toast.message("Reverted to current name.");
              }}
              disabled={loading || saving}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Reset
            </button>
          </div>

          {/* Change Password Card */}
          <div className="mt-8">
            <ChangePassword />
          </div>
        </section>
      </main>
    </>
  );
}
