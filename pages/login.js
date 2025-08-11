import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { app } from "../firebase/config";
import Head from "next/head";

export default function Login() {
  const auth = getAuth(app);
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/utility");
      } else {
        setCheckingAuth(false);
      }
    });
    return () => unsub();
  }, []);

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      setLoading(true);
      await signInWithPopup(auth, provider);
      router.replace("/utility");
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      alert("Google Sign-In failed. " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50 text-blue-700 text-lg font-semibold">
        Checking authentication...
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Login – PixelProof</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-blue-50 px-4">
        <div className="bg-white p-8 rounded-xl shadow-md max-w-sm w-full text-center">
          <h1 className="text-2xl font-semibold text-blue-700 mb-4">PixelProof</h1>
          <p className="text-sm text-gray-600 mb-6">
            Your AI-powered Design QA Assistant
          </p>
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className={`bg-blue-600 text-white w-full py-2 rounded transition ${
              loading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-700'
            }`}
          >
            {loading ? "Signing in..." : "Sign in with Google"}
          </button>
        </div>
      </div>
    </>
  );
}

