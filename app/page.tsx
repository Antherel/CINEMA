'use client';

import {useEffect} from 'react';
import {useRouter} from 'next/navigation';

/**
 * Root page - redirects authenticated users to the app
 */
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the first app page
    router.push('/create-imagen');
  }, [router]);

  return (
    <div style={{padding: '2rem', textAlign: 'center'}}>
      <p>Redirigiendo...</p>
    </div>
  );
}
