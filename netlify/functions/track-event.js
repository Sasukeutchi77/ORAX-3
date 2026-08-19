import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, runTransaction } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || '',
};

function getDb() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return getFirestore(app);
}

// In-memory sliding window rate limiter
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 10000; // 10 seconds
const MAX_REQUESTS_PER_WINDOW = 15; // Max 15 requests per 10s per client

function isRateLimited(clientKey) {
  const now = Date.now();
  const clientRecord = rateLimitMap.get(clientKey);

  if (!clientRecord) {
    rateLimitMap.set(clientKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (now > clientRecord.resetAt) {
    rateLimitMap.set(clientKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  clientRecord.count += 1;
  if (clientRecord.count > MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  return false;
}

// Clean up stale rate limit entries periodically (every 5 minutes)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 300000);
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

/**
 * Verifies a Firebase ID token server-side via Google Identity Toolkit REST API
 * Returns the cryptographically verified UID if valid, or null.
 */
async function verifyFirebaseIdToken(idToken, apiKey) {
  if (!idToken || typeof idToken !== 'string' || !apiKey) {
    return null;
  }

  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (data.users && Array.isArray(data.users) && data.users.length > 0 && data.users[0].localId) {
      return data.users[0].localId;
    }
  } catch (err) {
    console.warn('Firebase token verification error in Netlify function:', err);
  }

  return null;
}

export const handler = async (event) => {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed. Use POST.' }),
    };
  }

  // Extract client IP / fingerprint for rate limiting ONLY (never stored in DB)
  const clientIp = (
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['client-ip'] ||
    event.headers['x-forwarded-for'] ||
    '127.0.0.1'
  ).split(',')[0].trim();

  try {
    const payload = JSON.parse(event.body || '{}');
    const { projectId, type, visitorId } = payload;

    // Extract auth token from Authorization header or body payload
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
    const idToken = bearerToken || payload.authToken || '';

    // 1. Basic validation
    if (!projectId || typeof projectId !== 'string') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing or invalid projectId.' }),
      };
    }

    if (type !== 'view' && type !== 'download') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid event type. Must be "view" or "download".' }),
      };
    }

    // 2. Apply rate limiting per IP / visitor to prevent abuse
    const rateLimitKey = `${clientIp}_${visitorId || 'guest'}`;
    if (isRateLimited(rateLimitKey)) {
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({ error: 'Trop de requêtes. Veuillez patienter.' }),
      };
    }

    // 3. Cryptographic Verification for Authenticated Users
    let trackerDocId = '';
    let isVerifiedUser = false;

    if (idToken) {
      const verifiedUid = await verifyFirebaseIdToken(idToken, firebaseConfig.apiKey);
      if (verifiedUid) {
        // Never trust client-supplied UID: use strictly verified UID from Google
        trackerDocId = `usr_${verifiedUid.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        isVerifiedUser = true;
      }
    }

    // 4. Anonymous Guest Tracking (if not authenticated)
    if (!isVerifiedUser) {
      if (!visitorId || typeof visitorId !== 'string') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing or invalid visitorId.' }),
        };
      }
      const sanitizedVisitorId = visitorId.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 80);
      trackerDocId = sanitizedVisitorId.startsWith('visitor_') || sanitizedVisitorId.startsWith('guest_')
        ? sanitizedVisitorId
        : `gst_${sanitizedVisitorId}`;
    }

    // 5. Firestore Atomic Transaction
    const db = getDb();
    const projectRef = doc(db, 'projects', projectId);
    const subcollectionName = type === 'view' ? 'views' : 'downloads';
    const trackerRef = doc(db, 'projects', projectId, subcollectionName, trackerDocId);

    const result = await runTransaction(db, async (transaction) => {
      const [projectDoc, trackerDoc] = await Promise.all([
        transaction.get(projectRef),
        transaction.get(trackerRef),
      ]);

      if (!projectDoc.exists()) {
        throw new Error('PROJECT_NOT_FOUND');
      }

      const projectData = projectDoc.data();

      // Check published status
      if (projectData.status && projectData.status !== 'published') {
        throw new Error('PROJECT_NOT_PUBLISHED');
      }

      const countField = type === 'view' ? 'views' : 'downloads';
      const currentCount = projectData[countField] || (type === 'view' ? 1 : 0);

      // Anti-fraud: Project author cannot increment views/downloads on their own project
      if (isVerifiedUser && trackerDocId === `usr_${(projectData.ownerId || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`) {
        return {
          isNew: false,
          count: currentCount,
          projectId,
          type,
          authorIgnored: true,
        };
      }

      // If this visitor/user already logged an entry in the subcollection, do not increment again
      if (trackerDoc.exists()) {
        return {
          isNew: false,
          count: currentCount,
          projectId,
          type,
        };
      }

      // First time recording for this user/visitor:
      // Privacy protection: NO RAW IP OR PII IS STORED in Firestore!
      const now = new Date().toISOString();
      transaction.set(trackerRef, {
        trackerId: trackerDocId,
        createdAt: now,
        type,
        isVerifiedUser,
      });

      const newCount = currentCount + 1;
      transaction.update(projectRef, {
        [countField]: newCount,
        updatedAt: now,
      });

      return {
        isNew: true,
        count: newCount,
        projectId,
        type,
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (error) {
    if (error.message === 'PROJECT_NOT_FOUND') {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Projet introuvable.' }),
      };
    }
    if (error.message === 'PROJECT_NOT_PUBLISHED') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Le projet n\'est pas accessible publiquement.' }),
      };
    }

    console.warn('Track event error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' }),
    };
  }
};

