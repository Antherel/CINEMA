import {NextResponse} from 'next/server';
import {getFirebaseWebConfig} from '@/app/lib/auth';

export const runtime = 'nodejs';

/**
 * GET /api/firebase-config
 * Returns Firebase web SDK configuration to initialize the client.
 */
export async function GET() {
  try {
    const config = getFirebaseWebConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error getting Firebase config:', error);
    return NextResponse.json(
      {error: 'Failed to retrieve Firebase configuration'},
      {status: 500}
    );
  }
}
