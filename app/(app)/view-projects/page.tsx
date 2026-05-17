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
        <section className="grid" style={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px'}}>
          <div style={{textAlign: 'center'}}>
            <div style={{fontSize: '2rem', marginBottom: '1rem'}}>⏳</div>
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
          <div className="panel" style={{textAlign: 'center', padding: '3rem'}}>
            <div style={{fontSize: '3rem', marginBottom: '1rem'}}>📁</div>
            <h2>Sin proyectos aún</h2>
            <p style={{marginBottom: '2rem', color: '#666'}}>
              Crea tu primer proyecto generando imágenes en una de estas secciones:
            </p>
            <div style={{display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap'}}>
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
      <section style={{display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1rem', marginBottom: '2rem'}}>
        {/* Sidebar - Projects List */}
        <aside style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
          <div className="panel">
            <div className="panelHeader">
              <h2 style={{marginBottom: 0}}>Mis Proyectos</h2>
              <p style={{marginTop: '0.5rem', fontSize: '0.875rem', color: '#666'}}>
                {projects.length} proyecto{projects.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
              {projects.map((project) => (
                <button
                  key={project.slug}
                  onClick={() => setSelectedProject(project)}
                  style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    background: selectedProject?.slug === project.slug ? '#667eea' : '#f9f9f9',
                    color: selectedProject?.slug === project.slug ? 'white' : '#333',
                    border: selectedProject?.slug === project.slug ? '2px solid #667eea' : '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontWeight: selectedProject?.slug === project.slug ? 'bold' : 'normal',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedProject?.slug !== project.slug) {
                      e.currentTarget.style.backgroundColor = '#f0f0f0';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedProject?.slug !== project.slug) {
                      e.currentTarget.style.backgroundColor = '#f9f9f9';
                    }
                  }}
                >
                  {project.displayName}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="panel" style={{backgroundColor: '#f0f7ff', borderColor: '#dde8f5'}}>
            <h3 style={{margin: '0 0 1rem 0', fontSize: '0.9rem'}}>Crear más</h3>
            <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
              <Link
                href="/create-imagen"
                className="button buttonSecondary buttonSmall"
                style={{textAlign: 'center', fontSize: '0.875rem'}}
              >
                🖼️ Una imagen
              </Link>
              <Link
                href="/create-batch"
                className="button buttonSecondary buttonSmall"
                style={{textAlign: 'center', fontSize: '0.875rem'}}
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
                  <h1 style={{margin: '0 0 0.5rem 0'}}>{selectedProject.displayName}</h1>
                  <p style={{margin: 0, color: '#666', fontSize: '0.9rem'}}>
                    {isLoadingAssets ? '...cargando...' : `${assets.length} imagen${assets.length !== 1 ? 'es' : ''}`}
                  </p>
                </div>
              </>
            )}
          </div>

          {error && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#fee',
              borderLeft: '4px solid #c00',
              marginBottom: '1rem',
              borderRadius: '2px',
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {selectedProject && (
            <>
              {isLoadingAssets ? (
                <div style={{
                  padding: '3rem',
                  textAlign: 'center',
                  color: '#999',
                }}>
                  <div style={{fontSize: '2rem', marginBottom: '1rem'}}>⏳</div>
                  <p>Cargando imágenes...</p>
                </div>
              ) : assets.length === 0 ? (
                <div style={{
                  padding: '3rem',
                  textAlign: 'center',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '4px',
                  color: '#999',
                }}>
                  <div style={{fontSize: '3rem', marginBottom: '1rem'}}>🖼️</div>
                  <p>No hay imágenes en este proyecto aún.</p>
                  <p style={{fontSize: '0.9rem', marginBottom: '1rem'}}>
                    Crea nuevas imágenes en las secciones de generación.
                  </p>
                </div>
              ) : (
                <div className="galleryGrid">
                  {assets.map((asset) => (
                    <article
                      className="resultCard"
                      key={asset.fileName}
                      style={{opacity: deleteInProgress === asset.fileName ? 0.5 : 1}}
                    >
                      <div className="resultImageWrap">
                        <img src={asset.publicUrl} alt={asset.fileName} />
                        {deleteInProgress === asset.fileName && (
                          <div style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'rgba(0,0,0,0.3)',
                          }}>
                            <span style={{color: 'white'}}>Eliminando...</span>
                          </div>
                        )}
                      </div>
                      <div className="resultMeta">
                        <h3 style={{fontSize: '0.9rem', marginBottom: '0.25rem'}}>{asset.fileName}</h3>
                        <p style={{fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem'}}>
                          {asset.contentType}
                        </p>
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
