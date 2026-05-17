'use client';

import React, {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {useAuth} from '@/app/lib/AuthProvider';

export default function LoginPage() {
  const router = useRouter();
  const {user, loading, error, login} = useAuth();

  // If already logged in, redirect to main app
  useEffect(() => {
    if (user && !loading) {
      router.push('/');
    }
  }, [user, loading, router]);

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
      <div style={{padding: '2rem', textAlign: 'center'}}>
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          padding: '3rem',
          maxWidth: '500px',
          width: '100%',
        }}
      >
        <h1 style={{marginBottom: '0.5rem', textAlign: 'center'}}>
          VideoClip Studio
        </h1>
        <p style={{textAlign: 'center', color: '#666', marginBottom: '2rem'}}>
          Generador de imágenes con IA
        </p>

        {error && (
          <div
            style={{
              background: '#fee',
              border: '1px solid #fcc',
              borderRadius: '4px',
              color: '#c33',
              padding: '1rem',
              marginBottom: '1rem',
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: '1rem',
            fontWeight: '600',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseOver={(e) => {
            (e.target as HTMLButtonElement).style.background = '#5568d3';
          }}
          onMouseOut={(e) => {
            (e.target as HTMLButtonElement).style.background = '#667eea';
          }}
        >
          Iniciar sesión con Google
        </button>

        <p style={{textAlign: 'center', color: '#999', fontSize: '0.875rem', marginTop: '2rem'}}>
          Acceso restringido a usuarios autorizados
        </p>
      </div>
    </div>
  );
}
