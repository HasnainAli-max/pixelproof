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

import formidable from "formidable";
import fs from "fs";
import { OpenAI } from "openai";
import admin from "firebase-admin";
import { checkAndConsumeQuotaStripe } from "@/pages/api/quotaStripe";

export const config = { api: { bodyParser: false } };

/* ---------------- Firebase Admin Init ---------------- */
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
    console.log("[INIT] Firebase Admin initialized.");
  } catch (initErr) {
    console.error("[INIT] Firebase Admin init failed:", initErr);
    throw initErr;
  }
}

/* ---------------- OpenAI Init ---------------- */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  console.log("[COMPARE] Incoming request method:", req.method);

  if (req.method !== "POST") {
    console.warn("[COMPARE] Method not allowed:", req.method);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    console.warn("[COMPARE] Missing token");
    return res.status(401).json({ error: "Unauthorized. Token missing." });
  }

  // ✅ Stripe-based entitlement + daily quota
  try {
    await checkAndConsumeQuotaStripe(token);
    console.log("[COMPARE] Stripe entitlement & quota check passed");
  } catch (qErr) {
    console.warn("[COMPARE] Entitlement blocked:", qErr?.message);
    const code = qErr?.code || "";
    const status = code === "LIMIT_EXCEEDED" ? 429 : 403;
    return res
      .status(status)
      .json({ error: qErr?.message || "Access denied", error_code: code });
  }

  // --- Parse form & call OpenAI (unchanged) ---
  const form = formidable();
  const parseForm = () =>
    new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => (err ? reject(err) : resolve({ fields, files })));
    });

  try {
    console.log("[COMPARE] Parsing form...");
    const { files } = await parseForm();
    console.log("[COMPARE] Form parsed successfully");

    const image1 = Array.isArray(files.image1) ? files.image1[0] : files.image1;
    const image2 = Array.isArray(files.image2) ? files.image2[0] : files.image2;

    if (!image1 || !image2) {
      console.warn("[COMPARE] Missing one or both images");
      return res.status(400).json({ error: "Both images are required" });
    }

    const validTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!validTypes.includes(image1.mimetype) || !validTypes.includes(image2.mimetype)) {
      console.warn("[COMPARE] Invalid image formats:", image1.mimetype, image2.mimetype);
      return res.status(400).json({ error: "Only JPG, PNG, and WEBP formats are supported" });
    }

    const image1Base64 = fs.readFileSync(image1.filepath, { encoding: "base64" });
    const image2Base64 = fs.readFileSync(image2.filepath, { encoding: "base64" });

    console.log("[COMPARE] Sending images to OpenAI...");
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Compare these two UI screenshots and generate a markdown-based QA report.\n" +
                "Focus on layout shifts, missing or misaligned elements, spacing, font, color, and visual consistency issues.\n" +
                "Organize output with bullet points under clear headings.",
            },
            {
              type: "image_url",
              image_url: { url: `data:${image1.mimetype};base64,${image1Base64}` },
            },
            {
              type: "image_url",
              image_url: { url: `data:${image2.mimetype};base64,${image2Base64}` },
            },
          ],
        },
      ],
    });

    const result = completion.choices?.[0]?.message?.content;
    if (!result) {
      console.error("[COMPARE] No result from OpenAI");
      return res.status(502).json({ error: "OpenAI did not return a result" });
    }

    return res.status(200).json({ result });
  } catch (error) {
    console.error("[COMPARE] Server error:", error);
    return res.status(500).json({ error: `Comparison failed: ${error.message}` });
  }
}
