import {randomUUID} from 'crypto';
import {NextResponse} from 'next/server';
import {
  GenerateContentResponse,
  GoogleGenAI,
  createPartFromBase64,
  createPartFromText,
} from '@google/genai';
import {
  ensureProjectStructure,
  saveReferenceFile,
  saveGeneratedAsset,
} from '@/lib/projects';

export const runtime = 'nodejs';

type PromptEntry = {
  id: string;
  label: string;
  prompt: string;
};

function resolveApiKey(): string {
  return (
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || ''
  );
}

function buildPrompt(generalPrompt: string, prompt: string, label: string) {
  const segments = [generalPrompt.trim(), prompt.trim()].filter(Boolean);

  if (segments.length === 0) {
    return `Crea una variacion visual coherente para ${label}.`;
  }

  if (segments.length === 1) {
    return segments[0];
  }

  return segments.join('\n\n');
}

function parsePrompts(rawValue: FormDataEntryValue | null): PromptEntry[] {
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as PromptEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function pickInlineImage(response: GenerateContentResponse) {
  const responseLike = response as unknown as {
    parts?: Array<{inlineData?: {data?: string; mimeType?: string}}>;
    candidates?: Array<{
      content?: {parts?: Array<{inlineData?: {data?: string; mimeType?: string}}>};
    }>;
  };
  const parts = responseLike.parts ?? responseLike.candidates?.[0]?.content?.parts ?? [];

  return parts.find((part) => Boolean(part.inlineData?.data && part.inlineData?.mimeType));
}

export async function POST(request: Request) {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {error: 'Set GEMINI_API_KEY or GOOGLE_API_KEY in .env.local.'},
      {status: 500},
    );
  }

  const formData = await request.formData();
  const projectName = String(formData.get('projectName') ?? '').trim();
  const generalPrompt = String(formData.get('generalPrompt') ?? '').trim();
  const aspectRatio = String(formData.get('aspectRatio') ?? '1:1');
  const imageSize = String(formData.get('imageSize') ?? '1K');
  const prompts = parsePrompts(formData.get('prompts'));
  const referenceFile = formData.get('reference');

  if (!projectName) {
    return NextResponse.json(
      {error: 'Project name is required.'},
      {status: 400},
    );
  }

  const preparedProject = await ensureProjectStructure(projectName);
  let referencePath = null;
  let referencePart = null;

  if (referenceFile instanceof File && referenceFile.size > 0) {
    const savedReference = await saveReferenceFile(projectName, referenceFile);
    referencePath = savedReference.filePath;
    if (savedReference.publicUrl) {
      referencePath = savedReference.publicUrl;
    }
    const referenceBytes = Buffer.from(await referenceFile.arrayBuffer());
    referencePart = createPartFromBase64(
      referenceBytes.toString('base64'),
      referenceFile.type || 'image/jpeg',
    );
  }

  const ai = new GoogleGenAI({apiKey});

  const outputs: Array<{
    id: string;
    label: string;
    prompt: string;
    fileName: string;
    filePath: string;
    publicUrl: string;
  }> = [];

  for (const [index, promptEntry] of prompts.entries()) {
    const label = promptEntry.label || `Imagen ${index + 1}`;
    const prompt = buildPrompt(generalPrompt, promptEntry.prompt, label);
    const contents = [createPartFromText(prompt)];

    if (referencePart) {
      contents.push(referencePart);
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents,
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio,
          imageSize,
          outputMimeType: 'image/png',
        },
      },
    });

    const imagePart = pickInlineImage(response);
    if (!imagePart?.inlineData?.data || !imagePart.inlineData.mimeType) {
      throw new Error(`No image returned for ${label}.`);
    }

    const imageBytes = Buffer.from(imagePart.inlineData.data, 'base64');
    const fileName = `${String(index + 1).padStart(2, '0')}-${randomUUID()}.png`;
    const savedAsset = await saveGeneratedAsset(
      projectName,
      fileName,
      imageBytes,
      imagePart.inlineData.mimeType,
    );

    outputs.push({
      id: promptEntry.id,
      label,
      prompt,
      fileName,
      filePath: savedAsset.filePath,
      publicUrl: savedAsset.publicUrl,
    });
  }

  return NextResponse.json({
    project: {
      displayName: preparedProject.displayName,
      slug: preparedProject.slug,
      rootDir: preparedProject.rootDir,
      resultsDir: preparedProject.resultsDir,
      referencePath: referencePath ?? preparedProject.referencePath,
      publicUrl: preparedProject.publicUrl,
    },
    outputs,
  });
}