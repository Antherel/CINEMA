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