import {NextRequest, NextResponse} from 'next/server';
import {
  deleteProjectAsset,
  listProjectAssets,
  readProjectAsset,
} from '@/lib/projects';
import {verifyIdToken, checkEmailWhitelist} from '@/app/lib/auth';

export const runtime = 'nodejs';

type RouteParams = {
  params: Promise<{
    slug: string;
  }>;
};

/**
 * Verify Firebase auth token
 */
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
      console.warn(`Blocked request from unauthorized email: ${userEmail}`);
      return {
        valid: false,
        response: NextResponse.json(
          {error: 'Access denied. Your email is not authorized.'},
          {status: 403}
        ),
      };
    }

    return {valid: true};
  } catch (error) {
    console.error('Auth verification failed:', error);
    return {
      valid: false,
      response: NextResponse.json(
        {error: 'Invalid or expired authentication token'},
        {status: 401}
      ),
    };
  }
}

export async function GET(request: NextRequest, context: RouteParams) {
  // Verify authentication
  const auth = await verifyAuth(request);
  if (!auth.valid) {
    return auth.response!;
  }

  try {
    const {slug} = await context.params;
    const url = new URL(request.url);
    const download = url.searchParams.get('download');
    const fileName = url.searchParams.get('fileName')?.trim() || '';

    if (download === '1') {
      if (!fileName) {
        return NextResponse.json({error: 'fileName is required.'}, {status: 400});
      }

      const asset = await readProjectAsset(slug, fileName);
      return new Response(new Uint8Array(asset.bytes), {
        status: 200,
        headers: {
          'Content-Type': asset.contentType,
          'Content-Disposition': `attachment; filename="${asset.fileName}"`,
          'Content-Length': String(asset.bytes.length),
        },
      });
    }

    const assets = await listProjectAssets(slug);
    return NextResponse.json({assets});
  } catch (error) {
    console.error('Project assets GET failed:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected server error while listing assets.',
      },
      {status: 500},
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  // Verify authentication
  const auth = await verifyAuth(request);
  if (!auth.valid) {
    return auth.response!;
  }

  try {
    const {slug} = await context.params;
    const body = (await request.json().catch(() => null)) as
      | {fileName?: string}
      | null;
    const fileName = body?.fileName?.trim();

    if (!fileName) {
      return NextResponse.json({error: 'fileName is required.'}, {status: 400});
    }

    await deleteProjectAsset(slug, fileName);
    return NextResponse.json({ok: true});
  } catch (error) {
    console.error('Project assets DELETE failed:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected server error while deleting asset.',
      },
      {status: 500},
    );
  }
}