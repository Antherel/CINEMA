import {NextResponse} from 'next/server';
import {ensureProjectStructure, listProjects} from '@/lib/projects';

export const runtime = 'nodejs';

export async function GET() {
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

export async function POST(request: Request) {
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