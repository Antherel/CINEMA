'use client';

import React, {ReactNode, useEffect} from 'react';
import {useRouter, usePathname} from 'next/navigation';
import {useAuth} from '@/app/lib/AuthProvider';

/**
 * Public paths that don't require authentication
 */
const publicPaths = ['/login', '/api/firebase-config'];
const allowedEmails = new Set(['andreu@andreusierro.com', 'a.sierro@gmail.com']);

/**
 * Client-side layout wrapper that handles auth redirects
 */
export default function ClientLayout({children}: {children: ReactNode}) {
  const router = useRouter();
  const pathname = usePathname();
  const {user, loading} = useAuth();
  const isAuthorizedUser = Boolean(user?.email && allowedEmails.has(user.email.toLowerCase()));

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
      return;
    }

    // If authenticated but not authorized, force sign out view
    if (!isAuthorizedUser) {
      router.push('/login');
    }
  }, [user, loading, pathname, router, isAuthorizedUser]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="centerLoad">
        <p>Inicializando...</p>
      </div>
    );
  }

  // If not authenticated and not on a public path, don't render anything (will redirect)
  if (!user && !publicPaths.some((path) => pathname.startsWith(path))) {
    return null;
  }

  if (user && !isAuthorizedUser && !publicPaths.some((path) => pathname.startsWith(path))) {
    return null;
  }

  return <>{children}</>;
}
