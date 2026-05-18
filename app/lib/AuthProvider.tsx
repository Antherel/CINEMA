'use client';

import React, {createContext, useContext, useEffect, useState, ReactNode} from 'react';
import {initializeApp} from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';

/**
 * Firebase web configuration - will be injected at runtime
 */
let firebaseConfig: Record<string, string> = {};

async function getConfig(): Promise<Record<string, string>> {
  if (Object.keys(firebaseConfig).length > 0) return firebaseConfig;

  const endpoints = ['/api/firebase-config', '/api/auth/config'];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        continue;
      }
      firebaseConfig = await response.json();
      return firebaseConfig;
    } catch {
      // Try the next endpoint.
    }
  }

  const error = new Error('Failed to fetch Firebase config');
  console.error('Error fetching Firebase config:', error);
  throw error;
}

// Initialize Firebase (will be called lazily)
let firebaseApp: any = null;
let auth: any = null;
const ALLOWED_EMAILS = new Set(['andreu@andreusierro.com', 'a.sierro@gmail.com']);

function isAllowedEmail(email: string | undefined): boolean {
  if (!email) return false;
  return ALLOWED_EMAILS.has(email.toLowerCase());
}

async function initializeFirebase() {
  if (firebaseApp) return {firebaseApp, auth};

  const config = await getConfig();
  firebaseApp = initializeApp(config);
  auth = getAuth(firebaseApp);
  return {firebaseApp, auth};
}

/**
 * Auth Context type
 */
interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string>;
}

/**
 * Auth Context
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Auth Provider component
 */
export function AuthProvider({children}: {children: ReactNode}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize Firebase and set up auth listener on mount
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setup = async () => {
      try {
        const {auth: firebaseAuth} = await initializeFirebase();

        // Listen to auth state changes
        unsubscribe = onAuthStateChanged(firebaseAuth, (currentUser) => {
          setUser(currentUser);
          setLoading(false);
        });
      } catch (err) {
        console.error('Failed to initialize auth:', err);
        setError(err instanceof Error ? err.message : 'Auth initialization failed');
        setLoading(false);
      }
    };

    setup();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  /**
   * Sign in with Google
   */
  const login = async () => {
    try {
      setError(null);
      const {auth: firebaseAuth} = await initializeFirebase();
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(firebaseAuth, provider);
      if (!isAllowedEmail(credential.user.email ?? undefined)) {
        await signOut(firebaseAuth);
        const unauthorizedError = new Error('Esta cuenta no esta autorizada para acceder.');
        setError(unauthorizedError.message);
        throw unauthorizedError;
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to sign in';
      setError(errorMessage);
      throw err;
    }
  };

  /**
   * Sign out
   */
  const logout = async () => {
    try {
      setError(null);
      const {auth: firebaseAuth} = await initializeFirebase();
      await signOut(firebaseAuth);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to sign out';
      setError(errorMessage);
      throw err;
    }
  };

  /**
   * Get ID token for API requests
   */
  const getIdToken = async (): Promise<string> => {
    if (!user) {
      throw new Error('No authenticated user');
    }
    return user.getIdToken();
  };

  return (
    <AuthContext.Provider value={{user, loading, error, login, logout, getIdToken}}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to use auth context
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
