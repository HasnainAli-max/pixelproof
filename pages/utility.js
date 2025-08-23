// pages/utility.js
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import ExportPDF from "@/components/ExportPDF";
import Navbar from "@/components/Navbar";
import LoadingSpinner from "@/components/LoadingSpinner";
import ReactMarkdown from "react-markdown";
import { Toaster, toast as notify } from "sonner";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MIN_WIDTH = 500;

export default function UtilityPage() {
  const [image1, setImage1] = useState(null);
  const [image2, setImage2] = useState(null);
  const [preview1, setPreview1] = useState(null);
  const [preview2, setPreview2] = useState(null);

  const [loading, setLoading] = useState(false);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [fileMeta, setFileMeta] = useState({});
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setAuthChecking(false);
      if (!u) router.replace("/login");
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", darkMode);
    }
  }, [darkMode]);

  useEffect(() => {
    const url1 = image1 ? URL.createObjectURL(image1) : null;
    const url2 = image2 ? URL.createObjectURL(image2) : null;
    setPreview1(url1);
    setPreview2(url2);
    return () => {
      if (url1) URL.revokeObjectURL(url1);
      if (url2) URL.revokeObjectURL(url2);
    };
  }, [image1, image2]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch {
      notify.error("Failed to sign out.");
    }
  };

  const validateFile = async (file) => {
    if (!file) return "Missing file.";
    if (!ACCEPTED_TYPES.includes(file.type)) return "Only JPG, PNG, or WEBP allowed.";

    const dims = await new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ w: img.width, h: img.height });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
    if (!dims) return "Could not read image.";
    if (dims.w < MIN_WIDTH) return `Image width must be at least ${MIN_WIDTH}px.`;
    return null;
  };

  const safeJson = async (res) => {
    const txt = await res.text();
    try {
      return JSON.parse(txt);
    } catch {
      return { error: txt || "Unknown server response" };
    }
  };

  const handleCompare = async () => {
    if (!auth.currentUser) {
      notify.error("You are signed out.");
      router.replace("/login");
      return;
    }

    const err1 = await validateFile(image1);
    const err2 = await validateFile(image2);
    if (err1 || err2) {
      notify.error(err1 || err2);
      return;
    }

    setLoading(true);
    setComparisonResult(null);

    try {
      const idToken = await auth.currentUser.getIdToken(true); // force refresh
      if (!idToken || idToken.length < 100) {
        notify.error("Sign-in problem: no ID token. Please re-login.");
        return;
      }

      const formData = new FormData();
      formData.append("image1", image1, image1.name);
      formData.append("image2", image2, image2.name);

      setFileMeta({
        fileName1: image1.name,
        fileName2: image2.name,
        timestamp: new Date().toLocaleString(),
      });

      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      });

      const data = await safeJson(res);

      if (!res.ok) {
        const code = data?.error_code || "";
        const msg = (data?.error || "Server error").toString();

        if (code === "NO_PLAN" || /no active subscription|buy a plan/i.test(msg)) {
          notify.error("Please buy a plan first.");
          router.push("/billing");
          return;
        }
        if (code === "LIMIT_EXCEEDED" || /daily limit/i.test(msg)) {
          notify.error(data?.message || msg || "Daily limit reached for your plan. Try again tomorrow.");
          return;
        }
        if (/Unable to detect a Project Id/i.test(msg)) {
          notify.error("Server auth error: Project ID not detected. Check server env & credentials.");
          return;
        }

        throw new Error(msg);
      }

      if (!data?.result) throw new Error("Comparison result missing in response.");
      setComparisonResult(data.result);
      notify.success("Comparison complete! 🎉");
    } catch (err) {
      console.error("Comparison failed:", err);
      notify.error(`Error during comparison: ${err?.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const renderPreview = (src) =>
    src ? (
      <img
        src={src}
        alt="Preview"
        className="rounded shadow h-40 object-contain w-full mt-2"
        draggable={false}
      />
    ) : null;

  if (authChecking) {
    return (
      <div className="min-h-screen grid place-items-center bg-white dark:bg-gray-900">
        <Toaster richColors position="top-center" closeButton />
        <span className="text-sm text-gray-500 dark:text-gray-300">Checking session…</span>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-900 dark:text-white font-sans">
      <Toaster richColors position="top-center" closeButton />
      <Navbar user={user} onSignOut={handleSignOut} />

      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-purple-800 dark:text-purple-300">PixelProof</h1>
          <button
            className="bg-purple-100 dark:bg-purple-700 hover:bg-purple-200 dark:hover:bg-purple-600 p-2 rounded transition"
            onClick={() => setDarkMode((v) => !v)}
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {darkMode ? "🌙" : "☀️"}
          </button>
        </div>

        <p className="text-lg font-semibold">Design QA, Automated with AI</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">
          Upload your original design and final build screenshots. Let AI catch visual bugs before your clients do.
        </p>

        <div className="border p-4 rounded bg-gray-50 dark:bg-gray-800 prose dark:prose-invert mb-10">
          <h2 className="font-semibold">How to Use</h2>
          <ul>
            <li>Upload the design and development screenshots</li>
            <li>Supported: JPG, PNG, WEBP – min width {MIN_WIDTH}px</li>
            <li>Ensure matching layout and scale</li>
          </ul>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="border-2 border-dashed border-purple-300 p-6 rounded-lg text-center bg-white dark:bg-gray-700 hover:border-purple-500 transition transform hover:scale-[1.01]">
            <label className="block font-semibold text-gray-800 dark:text-white mb-2">Upload Design</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setImage1(e.target.files?.[0] || null)}
              className="w-full cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-purple-100 file:text-purple-900 hover:file:bg-purple-200"
            />
            {renderPreview(preview1)}
          </div>

          <div className="border-2 border-dashed border-purple-300 p-6 rounded-lg text-center bg-white dark:bg-gray-700 hover:border-purple-500 transition transform hover:scale-[1.01]">
            <label className="block font-semibold text-gray-800 dark:text-white mb-2">
              Upload Development Screenshot
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setImage2(e.target.files?.[0] || null)}
              className="w-full cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-purple-100 file:text-purple-900 hover:file:bg-purple-200"
            />
            {renderPreview(preview2)}
          </div>
        </div>

        <button
          onClick={handleCompare}
          disabled={loading || !image1 || !image2}
          className="mt-10 bg-purple-800 hover:bg-purple-900 disabled:opacity-60 text-white px-6 py-3 rounded-lg font-semibold shadow transition"
        >
          {loading ? "Comparing..." : "Start Comparison"}
        </button>
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          Daily limits: <strong>Basic</strong> 1 • <strong>Pro</strong> 2 • <strong>Elite</strong> 3.
        </p>

        {loading && <LoadingSpinner />}

        {comparisonResult && (
          <div className="mt-10 bg-gray-100 dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-purple-800 dark:text-purple-300">Visual Bug Report</h2>
            <ul className="text-sm mb-4">
              <li><strong>File 1:</strong> {fileMeta.fileName1}</li>
              <li><strong>File 2:</strong> {fileMeta.fileName2}</li>
              <li><strong>Timestamp:</strong> {fileMeta.timestamp}</li>
            </ul>
            <div className="prose dark:prose-invert max-w-none text-sm">
              <ReactMarkdown>{comparisonResult}</ReactMarkdown>
            </div>
            <ExportPDF result={comparisonResult} />
          </div>
        )}
      </div>
    </div>
  );
}










// // pages/utility.js
// import { useState, useEffect, useMemo } from "react";
// import { useRouter } from "next/router";
// import { onAuthStateChanged, signOut } from "firebase/auth";
// import { auth } from "../lib/firebase/config";
// import ExportPDF from "../components/ExportPDF";
// import Navbar from "../components/Navbar";
// import LoadingSpinner from "../components/LoadingSpinner";
// import ReactMarkdown from "react-markdown";
// import { Toaster, toast as notify } from "sonner";

// const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
// const MIN_WIDTH = 500;

// export default function UtilityPage() {
//   const [image1, setImage1] = useState(null);
//   const [image2, setImage2] = useState(null);
//   const [preview1, setPreview1] = useState(null);
//   const [preview2, setPreview2] = useState(null);

//   const [loading, setLoading] = useState(false);
//   const [comparisonResult, setComparisonResult] = useState(null);
//   const [darkMode, setDarkMode] = useState(false);
//   const [fileMeta, setFileMeta] = useState({});
//   const [user, setUser] = useState(null);
//   const [authChecking, setAuthChecking] = useState(true);
//   const router = useRouter();

//   // Auth guard
//   useEffect(() => {
//     const unsub = onAuthStateChanged(auth, (u) => {
//       setUser(u || null);
//       setAuthChecking(false);
//       if (!u) router.replace("/login");
//     });
//     return () => unsub();
//   }, [router]);

//   // Theme toggle
//   useEffect(() => {
//     if (typeof document !== "undefined") {
//       document.documentElement.classList.toggle("dark", darkMode);
//     }
//   }, [darkMode]);

//   // Revoke object URLs when files change/unmount
//   useEffect(() => {
//     const url1 = image1 ? URL.createObjectURL(image1) : null;
//     const url2 = image2 ? URL.createObjectURL(image2) : null;
//     setPreview1(url1);
//     setPreview2(url2);
//     return () => {
//       if (url1) URL.revokeObjectURL(url1);
//       if (url2) URL.revokeObjectURL(url2);
//     };
//   }, [image1, image2]);

//   const handleSignOut = async () => {
//     try {
//       await signOut(auth);
//       router.replace("/login");
//     } catch {
//       notify.error("Failed to sign out.");
//     }
//   };

//   const validateFile = async (file) => {
//     if (!file) return "Missing file.";
//     if (!ACCEPTED_TYPES.includes(file.type)) return "Only JPG, PNG, or WEBP allowed.";

//     // check width >= MIN_WIDTH
//     const dims = await new Promise((resolve) => {
//       const img = new Image();
//       img.onload = () => resolve({ w: img.width, h: img.height });
//       img.onerror = () => resolve(null);
//       img.src = URL.createObjectURL(file);
//     });
//     if (!dims) return "Could not read image.";
//     if (dims.w < MIN_WIDTH) return `Image width must be at least ${MIN_WIDTH}px.`;

//     return null;
//   };

//   const safeJson = async (res) => {
//     const txt = await res.text();
//     try {
//       return JSON.parse(txt);
//     } catch {
//       return { error: txt || "Unknown server response" };
//     }
//   };

//   const handleCompare = async () => {
//     if (!auth.currentUser) {
//       notify.error("You are signed out.");
//       router.replace("/login");
//       return;
//     }

//     // basic front-end validation
//     const err1 = await validateFile(image1);
//     const err2 = await validateFile(image2);
//     if (err1 || err2) {
//       notify.error(err1 || err2);
//       return;
//     }

//     setLoading(true);
//     setComparisonResult(null);

//     try {
//       const idToken = await auth.currentUser.getIdToken();

//       const formData = new FormData();
//       formData.append("image1", image1, image1.name);
//       formData.append("image2", image2, image2.name);

//       setFileMeta({
//         fileName1: image1.name,
//         fileName2: image2.name,
//         timestamp: new Date().toLocaleString(),
//       });

//       const res = await fetch("/api/compare", {
//         method: "POST",
//         headers: { Authorization: `Bearer ${idToken}` },
//         body: formData,
//       });

//       const data = await safeJson(res);

//       if (!res.ok) {
//         const code = data?.error_code || "";
//         const msg = (data?.error || "Server error").toString();

//         if (code === "NO_PLAN" || /no active subscription|buy a plan/i.test(msg)) {
//           notify.error("Please buy a plan first.");
//           router.push("/billing");
//           return;
//         }
//         if (code === "LIMIT_EXCEEDED" || /daily limit/i.test(msg)) {
//           notify.error(data?.message || msg || "Daily limit reached for your plan. Try again tomorrow.");
//           return;
//         }
//         // surface GCP/Firebase project id auth problems clearly
//         if (/Unable to detect a Project Id/i.test(msg)) {
//           notify.error("Server auth error: Project ID not detected. Check server env & credentials.");
//           return;
//         }

//         throw new Error(msg);
//       }

//       if (!data?.result) throw new Error("Comparison result missing in response.");
//       setComparisonResult(data.result);
//       notify.success("Comparison complete! 🎉");
//     } catch (err) {
//       console.error("Comparison failed:", err);
//       notify.error(`Error during comparison: ${err?.message || "Unknown error"}`);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const renderPreview = (src) =>
//     src ? (
//       <img
//         src={src}
//         alt="Preview"
//         className="rounded shadow h-40 object-contain w-full mt-2"
//         draggable={false}
//       />
//     ) : null;

//   if (authChecking) {
//     return (
//       <div className="min-h-screen grid place-items-center bg-white dark:bg-gray-900">
//         <Toaster richColors position="top-center" closeButton />
//         <span className="text-sm text-gray-500 dark:text-gray-300">Checking session…</span>
//       </div>
//     );
//   }

//   if (!user) return null;

//   return (
//     <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-900 dark:text-white font-sans">
//       <Toaster richColors position="top-center" closeButton />
//       <Navbar user={user} onSignOut={handleSignOut} />

//       <div className="p-6 max-w-4xl mx-auto">
//         <div className="flex justify-between items-center mb-8">
//           <h1 className="text-3xl font-bold text-purple-800 dark:text-purple-300">PixelProof</h1>
//           <button
//             className="bg-purple-100 dark:bg-purple-700 hover:bg-purple-200 dark:hover:bg-purple-600 p-2 rounded transition"
//             onClick={() => setDarkMode((v) => !v)}
//             title="Toggle theme"
//             aria-label="Toggle theme"
//           >
//             {darkMode ? "🌙" : "☀️"}
//           </button>
//         </div>

//         <p className="text-lg font-semibold">Design QA, Automated with AI</p>
//         <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">
//           Upload your original design and final build screenshots. Let AI catch visual bugs before your clients do.
//         </p>

//         <div className="border p-4 rounded bg-gray-50 dark:bg-gray-800 prose dark:prose-invert mb-10">
//           <h2 className="font-semibold">How to Use</h2>
//           <ul>
//             <li>Upload the design and development screenshots</li>
//             <li>Supported: JPG, PNG, WEBP – min width {MIN_WIDTH}px</li>
//             <li>Ensure matching layout and scale</li>
//           </ul>
//         </div>

//         <div className="grid md:grid-cols-2 gap-6">
//           <div className="border-2 border-dashed border-purple-300 p-6 rounded-lg text-center bg-white dark:bg-gray-700 hover:border-purple-500 transition transform hover:scale-[1.01]">
//             <label className="block font-semibold text-gray-800 dark:text-white mb-2">Upload Design</label>
//             <input
//               type="file"
//               accept="image/jpeg,image/png,image/webp"
//               onChange={(e) => setImage1(e.target.files?.[0] || null)}
//               className="w-full cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-purple-100 file:text-purple-900 hover:file:bg-purple-200"
//             />
//             {renderPreview(preview1)}
//           </div>

//           <div className="border-2 border-dashed border-purple-300 p-6 rounded-lg text-center bg-white dark:bg-gray-700 hover:border-purple-500 transition transform hover:scale-[1.01]">
//             <label className="block font-semibold text-gray-800 dark:text-white mb-2">
//               Upload Development Screenshot
//             </label>
//             <input
//               type="file"
//               accept="image/jpeg,image/png,image/webp"
//               onChange={(e) => setImage2(e.target.files?.[0] || null)}
//               className="w-full cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-purple-100 file:text-purple-900 hover:file:bg-purple-200"
//             />
//             {renderPreview(preview2)}
//           </div>
//         </div>

//         <button
//           onClick={handleCompare}
//           disabled={loading || !image1 || !image2}
//           className="mt-10 bg-purple-800 hover:bg-purple-900 disabled:opacity-60 text-white px-6 py-3 rounded-lg font-semibold shadow transition"
//         >
//           {loading ? "Comparing..." : "Start Comparison"}
//         </button>
//         <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
//           Daily limits: <strong>Basic</strong> 1 • <strong>Pro</strong> 2 • <strong>Elite</strong> 3.
//         </p>

//         {loading && <LoadingSpinner />}

//         {comparisonResult && (
//           <div className="mt-10 bg-gray-100 dark:bg-gray-800 p-6 rounded-lg shadow-lg">
//             <h2 className="text-xl font-bold mb-4 text-purple-800 dark:text-purple-300">Visual Bug Report</h2>
//             <ul className="text-sm mb-4">
//               <li><strong>File 1:</strong> {fileMeta.fileName1}</li>
//               <li><strong>File 2:</strong> {fileMeta.fileName2}</li>
//               <li><strong>Timestamp:</strong> {fileMeta.timestamp}</li>
//             </ul>
//             <div className="prose dark:prose-invert max-w-none text-sm">
//               <ReactMarkdown>{comparisonResult}</ReactMarkdown>
//             </div>
//             <ExportPDF result={comparisonResult} />
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
