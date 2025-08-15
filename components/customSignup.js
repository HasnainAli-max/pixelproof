"use client";

import { useEffect, useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "@/lib/firebase/config"; // ⬅️ removed `storage`
import Link from "next/link";
import { Toaster, toast } from "sonner";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"; // ⬅️ removed firebase/storage imports

const MAX_IMAGE_MB = 5; // (kept for future use if you ever re-enable)

const CustomSignUp = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [loading,   setLoading]   = useState(false);

  // STATIC image input (no upload, no preview)
  const [selectedImageName, setSelectedImageName] = useState("");

  const validate = () => {
    if (!firstName.trim()) return "First name is required.";
    if (!lastName.trim())  return "Last name is required.";
    if (!email.trim())     return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    // ⬇️ no file validations because we're not using the image
    return null;
  };

  const fbError = (e) => {
    const code = e?.code || "";
    switch (code) {
      case "auth/email-already-in-use":  return "That email is already registered.";
      case "auth/invalid-email":         return "Enter a valid email.";
      case "auth/weak-password":         return "Password should be at least 6 characters.";
      case "auth/network-request-failed":return "Network error. Check your connection.";
      case "permission-denied":          return "Permission denied by Firestore rules.";
      default:                           return e?.message || "Sign up failed";
    }
  };

  // Firestore upsert (no photo fields now)
  const upsertUserDoc = async (user, { firstName, lastName }) => {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    const base = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || `${firstName} ${lastName}`.trim(),
      firstName,
      lastName,
      // photoURL: null, avatarPath: null, // omitted since not uploading
      provider: user.providerData?.[0]?.providerId || "password",
      role: "user",
      updatedAt: serverTimestamp(),
    };
    if (!snap.exists()) base.createdAt = serverTimestamp();

    await setDoc(userRef, base, { merge: true });
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) { setSelectedImageName(""); return; }
    // no upload; just store name locally
    setSelectedImageName(file.name);
  };

  const handleSignUp = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }

    try {
      setLoading(true);

      await toast.promise(
        (async () => {
          // 1) Create Auth user
          const { user } = await createUserWithEmailAndPassword(auth, email, password);

          // 2) (Optional) set display name (no photoURL here)
          const displayName = `${firstName} ${lastName}`.trim();
          await updateProfile(user, { displayName });

          // 3) Save/merge Firestore user doc
          await upsertUserDoc(user, { firstName, lastName });

          // 4) Optional: store token
          const token = await user.getIdToken();
          if (typeof window !== "undefined") localStorage.setItem("token", token);

          return "ok";
        })(),
        {
          loading: "Creating your account...",
          success: "Account created! Welcome 👋",
          error: (e) => fbError(e),
        }
      );
    } catch (e) {
      console.error("error===>", e);
      toast.error(fbError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Toaster richColors position="top-right" closeButton />

      <div className="flex w-full flex-col items-center justify-center bg-white pt-5 rounded-2xl max-w-sm w-full text-center gap-4">
        {/* Static file input (no preview, no upload) */}
        <div className="w-full text-left">
          <label htmlFor="avatar-input" className="block text-sm font-medium text-gray-700 mb-1">
            Profile Image (static — not uploaded)
          </label>
          <input
            id="avatar-input"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-900 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
          />
          {selectedImageName && (
            <p className="mt-1 text-xs text-gray-500">Selected: {selectedImageName}</p>
          )}
        </div>

        <input
          placeholder="First Name"
          className="w-full border border-gray-300 rounded-md px-4 py-2 bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          value={firstName}
          onChange={(e)=>setFirstName(e.target.value)}
        />
        <input
          placeholder="Last Name"
          className="w-full border border-gray-300 rounded-md px-4 py-2 bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          value={lastName}
          onChange={(e)=>setLastName(e.target.value)}
        />
        <input
          placeholder="Email"
          className="w-full border border-gray-300 rounded-md px-4 py-2 bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full border border-gray-300 rounded-md px-4 py-2 bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
        />

        <button
          className={`bg-blue-600 text-white w-full py-2 rounded transition ${loading ? "opacity-60 cursor-not-allowed" : "hover:bg-blue-700"}`}
          onClick={handleSignUp}
          disabled={loading}
        >
          {loading ? "Signing up..." : "Sign Up"}
        </button>

        <div className="w-full">
          <p className="flex text-sm items-center justify-center">
            Already have an account?
            <Link className="text-blue-600 hover:text-blue-700 hover:underline cursor-pointer ml-1" href="/login">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </>
  );
};

export default CustomSignUp;
