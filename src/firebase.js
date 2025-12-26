// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase configuration via env with safe fallbacks for dev
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDglqw5J_SW8HixjqVLKAy_9nK3ujb5MhM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "myaiii.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "myaiii",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "myaiii.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "975491646257",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:975491646257:web:b5e9162dd5587865126610"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore and export
export const db = getFirestore(app);

// Initialize Firebase Storage and export
export const storage = getStorage(app);

// Export a flag indicating whether required Firebase env vars are present
const requiredVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

export const isFirebaseConfigured = requiredVars.every(
  (k) => import.meta.env && import.meta.env[k] && String(import.meta.env[k]).length > 0
);
