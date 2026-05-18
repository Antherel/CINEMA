import {randomUUID} from 'crypto';
import {NextRequest, NextResponse} from 'next/server';
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
import {verifyIdToken, checkEmailWhitelist} from '@/app/lib/auth';

export const runtime = 'nodejs';

// Validation constants
const VALIDATION = {
  MAX_REFERENCES: 5,
  MAX_REFERENCE_SIZE_MB: 10,
  MAX_PROMPT_LENGTH: 2000,
  MAX_GENERAL_PROMPT_LENGTH: 1000,
  MAX_PROJECT_NAME_LENGTH: 100,
  MAX_BATCH_IMAGES: 10,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
};

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

function validateProjectName(name: string): {valid: boolean; error?: string} {
  if (!name || !name.trim()) {
    return {valid: false, error: 'Project name is required.'};
  }
  if (name.length > VALIDATION.MAX_PROJECT_NAME_LENGTH) {
    return {
      valid: false,
      error: `Project name must be ${VALIDATION.MAX_PROJECT_NAME_LENGTH} characters or less.`,
    };
  }
  return {valid: true};
}

function validatePrompts(prompts: PromptEntry[]): {valid: boolean; error?: string} {
  for (const prompt of prompts) {
    if (prompt.prompt.length > VALIDATION.MAX_PROMPT_LENGTH) {
      return {
        valid: false,
        error: `Prompt for "${prompt.label}" exceeds ${VALIDATION.MAX_PROMPT_LENGTH} character limit.`,
      };
    }
  }
  return {valid: true};
}

function validateGeneralPrompt(text: string): {valid: boolean; error?: string} {
  if (text.length > VALIDATION.MAX_GENERAL_PROMPT_LENGTH) {
    return {
      valid: false,
      error: `General prompt must be ${VALIDATION.MAX_GENERAL_PROMPT_LENGTH} characters or less.`,
    };
  }
  return {valid: true};
}

function validateReferences(files: File[]): {valid: boolean; error?: string} {
  if (files.length > VALIDATION.MAX_REFERENCES) {
    return {
      valid: false,
      error: `Maximum ${VALIDATION.MAX_REFERENCES} references allowed, but ${files.length} were provided.`,
    };
  }

  for (const file of files) {
    const mimeType = file.type || 'application/octet-stream';
    if (!VALIDATION.ALLOWED_IMAGE_TYPES.includes(mimeType)) {
      return {
        valid: false,
        error: `Reference "${file.name}" has unsupported type: ${mimeType}. Allowed: JPEG, PNG, WebP, GIF.`,
      };
    }

    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > VALIDATION.MAX_REFERENCE_SIZE_MB) {
      return {
        valid: false,
        error: `Reference "${file.name}" is ${sizeMB.toFixed(1)}MB. Maximum is ${VALIDATION.MAX_REFERENCE_SIZE_MB}MB.`,
      };
    }
  }

  return {valid: true};
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

export async function POST(request: NextRequest) {
  // Verify authentication
  const auth = await verifyAuth(request);
  if (!auth.valid) {
    return auth.response!;
  }

  try {
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
    const imageCount = Math.max(
      1,
      Math.min(
        VALIDATION.MAX_BATCH_IMAGES,
        parseInt(String(formData.get('imageCount') ?? '3')),
      ),
    ) || 3;
    let prompts = parsePrompts(formData.get('prompts'));
    const referenceFile = formData.get('reference');

    // Validate project name
    const projectValidation = validateProjectName(projectName);
    if (!projectValidation.valid) {
      return NextResponse.json({error: projectValidation.error}, {status: 400});
    }

    // Validate general prompt length
    const generalPromptValidation = validateGeneralPrompt(generalPrompt);
    if (!generalPromptValidation.valid) {
      return NextResponse.json({error: generalPromptValidation.error}, {status: 400});
    }

    // Ensure prompts match imageCount
    if (prompts.length === 0) {
      // Generate default prompts if none provided
      prompts = Array.from({length: imageCount}, (_, i) => ({
        id: String.fromCharCode(97 + i),
        label: imageCount === 1 ? 'Imagen' : `Toma ${i + 1}`,
        prompt: '',
      }));
    } else if (prompts.length !== imageCount) {
      return NextResponse.json(
        {error: `Expected ${imageCount} prompt(s) but got ${prompts.length}.`},
        {status: 400},
      );
    }

    // Validate individual prompts
    const promptsValidation = validatePrompts(prompts);
    if (!promptsValidation.valid) {
      return NextResponse.json({error: promptsValidation.error}, {status: 400});
    }

    const preparedProject = await ensureProjectStructure(projectName);
    
    // Parse and validate multiple references
    const referencesData: Map<string, {file: File; name: string}> = new Map();
    const referenceNames: Map<string, string> = new Map();
    
    // Collect all files starting with 'reference_'
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('reference_') && value instanceof File) {
        const refId = key.replace('reference_', '');
        const refNameKey = `referenceName_${refId}`;
        const refName = String(formData.get(refNameKey) ?? `Ref-${refId}`).trim();
        referencesData.set(refId, {file: value, name: refName});
        referenceNames.set(refId, refName);
      }
    }

    // Validate references
    if (referencesData.size > 0) {
      const refsArray = Array.from(referencesData.values()).map((r) => r.file);
      const refsValidation = validateReferences(refsArray);
      if (!refsValidation.valid) {
        return NextResponse.json({error: refsValidation.error}, {status: 400});
      }
    }

    // Parse image-to-references mapping (e.g., {"a": ["ref1", "ref2"], "b": ["ref2"]})
    let imageReferencesMap: Record<string, string[]> = {};
    const imageReferencesRaw = formData.get('imageReferences');
    if (typeof imageReferencesRaw === 'string' && imageReferencesRaw.trim()) {
      try {
        imageReferencesMap = JSON.parse(imageReferencesRaw);
      } catch {
        // Ignore parse errors, default to empty
      }
    }

    // Load and convert all references to ImagePart for reuse
    const referencePartsMap: Map<string, ReturnType<typeof createPartFromBase64>> = new Map();
    for (const [refId, {file}] of referencesData.entries()) {
      const referenceBytes = Buffer.from(await file.arrayBuffer());
      const part = createPartFromBase64(
        referenceBytes.toString('base64'),
        file.type || 'image/jpeg',
      );
      referencePartsMap.set(refId, part);
    }

    // Keep backward compatibility: handle single 'reference' file
    let singleReferencePart = null;
    if (referenceFile instanceof File && referenceFile.size > 0) {
      const referenceBytes = Buffer.from(await referenceFile.arrayBuffer());
      singleReferencePart = createPartFromBase64(
        referenceBytes.toString('base64'),
        referenceFile.type || 'image/jpeg',
      );
      if (!imageReferencesMap || Object.keys(imageReferencesMap).length === 0) {
        // Use single reference for all if no mapping provided
        for (const prompt of prompts) {
          imageReferencesMap[prompt.id] = ['legacy'];
        }
        referencePartsMap.set('legacy', singleReferencePart);
      }
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

      // Add selected references for this image
      const selectedRefIds = imageReferencesMap[promptEntry.id] ?? [];
      for (const refId of selectedRefIds) {
        const refPart = referencePartsMap.get(refId);
        if (refPart) {
          contents.push(refPart);
        }
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents,
        config: {
          responseModalities: ['IMAGE'],
          imageConfig: {
            aspectRatio,
            imageSize,
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
        publicUrl: preparedProject.publicUrl,
      },
      outputs,
    });
  } catch (error) {
    console.error('Generate API failed:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected server error while generating images.',
      },
      {status: 500},
    );
  }
}