// pages/utility.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase/config';
import { toast } from 'react-hot-toast';
import ExportPDF from '../components/ExportPDF';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import ReactMarkdown from 'react-markdown';

export default function UtilityPage() {
  const [image1, setImage1] = useState(null);
  const [image2, setImage2] = useState(null);
  const [loading, setLoading] = useState(false);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [fileMeta, setFileMeta] = useState({});
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setUser(user);
      else router.replace('/login');
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace('/login');
    } catch (error) {
      toast.error('Failed to sign out.');
    }
  };

  const handleCompare = async () => {
    if (!image1 || !image2) {
      toast.error('Please upload both images before comparing.');
      return;
    }

    setLoading(true);
    setComparisonResult(null);

    try {
      const token = await auth.currentUser.getIdToken();

      const formData = new FormData();
      formData.append('image1', image1);
      formData.append('image2', image2);

      setFileMeta({
        fileName1: image1.name,
        fileName2: image2.name,
        timestamp: new Date().toLocaleString(),
      });

      const response = await fetch('/api/compare', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Server returned an error');
      if (!data.result) throw new Error('Comparison result missing in response.');

      setComparisonResult(data.result);
      toast.success('Comparison complete! 🎉');
    } catch (error) {
      console.error('Comparison failed:', error);
      toast.error(`Error during comparison: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderPreview = (file) =>
    file ? (
      <img
        src={URL.createObjectURL(file)}
        alt="Preview"
        className="rounded shadow h-40 object-contain w-full mt-2"
      />
    ) : null;

  if (!user) return null;

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-900 dark:text-white font-sans">
      <Navbar user={user} onSignOut={handleSignOut} />

      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-purple-800 dark:text-purple-300">PixelProof</h1>
          <button
            className="bg-purple-100 dark:bg-purple-700 hover:bg-purple-200 dark:hover:bg-purple-600 p-2 rounded transition"
            onClick={() => setDarkMode(!darkMode)}
            title="Toggle theme"
          >
            {darkMode ? '🌙' : '☀️'}
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
            <li>Supported: JPG, PNG, WEBP – min width 500px</li>
            <li>Ensure matching layout and scale</li>
          </ul>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Upload Design */}
          <div className="border-2 border-dashed border-purple-300 p-6 rounded-lg text-center bg-white dark:bg-gray-700 hover:border-purple-500 transition transform hover:scale-[1.01]">
            <label className="block font-semibold text-gray-800 dark:text-white mb-2">Upload Design</label>
            <input
              type="file"
              onChange={(e) => setImage1(e.target.files[0])}
              accept="image/*"
              className="w-full cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-purple-100 file:text-purple-900 hover:file:bg-purple-200"
            />
            {renderPreview(image1)}
          </div>

          {/* Upload Dev */}
          <div className="border-2 border-dashed border-purple-300 p-6 rounded-lg text-center bg-white dark:bg-gray-700 hover:border-purple-500 transition transform hover:scale-[1.01]">
            <label className="block font-semibold text-gray-800 dark:text-white mb-2">Upload Development Screenshot</label>
            <input
              type="file"
              onChange={(e) => setImage2(e.target.files[0])}
              accept="image/*"
              className="w-full cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-purple-100 file:text-purple-900 hover:file:bg-purple-200"
            />
            {renderPreview(image2)}
          </div>
        </div>

        <button
          onClick={handleCompare}
          className="mt-10 bg-purple-800 hover:bg-purple-900 text-white px-6 py-3 rounded-lg font-semibold shadow transition"
        >
          {loading ? 'Comparing...' : 'Start Comparison'}
        </button>

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

