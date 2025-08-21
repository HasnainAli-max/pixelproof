// // pages/api/compare.js

// import formidable from 'formidable';
// import fs from 'fs';
// import { OpenAI } from 'openai';
// import admin from 'firebase-admin';

// export const config = {
//   api: {
//     bodyParser: false,
//   },
// };

// // --- Firebase Admin Init ---
// if (!admin.apps.length) {
//   try {
//     admin.initializeApp({
//       credential: admin.credential.cert({
//         projectId: process.env.FIREBASE_PROJECT_ID,
//         clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
//         privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
//       }),
//     });
//     console.log('[INIT] Firebase Admin initialized.');
//   } catch (initErr) {
//     console.error('[INIT] Firebase Admin init failed:', initErr);
//     throw initErr;
//   }
// }

// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// export default async function handler(req, res) {
//   console.log('[COMPARE] Incoming request method:', req.method);

//   if (req.method !== 'POST') {
//     console.warn('[COMPARE] Method not allowed:', req.method);
//     return res.status(405).json({ error: 'Method Not Allowed' });
//   }

//   const authHeader = req.headers.authorization;
//   console.log('[COMPARE] Auth Header:', authHeader);

//   const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
//   if (!token) {
//     console.warn('[COMPARE] Missing token');
//     return res.status(401).json({ error: 'Unauthorized. Token missing.' });
//   }

//   try {
//     await admin.auth().verifyIdToken(token);
//     console.log('[COMPARE] Firebase auth verified');
//   } catch (err) {
//     console.error('[COMPARE] Auth verification failed:', err);
//     return res.status(403).json({ error: 'Invalid or expired token' });
//   }

//   const form = formidable();

//   const parseForm = () =>
//     new Promise((resolve, reject) => {
//       form.parse(req, (err, fields, files) => {
//         if (err) reject(err);
//         else resolve({ fields, files });
//       });
//     });

//   try {
//     console.log('[COMPARE] Parsing form...');
//     const { files } = await parseForm();
//     console.log('[COMPARE] Form parsed successfully');
//     console.log('[COMPARE] Raw files:', files);

//     const image1 = Array.isArray(files.image1) ? files.image1[0] : files.image1;
//     const image2 = Array.isArray(files.image2) ? files.image2[0] : files.image2;

//     console.log('[COMPARE] Uploaded files:', {
//       image1: image1?.originalFilename,
//       image2: image2?.originalFilename,
//     });

//     if (!image1 || !image2) {
//       console.warn('[COMPARE] Missing one or both images');
//       return res.status(400).json({ error: 'Both images are required' });
//     }

//     const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
//     if (!validTypes.includes(image1.mimetype) || !validTypes.includes(image2.mimetype)) {
//       console.warn('[COMPARE] Invalid image formats:', image1.mimetype, image2.mimetype);
//       return res.status(400).json({ error: 'Only JPG, PNG, and WEBP formats are supported' });
//     }

//     const image1Base64 = fs.readFileSync(image1.filepath, { encoding: 'base64' });
//     const image2Base64 = fs.readFileSync(image2.filepath, { encoding: 'base64' });

//     console.log('[COMPARE] Sending images to OpenAI...');
//     const completion = await openai.chat.completions.create({
//       model: 'gpt-4o',
//       messages: [
//         {
//           role: 'user',
//           content: [
//             {
//               type: 'text',
//               text: `Compare these two UI screenshots and generate a markdown-based QA report.
// Focus on layout shifts, missing or misaligned elements, spacing, font, color, and visual consistency issues.
// Organize output with bullet points under clear headings.`,
//             },
//             {
//               type: 'image_url',
//               image_url: { url: `data:${image1.mimetype};base64,${image1Base64}` },
//             },
//             {
//               type: 'image_url',
//               image_url: { url: `data:${image2.mimetype};base64,${image2Base64}` },
//             },
//           ],
//         },
//       ],
//     });

//     const result = completion.choices?.[0]?.message?.content;
//     console.log('[COMPARE] OpenAI result received');

//     if (!result) {
//       console.error('[COMPARE] No result from OpenAI');
//       return res.status(502).json({ error: 'OpenAI did not return a result' });
//     }

//     return res.status(200).json({ result });
//   } catch (error) {
//     console.error('[COMPARE] Server error:', error);
//     return res.status(500).json({ error: `Comparison failed: ${error.message}` });
//   }
// }














// pages/api/compare.js
// pages/api/compare.js

import formidable from 'formidable';
import fs from 'fs';
import { OpenAI } from 'openai';
import admin from 'firebase-admin';

export const config = {
  api: { bodyParser: false },
};

/* ---------------- Firebase Admin Init ---------------- */
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log('[INIT] Firebase Admin initialized.');
  } catch (initErr) {
    console.error('[INIT] Firebase Admin init failed:', initErr);
    throw initErr;
  }
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

/* ---------------- OpenAI Init ---------------- */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------------- Quota config ---------------- */
const DAILY_LIMITS = { basic: 1, pro: 2, elite: 3 };

function limitForPlan(plan) {
  return DAILY_LIMITS[String(plan || '').toLowerCase()] ?? 0;
}

function todayKey() {
  // UTC date key (YYYY-MM-DD) so the limit resets daily
  return new Date().toISOString().slice(0, 10);
}

/* Try very hard to figure out plan from user doc */
function resolvePlanFromUserDoc(user = {}) {
  // 1) Direct string fields people commonly use
  const stringCandidates = [
    user.activePlan,
    user.plan,
    user.tier,
    user.currentPlan,
    user.subscriptionPlan,
  ].filter(Boolean);

  for (const v of stringCandidates) {
    const s = String(v).toLowerCase();
    if (s.includes('elite')) return 'elite';
    if (s.includes('pro')) return 'pro';
    if (s.includes('basic')) return 'basic';
  }

  // 2) Lookup key / nickname / product names
  const lookupish = [
    user.priceLookupKey,
    user.lookup_key,
    user.stripePrice?.lookup_key,
    user.stripePrice?.nickname,
    user.productName,
  ].filter(Boolean);

  for (const v of lookupish) {
    const s = String(v).toLowerCase();
    if (s.includes('elite')) return 'elite';
    if (s.includes('pro')) return 'pro';
    if (s.includes('basic')) return 'basic';
  }

  // 3) Amount (in cents) fallback — adjust if you use different pricing
  const cents = Number(user.amount);
  if (Number.isFinite(cents)) {
    if (cents >= 9999) return 'elite'; // 99.99
    if (cents >= 4999) return 'pro';   // 49.99
    if (cents >= 999)  return 'basic'; // 9.99
  }

  return null; // unknown
}

/**
 * Validates user's plan and consumes 1 daily quota.
 * Throws an Error if no plan or limit reached.
 */
async function checkAndConsumeQuota(uid) {
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const user = userSnap.exists ? userSnap.data() : {};

  const plan = resolvePlanFromUserDoc(user) || 'basic'; // last-resort default
  const max = limitForPlan(plan);

  if (max <= 0) {
    const msg = 'No active plan. Please choose a plan to use comparisons.';
    const err = new Error(msg);
    err.code = 'NO_PLAN';
    throw err;
  }

  const quotaRef = userRef.collection('quota').doc('daily');
  const day = todayKey();

  await db.runTransaction(async (t) => {
    const snap = await t.get(quotaRef);
    const sameDay = snap.exists && snap.get('day') === day;
    const used = sameDay ? Number(snap.get('count') || 0) : 0;

    // Log for visibility when debugging upgrades/downgrades
    console.log('[QUOTA]', { plan, max, day, usedBefore: used });

    if (used >= max) {
      const msg = `Daily limit reached for your ${plan} plan (${max}/day).`;
      const err = new Error(msg);
      err.code = 'LIMIT_EXCEEDED';
      throw err;
    }

    t.set(
      quotaRef,
      {
        day,
        count: used + 1,
        max, // informational
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  return { plan, max };
}

/* ---------------- Handler ---------------- */

export default async function handler(req, res) {
  console.log('[COMPARE] Incoming request method:', req.method);

  if (req.method !== 'POST') {
    console.warn('[COMPARE] Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) {
    console.warn('[COMPARE] Missing token');
    return res.status(401).json({ error: 'Unauthorized. Token missing.' });
  }

  // Verify Firebase auth, then enforce quota
  let uid;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    uid = decoded.uid;
    console.log('[COMPARE] Firebase auth ok uid=', uid);
  } catch (err) {
    console.error('[COMPARE] Auth verification failed:', err);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  try {
    // ✅ Enforce per-day quota BEFORE heavy work
    await checkAndConsumeQuota(uid);
    console.log('[COMPARE] Quota check passed');
  } catch (qErr) {
    console.warn('[COMPARE] Quota blocked:', qErr?.message);
    // Use a specific status + code so frontend can show an alert easily
    const code = qErr?.code === 'LIMIT_EXCEEDED' ? 429 : 403;
    return res.status(code).json({
      error: qErr?.message || 'Quota exceeded',
      error_code: qErr?.code || 'QUOTA_ERROR',
    });
  }

  // Continue with your existing form parsing + OpenAI flow
  const form = formidable();

  const parseForm = () =>
    new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

  try {
    console.log('[COMPARE] Parsing form...');
    const { files } = await parseForm();
    console.log('[COMPARE] Form parsed');

    const image1 = Array.isArray(files.image1) ? files.image1[0] : files.image1;
    const image2 = Array.isArray(files.image2) ? files.image2[0] : files.image2;

    if (!image1 || !image2) {
      return res.status(400).json({ error: 'Both images are required' });
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(image1.mimetype) || !validTypes.includes(image2.mimetype)) {
      return res.status(400).json({ error: 'Only JPG, PNG, and WEBP formats are supported' });
    }

    const image1Base64 = fs.readFileSync(image1.filepath, { encoding: 'base64' });
    const image2Base64 = fs.readFileSync(image2.filepath, { encoding: 'base64' });

    console.log('[COMPARE] Sending images to OpenAI...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Compare these two UI screenshots and generate a markdown-based QA report.
Focus on layout shifts, missing or misaligned elements, spacing, font, color, and visual consistency issues.
Organize output with bullet points under clear headings.`,
            },
            { type: 'image_url', image_url: { url: `data:${image1.mimetype};base64,${image1Base64}` } },
            { type: 'image_url', image_url: { url: `data:${image2.mimetype};base64,${image2Base64}` } },
          ],
        },
      ],
    });

    const result = completion.choices?.[0]?.message?.content;
    if (!result) {
      return res.status(502).json({ error: 'OpenAI did not return a result' });
    }

    return res.status(200).json({ result });
  } catch (error) {
    console.error('[COMPARE] Server error:', error);
    return res.status(500).json({ error: `Comparison failed: ${error.message}` });
  }
}
