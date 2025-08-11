// components/Navbar.js
import React from 'react';

export default function Navbar({ user, onSignOut }) {
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
              <button
                onClick={onSignOut}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded font-medium transition"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

