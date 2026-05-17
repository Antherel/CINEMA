import type {DecodedIdToken} from 'firebase-admin/auth';
import * as admin from 'firebase-admin';

let adminApp: admin.app.App | null = null;

/**
 * Initialize Firebase Admin SDK (server-side)
 */
export function initializeFirebaseAdmin(): admin.app.App {
  if (adminApp) return adminApp;

  const firebaseConfig = process.env.FIREBASE_CONFIG;
  if (!firebaseConfig) {
    throw new Error('FIREBASE_CONFIG environment variable not set');
  }

  try {
    const config = JSON.parse(firebaseConfig);
    adminApp = admin.initializeApp({
      projectId: config.project_id,
      storageBucket: config.storage_bucket,
    });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    throw error;
  }

  return adminApp;
}

/**
 * Get the Firebase Admin Auth instance
 */
export function getFirebaseAuth(): admin.auth.Auth {
  const app = initializeFirebaseAdmin();
  return admin.auth(app);
}

/**
 * Verify a Firebase ID token and extract user info
 */
export async function verifyIdToken(token: string): Promise<DecodedIdToken> {
  const auth = getFirebaseAuth();
  return auth.verifyIdToken(token);
}

/**
 * Check if user email is in the allowed list
 */
export function checkEmailWhitelist(email: string | undefined): boolean {
  if (!email) return false;

  const allowedEmailsEnv = process.env.ALLOWED_EMAILS || '';
  if (!allowedEmailsEnv.trim()) {
    // If no whitelist is set, allow all authenticated users (for development)
    console.warn('ALLOWED_EMAILS not configured. Allowing all authenticated users.');
    return true;
  }

  const allowedEmails = allowedEmailsEnv
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return allowedEmails.includes(email.toLowerCase());
}

/**
 * Get Firebase web SDK configuration (for client-side initialization)
 */
export function getFirebaseWebConfig(): Record<string, string> {
  const firebaseConfig = process.env.FIREBASE_CONFIG;
  if (!firebaseConfig) {
    throw new Error('FIREBASE_CONFIG environment variable not set');
  }

  try {
    const config = JSON.parse(firebaseConfig);
    // Map Firebase Admin config keys to web SDK keys
    return {
      apiKey: config.api_key || process.env.FIREBASE_API_KEY || '',
      authDomain: config.auth_domain || '',
      projectId: config.project_id || '',
      storageBucket: config.storage_bucket || '',
      messagingSenderId: config.messaging_sender_id || '',
      appId: config.app_id || '',
    };
  } catch (error) {
    console.error('Failed to parse Firebase config:', error);
    throw error;
  }
}
