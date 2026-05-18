'use client';

import React, {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {useAuth} from '@/app/lib/AuthProvider';

const allowedEmails = new Set(['andreu@andreusierro.com', 'a.sierro@gmail.com']);

export default function LoginPage() {
  const router = useRouter();
  const {user, loading, error, login, logout} = useAuth();
  const isAuthorizedUser = Boolean(user?.email && allowedEmails.has(user.email.toLowerCase()));

  // If already logged in, redirect to main app
  useEffect(() => {
    if (!loading && user && isAuthorizedUser) {
      router.push('/');
    }
  }, [user, loading, router, isAuthorizedUser]);

  useEffect(() => {
    if (!loading && user && !isAuthorizedUser) {
      logout().catch(() => {
        // Ignore logout errors here; API will still block unauthorized users.
      });
    }
  }, [user, loading, isAuthorizedUser, logout]);

  const handleLogin = async () => {
    try {
      await login();
      // Redirect happens via useEffect when user state updates
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="centerLoad">
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="loginShell">
      <div className="loginCard">
        <h1 className="loginTitle">
          VideoClip Studio
        </h1>
        <p className="loginSubtitle">
          Generador de imágenes con IA
        </p>

        {error && (
          <div className="loginError">
            <strong>Error:</strong> {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          className="loginButton"
        >
          Iniciar sesión con Google
        </button>

        <p className="loginFootnote">
          Acceso restringido a andreu@andreusierro.com y a.sierro@gmail.com
        </p>
      </div>
    </div>
  );
}
