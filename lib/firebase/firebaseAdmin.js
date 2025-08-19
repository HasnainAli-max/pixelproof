// lib/firebase/firebaseAdmin.js
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  // strip accidental surrounding quotes and restore line breaks
  privateKey: process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/^"|"$/g, '').replace(/\\n/g, '\n')
    : undefined,
};

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const app = getApp();

// Auth admin is fine
export const authAdmin = getAuth(app);

// 🔧 Explicit database id fixes "settings.databaseId" crash
const DATABASE_ID = process.env.FIRESTORE_DB_ID || '(default)';
export const db = getFirestore(app, DATABASE_ID);

// 🚫 Avoid gRPC/protobuf crashes in Next dev by preferring REST transport
// Safe to leave on in dev; comment out in production if you want.
try {
  // available in @google-cloud/firestore v7+
  db.settings({ preferRest: true });
} catch (_) { /* older SDKs quietly ignore this */ }

export { FieldValue, Timestamp };
