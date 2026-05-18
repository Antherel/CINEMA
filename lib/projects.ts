import {randomUUID} from 'crypto';
import {promises as fs} from 'fs';
import path from 'path';
import {Storage} from '@google-cloud/storage';

export type ProjectPaths = {
  displayName: string;
  slug: string;
  rootDir: string;
  resultsDir: string;
  referencePath: string;
  publicRoot: string;
  publicUrl: string;
  storageMode: 'local' | 'cloud';
};

export type StoredAsset = {
  filePath: string;
  publicUrl: string;
  storageMode: 'local' | 'cloud';
};

export type ProjectAsset = StoredAsset & {
  fileName: string;
  contentType: string;
  downloadUrl: string;
  updatedAt?: string;
};

export type ProjectReference = {
  id: string;
  name: string;
  description?: string;
  fileName: string;
  contentType: string;
  downloadUrl: string;
};

type RegistryRecord = {
  displayName: string;
  slug: string;
  rootDir: string;
  resultsDir: string;
  referencePath: string;
  publicUrl: string;
};

const PUBLIC_ROOT = path.join(process.cwd(), 'public');
const PROJECTS_ROOT = path.join(PUBLIC_ROOT, 'proyectos');
const REGISTRY_OBJECT = 'videoclip/registry.json';
const CLOUD_BASE_PREFIX = 'videoclip/projects';

function parseFirebaseConfig() {
  const rawConfig = process.env.FIREBASE_CONFIG?.trim();

  if (!rawConfig) {
    return null;
  }

  try {
    return JSON.parse(rawConfig) as {storageBucket?: string; projectId?: string};
  } catch {
    return null;
  }
}

function resolveBucketName() {
  return (
    process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
    process.env.STORAGE_BUCKET?.trim() ||
    parseFirebaseConfig()?.storageBucket?.trim() ||
    ''
  );
}

function isCloudMode() {
  return Boolean(resolveBucketName());
}

function getStorageClient() {
  return new Storage();
}

function getBucket() {
  const bucketName = resolveBucketName();
  if (!bucketName) {
    return null;
  }

  return getStorageClient().bucket(bucketName);
}

function getCloudProjectPrefix(projectName: string) {
  return `${CLOUD_BASE_PREFIX}/${normalizeProjectName(projectName)}`;
}

function getRegistryRecord(projectName: string): RegistryRecord {
  const slug = normalizeProjectName(projectName);
  const rootDir = `gs://${resolveBucketName()}/${getCloudProjectPrefix(projectName)}`;
  const resultsDir = `${rootDir}/assets_produccion`;
  const referencePath = `${rootDir}/referencia`;

  return {
    displayName: projectName.trim() || slug,
    slug,
    rootDir,
    resultsDir,
    referencePath,
    publicUrl: `/proyectos/${slug}`,
  };
}

async function loadCloudRegistry(): Promise<RegistryRecord[]> {
  const bucket = getBucket();
  if (!bucket) {
    return [];
  }

  const registryFile = bucket.file(REGISTRY_OBJECT);
  const [exists] = await registryFile.exists();
  if (!exists) {
    return [];
  }

  const [content] = await registryFile.download();
  const parsed = JSON.parse(content.toString('utf8')) as {
    projects?: RegistryRecord[];
  };

  return Array.isArray(parsed.projects) ? parsed.projects : [];
}

async function saveCloudRegistry(projects: RegistryRecord[]) {
  const bucket = getBucket();
  if (!bucket) {
    return;
  }

  await bucket.file(REGISTRY_OBJECT).save(JSON.stringify({projects}, null, 2), {
    resumable: false,
    contentType: 'application/json',
  });
}

function buildFirebaseDownloadUrl(bucketName: string, objectPath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
}

function buildAssetDownloadUrl(projectSlug: string, fileName: string) {
  return `/api/projects/${encodeURIComponent(projectSlug)}/assets?download=1&fileName=${encodeURIComponent(fileName)}`;
}

function safeAssetFileName(fileName: string) {
  const normalized = path.basename(fileName);
  if (!normalized || normalized !== fileName || normalized.includes('..')) {
    throw new Error('Invalid asset file name.');
  }

  return normalized;
}

function mimeTypeFromFileName(fileName: string) {
  switch (path.extname(fileName).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

async function uploadCloudAsset(
  objectPath: string,
  bytes: Buffer,
  contentType: string,
): Promise<StoredAsset> {
  const bucket = getBucket();
  if (!bucket) {
    throw new Error('Cloud Storage bucket is not configured.');
  }

  const bucketName = resolveBucketName();
  try {
    const token = randomUUID().replace(/-/g, '');
    await bucket.file(objectPath).save(bytes, {
      resumable: false,
      contentType,
      metadata: {
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      },
    });

    return {
      filePath: `gs://${bucket.name}/${objectPath}`,
      publicUrl: buildFirebaseDownloadUrl(bucket.name, objectPath, token),
      storageMode: 'cloud',
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('does not exist')) {
      throw new Error(
        `Cloud Storage bucket "${bucketName}" does not exist. ` +
        `Create it in Google Cloud Console or verify the FIREBASE_STORAGE_BUCKET environment variable.`
      );
    }
    throw error;
  }
}

export function normalizeProjectName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'proyecto';
}

export function getProjectPaths(projectName: string): ProjectPaths {
  const slug = normalizeProjectName(projectName);
  const rootDir = path.join(PROJECTS_ROOT, slug);
  const resultsDir = path.join(rootDir, 'assets_produccion');
  const referencePath = path.join(rootDir, 'referencia');

  return {
    displayName: projectName.trim() || slug,
    slug,
    rootDir,
    resultsDir,
    referencePath,
    publicRoot: PUBLIC_ROOT,
    publicUrl: `/proyectos/${slug}`,
    storageMode: 'local',
  };
}

export async function ensureProjectStructure(projectName: string) {
  if (isCloudMode()) {
    const record = getRegistryRecord(projectName);
    const registry = await loadCloudRegistry();
    const nextRegistry = [
      ...registry.filter((project) => project.slug !== record.slug),
      record,
    ].sort((left, right) => left.slug.localeCompare(right.slug));

    await saveCloudRegistry(nextRegistry);

    return {
      ...record,
      publicRoot: '',
      storageMode: 'cloud' as const,
    };
  }

  const project = getProjectPaths(projectName);
  await fs.mkdir(project.resultsDir, {recursive: true});
  return project;
}

export async function listProjects() {
  if (isCloudMode()) {
    const registry = await loadCloudRegistry();
    return registry.map((project) => ({
      ...project,
      publicRoot: '',
      storageMode: 'cloud' as const,
    }));
  }

  await fs.mkdir(PROJECTS_ROOT, {recursive: true});

  const entries = await fs.readdir(PROJECTS_ROOT, {withFileTypes: true});
  const projects = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const project = getProjectPaths(entry.name);
      return {
        displayName: entry.name,
        slug: project.slug,
        rootDir: project.rootDir,
        resultsDir: project.resultsDir,
        referencePath: project.referencePath,
        publicUrl: project.publicUrl,
        storageMode: 'local' as const,
      };
    })
    .sort((left, right) => left.slug.localeCompare(right.slug));

  return projects;
}

export function mimeTypeToExtension(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    default:
      return '.bin';
  }
}

export async function saveReferenceFile(projectName: string, file: File) {
  if (isCloudMode()) {
    const bucketPrefix = getCloudProjectPrefix(projectName);
    const extension = mimeTypeToExtension(file.type || 'image/jpeg');
    const objectPath = `${bucketPrefix}/referencia${extension}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    return uploadCloudAsset(objectPath, bytes, file.type || 'image/jpeg');
  }

  const project = await ensureProjectStructure(projectName);
  const extension = mimeTypeToExtension(file.type || 'image/jpeg');
  const filePath = `${project.referencePath}${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, bytes);

  return {
    project,
    filePath,
    publicUrl: `${project.publicUrl}/${path.basename(filePath)}`,
    storageMode: 'local' as const,
  };
}

export async function saveGeneratedAsset(
  projectName: string,
  fileName: string,
  bytes: Buffer,
  contentType: string,
) {
  if (isCloudMode()) {
    const objectPath = `${getCloudProjectPrefix(projectName)}/assets_produccion/${fileName}`;
    return uploadCloudAsset(objectPath, bytes, contentType);
  }

  const project = await ensureProjectStructure(projectName);
  const filePath = path.join(project.resultsDir, fileName);
  await fs.writeFile(filePath, bytes);

  return {
    filePath,
    publicUrl: toResultPublicUrl(project.slug, fileName),
    storageMode: 'local' as const,
  };
}

export function toResultPublicUrl(projectSlug: string, fileName: string): string {
  return `/proyectos/${projectSlug}/assets_produccion/${fileName}`;
}

async function readLocalAsset(projectSlug: string, fileName: string): Promise<ProjectAsset | null> {
  const safeName = safeAssetFileName(fileName);
  const project = getProjectPaths(projectSlug);
  const filePath = path.join(project.resultsDir, safeName);

  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      return null;
    }

    return {
      fileName: safeName,
      filePath,
      publicUrl: toResultPublicUrl(project.slug, safeName),
      storageMode: 'local',
      contentType: mimeTypeFromFileName(safeName),
      downloadUrl: buildAssetDownloadUrl(project.slug, safeName),
      updatedAt: stats.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

async function readCloudAsset(projectSlug: string, fileName: string): Promise<ProjectAsset | null> {
  const safeName = safeAssetFileName(fileName);
  const bucket = getBucket();
  if (!bucket) {
    return null;
  }

  const objectPath = `${getCloudProjectPrefix(projectSlug)}/assets_produccion/${safeName}`;
  const file = bucket.file(objectPath);
  const [exists] = await file.exists();
  if (!exists) {
    return null;
  }

  const [metadata] = await file.getMetadata();
  const token = String(metadata.metadata?.firebaseStorageDownloadTokens ?? '').split(',')[0].trim();

  return {
    fileName: safeName,
    filePath: `gs://${bucket.name}/${objectPath}`,
    publicUrl:
      token.length > 0
        ? buildFirebaseDownloadUrl(bucket.name, objectPath, token)
        : `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(objectPath)}`,
    storageMode: 'cloud',
    contentType: metadata.contentType || mimeTypeFromFileName(safeName),
    downloadUrl: buildAssetDownloadUrl(projectSlug, safeName),
    updatedAt: metadata.updated,
  };
}

export async function listProjectAssets(projectSlug: string): Promise<ProjectAsset[]> {
  const safeSlug = normalizeProjectName(projectSlug);

  if (isCloudMode()) {
    const bucket = getBucket();
    if (!bucket) {
      return [];
    }

    const prefix = `${getCloudProjectPrefix(safeSlug)}/assets_produccion/`;
    const [files] = await bucket.getFiles({prefix});
    const assets = await Promise.all(
      files
        .filter((file) => file.name.startsWith(prefix) && !file.name.endsWith('/'))
        .map(async (file) => {
          const fileName = path.basename(file.name);
          return readCloudAsset(safeSlug, fileName);
        }),
    );

    return assets
      .filter((asset): asset is ProjectAsset => Boolean(asset))
      .sort((left, right) => (right.updatedAt || '').localeCompare(left.updatedAt || ''));
  }

  const project = getProjectPaths(safeSlug);
  try {
    await fs.mkdir(project.resultsDir, {recursive: true});
  } catch {
    return [];
  }

  const entries = await fs.readdir(project.resultsDir, {withFileTypes: true});
  const assets = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => readLocalAsset(safeSlug, entry.name)),
  );

  return assets
    .filter((asset): asset is ProjectAsset => Boolean(asset))
    .sort((left, right) => (right.updatedAt || '').localeCompare(left.updatedAt || ''));
}

export async function deleteProjectAsset(projectSlug: string, fileName: string) {
  const safeSlug = normalizeProjectName(projectSlug);
  const safeName = safeAssetFileName(fileName);

  if (isCloudMode()) {
    const bucket = getBucket();
    if (!bucket) {
      throw new Error('Cloud Storage bucket is not configured.');
    }

    const objectPath = `${getCloudProjectPrefix(safeSlug)}/assets_produccion/${safeName}`;
    await bucket.file(objectPath).delete({ignoreNotFound: true});
    return;
  }

  const project = getProjectPaths(safeSlug);
  const filePath = path.join(project.resultsDir, safeName);

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

export async function readProjectAsset(projectSlug: string, fileName: string) {
  const safeSlug = normalizeProjectName(projectSlug);
  const safeName = safeAssetFileName(fileName);

  if (isCloudMode()) {
    const bucket = getBucket();
    if (!bucket) {
      throw new Error('Cloud Storage bucket is not configured.');
    }

    const objectPath = `${getCloudProjectPrefix(safeSlug)}/assets_produccion/${safeName}`;
    const file = bucket.file(objectPath);
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error('Asset not found.');
    }

    const [bytes] = await file.download();
    const [metadata] = await file.getMetadata();

    return {
      fileName: safeName,
      filePath: `gs://${bucket.name}/${objectPath}`,
      contentType: metadata.contentType || mimeTypeFromFileName(safeName),
      bytes,
      storageMode: 'cloud' as const,
    };
  }

  const project = getProjectPaths(safeSlug);
  const filePath = path.join(project.resultsDir, safeName);
  const bytes = await fs.readFile(filePath);

  return {
    fileName: safeName,
    filePath,
    contentType: mimeTypeFromFileName(safeName),
    bytes,
    storageMode: 'local' as const,
  };
}

// ─── Named references (persisted per project) ────────────────────────────────

type ReferenceMetadataEntry = {
  id: string;
  name: string;
  description?: string;
  fileName: string;
  contentType: string;
};

function buildReferenceFilePath(projectSlug: string, fileName: string) {
  const project = getProjectPaths(projectSlug);
  return path.join(project.rootDir, 'references', fileName);
}

function buildReferenceMetadataPath(projectSlug: string) {
  const project = getProjectPaths(projectSlug);
  return path.join(project.rootDir, 'references', 'metadata.json');
}

function buildReferenceDownloadUrl(projectSlug: string, fileName: string) {
  return `/api/projects/${encodeURIComponent(projectSlug)}/references?fileName=${encodeURIComponent(fileName)}`;
}

async function loadReferenceMetadataLocal(projectSlug: string): Promise<ReferenceMetadataEntry[]> {
  const metaPath = buildReferenceMetadataPath(projectSlug);
  try {
    const content = await fs.readFile(metaPath, 'utf8');
    const parsed = JSON.parse(content) as {entries?: ReferenceMetadataEntry[]};
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
}

async function findLegacyReference(projectSlug: string): Promise<ProjectReference | null> {
  const extensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

  if (isCloudMode()) {
    const bucket = getBucket();
    if (!bucket) {
      return null;
    }

    for (const extension of extensions) {
      const fileName = `referencia${extension}`;
      const objectPath = `${getCloudProjectPrefix(projectSlug)}/${fileName}`;
      const file = bucket.file(objectPath);
      const [exists] = await file.exists();
      if (exists) {
        const [metadata] = await file.getMetadata();
        return {
          id: 'legacy-reference',
          name: 'Referencia guardada',
          description: 'Referencia heredada del proyecto.',
          fileName,
          contentType: metadata.contentType || mimeTypeFromFileName(fileName),
          downloadUrl: buildReferenceDownloadUrl(projectSlug, fileName),
        };
      }
    }

    return null;
  }

  for (const extension of extensions) {
    const fileName = `referencia${extension}`;
    const filePath = path.join(getProjectPaths(projectSlug).rootDir, fileName);
    try {
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        return {
          id: 'legacy-reference',
          name: 'Referencia guardada',
          description: 'Referencia heredada del proyecto.',
          fileName,
          contentType: mimeTypeFromFileName(fileName),
          downloadUrl: buildReferenceDownloadUrl(projectSlug, fileName),
        };
      }
    } catch {
      // keep searching
    }
  }

  return null;
}

async function saveReferenceMetadataLocal(projectSlug: string, entries: ReferenceMetadataEntry[]) {
  const metaPath = buildReferenceMetadataPath(projectSlug);
  await fs.mkdir(path.dirname(metaPath), {recursive: true});
  await fs.writeFile(metaPath, JSON.stringify({entries}, null, 2), 'utf8');
}

export async function saveNamedReference(
  projectName: string,
  id: string,
  name: string,
  description: string | undefined,
  file: File,
) {
  const slug = normalizeProjectName(projectName);
  const extension = mimeTypeToExtension(file.type || 'image/jpeg');
  const fileName = `${id}${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  if (isCloudMode()) {
    const objectPath = `${getCloudProjectPrefix(projectName)}/references/${fileName}`;
    await uploadCloudAsset(objectPath, bytes, file.type || 'image/jpeg');
    const bucket = getBucket();
    if (bucket) {
      const metaPath = `${getCloudProjectPrefix(projectName)}/references/metadata.json`;
      let existing: ReferenceMetadataEntry[] = [];
      try {
        const [content] = await bucket.file(metaPath).download();
        const parsed = JSON.parse(content.toString('utf8')) as {entries?: ReferenceMetadataEntry[]};
        existing = Array.isArray(parsed.entries) ? parsed.entries : [];
      } catch {
        existing = [];
      }
      const filtered = existing.filter((e) => e.id !== id);
      filtered.push({id, name, description, fileName, contentType: file.type || 'image/jpeg'});
      await bucket.file(metaPath).save(JSON.stringify({entries: filtered}, null, 2), {
        resumable: false,
        contentType: 'application/json',
      });
    }
    return;
  }

  const filePath = buildReferenceFilePath(slug, fileName);
  await fs.mkdir(path.dirname(filePath), {recursive: true});
  await fs.writeFile(filePath, bytes);

  const entries = await loadReferenceMetadataLocal(slug);
  const filtered = entries.filter((e) => e.id !== id);
  filtered.push({id, name, description, fileName, contentType: file.type || 'image/jpeg'});
  await saveReferenceMetadataLocal(slug, filtered);
}

export async function listProjectReferences(projectSlug: string): Promise<ProjectReference[]> {
  const safeSlug = normalizeProjectName(projectSlug);

  if (isCloudMode()) {
    const bucket = getBucket();
    if (!bucket) return [];
    const metaPath = `${getCloudProjectPrefix(safeSlug)}/references/metadata.json`;
    try {
      const [content] = await bucket.file(metaPath).download();
      const parsed = JSON.parse(content.toString('utf8')) as {entries?: ReferenceMetadataEntry[]};
      const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
      const mapped = entries.map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        fileName: e.fileName,
        contentType: e.contentType,
        downloadUrl: buildReferenceDownloadUrl(safeSlug, e.fileName),
      }));
      if (mapped.length > 0) {
        return mapped;
      }
    } catch {
      // fall through to legacy lookup
    }

    const legacy = await findLegacyReference(safeSlug);
    return legacy ? [legacy] : [];
  }

  const entries = await loadReferenceMetadataLocal(safeSlug);
  const mapped = entries.map((e) => ({
    id: e.id,
    name: e.name,
    description: e.description,
    fileName: e.fileName,
    contentType: e.contentType,
    downloadUrl: buildReferenceDownloadUrl(safeSlug, e.fileName),
  }));
  if (mapped.length > 0) {
    return mapped;
  }

  const legacy = await findLegacyReference(safeSlug);
  return legacy ? [legacy] : [];
}

export async function readProjectReference(projectSlug: string, fileName: string) {
  const safeSlug = normalizeProjectName(projectSlug);
  const safeName = safeAssetFileName(fileName);

  if (isCloudMode()) {
    const bucket = getBucket();
    if (!bucket) throw new Error('Cloud Storage bucket is not configured.');
    const objectPath = `${getCloudProjectPrefix(safeSlug)}/references/${safeName}`;
    const file = bucket.file(objectPath);
    const [exists] = await file.exists();
    if (!exists) throw new Error('Reference not found.');
    const [bytes] = await file.download();
    const [metadata] = await file.getMetadata();
    return {
      fileName: safeName,
      contentType: metadata.contentType || mimeTypeFromFileName(safeName),
      bytes,
    };
  }

  const filePath = buildReferenceFilePath(safeSlug, safeName);
  const bytes = await fs.readFile(filePath);
  return {
    fileName: safeName,
    contentType: mimeTypeFromFileName(safeName),
    bytes,
  };
}