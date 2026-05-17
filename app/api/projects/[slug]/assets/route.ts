import {NextResponse} from 'next/server';
import {
  deleteProjectAsset,
  listProjectAssets,
  readProjectAsset,
} from '@/lib/projects';

export const runtime = 'nodejs';

type RouteParams = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(request: Request, context: RouteParams) {
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

export async function DELETE(request: Request, context: RouteParams) {
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