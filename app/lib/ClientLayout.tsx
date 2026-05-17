'use client';

import React, {ReactNode, useEffect} from 'react';
import {useRouter, usePathname} from 'next/navigation';
import {useAuth} from '@/app/lib/AuthProvider';

/**
 * Public paths that don't require authentication
 */
const publicPaths = ['/login', '/api/firebase-config'];

/**
 * Client-side layout wrapper that handles auth redirects
 */
export default function ClientLayout({children}: {children: ReactNode}) {
  const router = useRouter();
  const pathname = usePathname();
  const {user, loading} = useAuth();

  useEffect(() => {
    // Skip redirect check for public paths
    if (publicPaths.some((path) => pathname.startsWith(path))) {
      return;
    }

    // If loading, wait for auth state to be determined
    if (loading) {
      return;
    }

    // If not authenticated, redirect to login
    if (!user) {
      router.push('/login');
    }
  }, [user, loading, pathname, router]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <div style={{padding: '2rem', textAlign: 'center'}}>
        <p>Inicializando...</p>
      </div>
    );
  }

  // If not authenticated and not on a public path, don't render anything (will redirect)
  if (!user && !publicPaths.some((path) => pathname.startsWith(path))) {
    return null;
  }

  return <>{children}</>;
}
