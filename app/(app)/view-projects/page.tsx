'use client';

import React, {useEffect, useState} from 'react';
import Link from 'next/link';
import {useAuth} from '@/app/lib/AuthProvider';

type ProjectItem = {
  displayName: string;
  slug: string;
  rootDir: string;
  resultsDir: string;
  referencePath: string;
  publicUrl: string;
};

type AssetItem = {
  fileName: string;
  filePath: string;
  publicUrl: string;
  storageMode: 'local' | 'cloud';
  contentType: string;
  downloadUrl: string;
  updatedAt?: string;
  prompt?: string;
};

/**
 * View projects page
 * Browse projects, select one, and view/manage its assets
 * Phase 5: Enhanced UX with better states and navigation
 */
export default function ViewProjectsPage() {
  const {getIdToken} = useAuth();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [error, setError] = useState('');
  const [deleteInProgress, setDeleteInProgress] = useState<string | null>(null);

  // Load projects on mount
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const token = await getIdToken();
        const response = await fetch('/api/projects', {
          headers: {'Authorization': `Bearer ${token}`},
        });

        if (!response.ok) {
          throw new Error('Failed to load projects');
        }

        const data = await response.json();
        setProjects(data.projects || []);
        if (data.projects?.length > 0) {
          setSelectedProject(data.projects[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading projects');
      } finally {
        setIsLoadingProjects(false);
      }
    };

    loadProjects();
  }, [getIdToken]);

  // Load assets when selected project changes
  useEffect(() => {
    if (!selectedProject) return;

    const loadAssets = async () => {
      setIsLoadingAssets(true);
      setError('');
      try {
        const token = await getIdToken();
        const response = await fetch(
          `/api/projects/${encodeURIComponent(selectedProject.slug)}/assets`,
          {headers: {'Authorization': `Bearer ${token}`}},
        );

        if (!response.ok) {
          throw new Error('Failed to load assets');
        }

        const data = await response.json();
        setAssets(data.assets || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading assets');
      } finally {
        setIsLoadingAssets(false);
      }
    };

    loadAssets();
  }, [selectedProject, getIdToken]);

  const handleDeleteAsset = async (fileName: string) => {
    if (!selectedProject) return;

    const confirmed = window.confirm(`Eliminar ${fileName}?`);
    if (!confirmed) return;

    setDeleteInProgress(fileName);
    try {
      const token = await getIdToken();
      const response = await fetch(
        `/api/projects/${encodeURIComponent(selectedProject.slug)}/assets`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({fileName}),
        },
      );

      if (!response.ok) {
        throw new Error('Failed to delete asset');
      }

      setAssets((current) => current.filter((a) => a.fileName !== fileName));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting asset');
    } finally {
      setDeleteInProgress(null);
    }
  };

  if (isLoadingProjects) {
    return (
      <main className="shell">
        <section className="grid vpLoadingSection">
          <div className="vpCentered">
            <div className="vpIconMd">⏳</div>
            <p>Cargando tus proyectos...</p>
          </div>
        </section>
      </main>
    );
  }

  if (projects.length === 0) {
    return (
      <main className="shell">
        <section className="grid">
          <div className="panel vpEmptyPanel">
            <div className="vpIconLg">📁</div>
            <h2>Sin proyectos aún</h2>
            <p className="vpLead">
              Crea tu primer proyecto generando imágenes en una de estas secciones:
            </p>
            <div className="vpActionRow">
              <Link href="/create-imagen" className="button buttonSecondary">
                🖼️ Crear una imagen
              </Link>
              <Link href="/create-batch" className="button buttonSecondary">
                📸 Crear lote
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="vpLayout">
        {/* Sidebar - Projects List */}
        <aside className="vpSidebar">
          <div className="panel">
            <div className="panelHeader">
              <h2 className="vpNoMarginBottom">Mis Proyectos</h2>
              <p className="vpProjectCount">
                {projects.length} proyecto{projects.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="vpProjectList">
              {projects.map((project) => (
                <button
                  key={project.slug}
                  onClick={() => setSelectedProject(project)}
                  className={`vpProjectButton ${selectedProject?.slug === project.slug ? 'vpProjectButtonActive' : ''}`}
                >
                  {project.displayName}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="panel vpQuickPanel">
            <h3 className="vpQuickTitle">Crear más</h3>
            <div className="vpQuickActions">
              <Link
                href="/create-imagen"
                className="button buttonSecondary buttonSmall vpQuickLink"
              >
                🖼️ Una imagen
              </Link>
              <Link
                href="/create-batch"
                className="button buttonSecondary buttonSmall vpQuickLink"
              >
                📸 Un lote
              </Link>
            </div>
          </div>
        </aside>

        {/* Main Content - Assets */}
        <div className="panel">
          <div className="panelHeader">
            {selectedProject && (
              <>
                <div>
                  <h1 className="vpProjectTitle">{selectedProject.displayName}</h1>
                  <p className="vpProjectMeta">
                    {isLoadingAssets ? '...cargando...' : `${assets.length} imagen${assets.length !== 1 ? 'es' : ''}`}
                  </p>
                </div>
              </>
            )}
          </div>

          {error && (
            <div className="vpErrorBox">
              <strong>Error:</strong> {error}
            </div>
          )}

          {selectedProject && (
            <>
              {isLoadingAssets ? (
                <div className="vpAssetsLoading">
                  <div className="vpIconMd">⏳</div>
                  <p>Cargando imágenes...</p>
                </div>
              ) : assets.length === 0 ? (
                <div className="vpAssetsEmpty">
                  <div className="vpIconLg">🖼️</div>
                  <p>No hay imágenes en este proyecto aún.</p>
                  <p className="vpAssetsHint">
                    Crea nuevas imágenes en las secciones de generación.
                  </p>
                </div>
              ) : (
                <div className="galleryGrid">
                  {assets.map((asset) => (
                    <article
                      key={asset.fileName}
                      className={`resultCard ${deleteInProgress === asset.fileName ? 'vpCardDimmed' : ''}`}
                    >
                      <div className="resultImageWrap">
                        <img src={asset.publicUrl} alt={asset.fileName} />
                        {deleteInProgress === asset.fileName && (
                          <div className="vpDeletingOverlay">
                            <span className="vpDeletingText">Eliminando...</span>
                          </div>
                        )}
                      </div>
                      <div className="resultMeta">
                        <h3 className="vpAssetName">{asset.fileName}</h3>
                        <p className="vpAssetType">
                          {asset.contentType}
                        </p>
                        {asset.prompt && (
                          <p className="vpAssetPrompt">{asset.prompt}</p>
                        )}
                        <div className="assetActions">
                          <a
                            href={asset.downloadUrl}
                            className="button buttonSecondary buttonSmall"
                            title="Download this image"
                          >
                            ⬇️ Descargar
                          </a>
                          <a
                            href={asset.publicUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="button buttonSecondary buttonSmall"
                            title="Open in new tab"
                          >
                            🔗 Abrir
                          </a>
                          <button
                            type="button"
                            className="button buttonDanger buttonSmall"
                            onClick={() => handleDeleteAsset(asset.fileName)}
                            disabled={deleteInProgress === asset.fileName}
                            title="Delete this image"
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
