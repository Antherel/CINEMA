import {NextRequest, NextResponse} from 'next/server';
import {listProjectReferences, readProjectReference} from '@/lib/projects';
import {verifyIdToken, checkEmailWhitelist} from '@/app/lib/auth';

export const runtime = 'nodejs';

type RouteParams = {
  params: Promise<{slug: string}>;
};

async function verifyAuth(request: NextRequest): Promise<{valid: boolean; response?: Response}> {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return {
        valid: false,
        response: NextResponse.json({error: 'Missing authentication token'}, {status: 401}),
      };
    }

    const decodedToken = await verifyIdToken(token);
    const userEmail = decodedToken.email;

    if (!checkEmailWhitelist(userEmail)) {
      return {
        valid: false,
        response: NextResponse.json({error: 'Access denied.'}, {status: 403}),
      };
    }

    return {valid: true};
  } catch {
    return {
      valid: false,
      response: NextResponse.json({error: 'Invalid or expired authentication token'}, {status: 401}),
    };
  }
}

export async function GET(request: NextRequest, context: RouteParams) {
  const auth = await verifyAuth(request);
  if (!auth.valid) return auth.response!;

  try {
    const {slug} = await context.params;
    const url = new URL(request.url);
    const fileName = url.searchParams.get('fileName')?.trim() || '';

    if (fileName) {
      // Serve the binary reference file
      const ref = await readProjectReference(slug, fileName);
      return new Response(new Uint8Array(ref.bytes), {
        status: 200,
        headers: {
          'Content-Type': ref.contentType,
          'Content-Disposition': `inline; filename="${ref.fileName}"`,
        },
      });
    }

    const refs = await listProjectReferences(slug);
    return NextResponse.json({references: refs});
  } catch (error) {
    console.error('References GET failed:', error);
    return NextResponse.json(
      {error: error instanceof Error ? error.message : 'Unexpected error.'},
      {status: 500},
    );
  }
}
