// pages/api/compare.js

export const config = { api: { bodyParser: false } };
export const runtime = 'nodejs';

import formidable from 'formidable';
import fs from 'fs/promises';
import { OpenAI } from 'openai';
import admin from 'firebase-admin';
import { checkAndConsumeQuota } from '@/lib/billing/quota'; // ✅ alias path stays

// optional: set DEBUG_AUTH=1 in .env.local to get verbose auth errors in dev
const DEBUG_AUTH = process.env.DEBUG_AUTH === '1';

// help google libs detect a project id
process.env.GCLOUD_PROJECT =
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT_ID;

process.env.GOOGLE_CLOUD_PROJECT =
  process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;

/* ---------- Firebase Admin init (idempotent) ---------- */
(function initAdmin() {
  if (admin.apps.length) return;

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT;

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey?.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin env (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY)');
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
})();

/* ---------- OpenAI ---------- */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------- helpers ---------- */
function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

/* ---------- handler ---------- */
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    // ---- auth: Firebase ID token
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!idToken) return res.status(401).json({ error: 'Unauthorized. Token missing.' });

    if (DEBUG_AUTH) console.log('[AUTH] token length:', idToken.length);

    const expected = process.env.FIREBASE_PROJECT_ID;
    const payload = decodeJwtPayload(idToken);
    if (!payload) {
      return res.status(401).json({
        error: DEBUG_AUTH ? 'Malformed token (cannot decode payload).' : 'Invalid or malformed token',
      });
    }
    const issOk = payload.iss === `https://securetoken.google.com/${expected}`;
    const audOk = payload.aud === expected;
    if (!issOk || !audOk) {
      return res.status(401).json({
        error: 'Token belongs to a different Firebase project.',
        details: DEBUG_AUTH ? { aud: payload.aud, iss: payload.iss, expected } : undefined,
      });
    }

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken, true);
    } catch (e) {
      return res.status(401).json({
        error:
          DEBUG_AUTH
            ? `verifyIdToken failed: ${e?.message || e}`
            : 'Decoding Firebase ID token failed. Ensure you send a full Firebase ID token from the same project.',
      });
    }

    // ---- quota BEFORE heavy work
    try {
      await checkAndConsumeQuota(decoded.uid); // quota accepts uid
    } catch (err) {
      const code = err?.code || '';
      const msg = err?.message || 'Access denied.';
      if (code === 'NO_PLAN')        return res.status(403).json({ error: msg, error_code: 'NO_PLAN' });
      if (code === 'LIMIT_EXCEEDED') return res.status(429).json({ error: msg, error_code: 'LIMIT_EXCEEDED' });
      return res.status(403).json({ error: msg });
    }

    // ---- parse files
    const form = formidable({ multiples: false });
    const { files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => (err ? reject(err) : resolve({ fields, files })));
    });

    const image1 = Array.isArray(files.image1) ? files.image1[0] : files.image1;
    const image2 = Array.isArray(files.image2) ? files.image2[0] : files.image2;
    if (!image1 || !image2) return res.status(400).json({ error: 'Both images are required' });

    const valid = new Set(['image/png', 'image/jpeg', 'image/webp']);
    if (!valid.has(image1.mimetype) || !valid.has(image2.mimetype)) {
      return res.status(400).json({ error: 'Only JPG, PNG, and WEBP formats are supported' });
    }

    // ---- read images as base64
    const [img1, img2] = await Promise.all([
      fs.readFile(image1.filepath, { encoding: 'base64' }),
      fs.readFile(image2.filepath, { encoding: 'base64' }),
    ]);

    // ---- OpenAI (Vision via data URIs)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'Compare these two UI screenshots and generate a markdown-based QA report.\n' +
                'Focus on layout shifts, missing or misaligned elements, spacing, font, color, and visual consistency issues.\n' +
                'Organize output with bullet points under clear headings.',
            },
            { type: 'image_url', image_url: { url: `data:${image1.mimetype};base64,${img1}` } },
            { type: 'image_url', image_url: { url: `data:${image2.mimetype};base64,${img2}` } },
          ],
        },
      ],
    });

    const result = completion?.choices?.[0]?.message?.content;
    if (!result) return res.status(502).json({ error: 'OpenAI did not return a result' });

    return res.status(200).json({ result });
  } catch (error) {
    const msg = String(error?.message || error);

    if (/Unable to detect a Project Id/i.test(msg)) {
      return res.status(500).json({
        error: `${msg}. Ensure FIREBASE_* and GCLOUD_PROJECT/GOOGLE_CLOUD_PROJECT are set/matching.`,
      });
    }

    console.error('[COMPARE] Server error:', error);
    return res.status(500).json({ error: `Comparison failed: ${msg}` });
  }
}
