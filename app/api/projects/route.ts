import {NextRequest, NextResponse} from 'next/server';
import {ensureProjectStructure, listProjects} from '@/lib/projects';
import {verifyIdToken, checkEmailWhitelist} from '@/app/lib/auth';

export const runtime = 'nodejs';

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

export async function GET(request: NextRequest) {
  // Verify authentication
  const auth = await verifyAuth(request);
  if (!auth.valid) {
    return auth.response!;
  }

  try {
    const projects = await listProjects();
    return NextResponse.json({projects});
  } catch (error) {
    console.error('Projects GET failed:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected server error while listing projects.',
      },
      {status: 500},
    );
  }
}

export async function POST(request: NextRequest) {
  // Verify authentication
  const auth = await verifyAuth(request);
  if (!auth.valid) {
    return auth.response!;
  }

  try {
    const body = (await request.json().catch(() => null)) as
      | {projectName?: string}
      | null;

    const projectName = body?.projectName?.trim();
    if (!projectName) {
      return NextResponse.json(
        {error: 'Project name is required.'},
        {status: 400},
      );
    }

    const project = await ensureProjectStructure(projectName);
    return NextResponse.json({
      project: {
        displayName: project.displayName,
        slug: project.slug,
        rootDir: project.rootDir,
        resultsDir: project.resultsDir,
        referencePath: project.referencePath,
        publicUrl: project.publicUrl,
      },
    });
  } catch (error) {
    console.error('Projects POST failed:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected server error while creating project.',
      },
      {status: 500},
    );
  }
}