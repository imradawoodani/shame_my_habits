import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'placeholder',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'placeholder',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'placeholder',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'placeholder',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || 'placeholder',
};

// sanity-check the configuration so we fail fast when env vars are missing
if (
  firebaseConfig.apiKey.includes('placeholder') ||
  firebaseConfig.authDomain.includes('placeholder') ||
  firebaseConfig.projectId.includes('placeholder')
) {
  console.warn(
    'Firebase config appears to be unset. Make sure NEXT_PUBLIC_FIREBASE_* vars are defined',
    firebaseConfig
  );
}


// log config for debugging (will appear in browser console)
console.log('firebaseConfig:', firebaseConfig);

// throw an error to prevent the app from booting with invalid config
if (
  !firebaseConfig.apiKey ||
  firebaseConfig.apiKey.includes('placeholder') ||
  !firebaseConfig.authDomain ||
  firebaseConfig.authDomain.includes('placeholder') ||
  !firebaseConfig.projectId ||
  firebaseConfig.projectId.includes('placeholder')
) {
  throw new Error(
    'Firebase configuration is missing or invalid. Check your environment variables.'
  );
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = typeof window !== 'undefined' ? getAuth(app) : null;
export const db = typeof window !== 'undefined' ? getFirestore(app) : null;
