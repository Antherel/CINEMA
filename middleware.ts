import {NextRequest, NextResponse} from 'next/server';

// Paths that don't require authentication
const publicPaths = [
  '/',
  '/login',
  '/api/firebase-config',  // Public endpoint to get Firebase config
];

// Check if a path is public
function isPublicPath(pathname: string): boolean {
  return publicPaths.some((path) => pathname === path || pathname.startsWith(path + '/'));
}

/**
 * Middleware to protect API routes
 * - Checks for Bearer token in Authorization header
 * - Passes token through to API routes for verification
 * - Allows public paths through without auth
 */
export async function middleware(request: NextRequest) {
  const {pathname} = request.nextUrl;

  // Skip public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Protect all /api/* routes by requiring auth header
  if (pathname.startsWith('/api/')) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        {error: 'Missing authentication token'},
        {status: 401}
      );
    }

    // Token presence check passed, proceed to API route
    // API route will verify the token with Firebase Admin SDK
    return NextResponse.next();
  }

  return NextResponse.next();
}

// Configure which routes to apply middleware to
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
