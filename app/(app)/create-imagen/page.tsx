'use client';

import React, {useEffect, useState} from 'react';
import {useAuth} from '@/app/lib/AuthProvider';
import ReferenceManager, {type Reference} from '@/components/ReferenceManager';
import ReferencePicker from '@/components/ReferencePicker';

type ProjectItem = {
  displayName: string;
  slug: string;
};

type GeneratedImage = {
  id: string;
  label: string;
  prompt: string;
  usedReferences?: string[];
  estimatedCostUsd?: number;
  publicUrl: string;
  fileName: string;
};

type PricingSummary = {
  currency: string;
  estimatedCostPerImageUsd: number;
  estimatedTotalCostUsd: number;
  note?: string;
};

/**
 * Single image generation page
 * Users can create 1 image with 1 prompt and multiple references
 */
export default function CreateImagePage() {
  const {getIdToken} = useAuth();
  const [projectName, setProjectName] = useState('');
  const [selectedProjectSlug, setSelectedProjectSlug] = useState('');
  const [existingProjects, setExistingProjects] = useState<ProjectItem[]>([]);
  const [prompt, setPrompt] = useState('');
  const [references, setReferences] = useState<Reference[]>([]);
  const [selectedReferences, setSelectedReferences] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
  const [pricing, setPricing] = useState<PricingSummary | null>(null);
  const [generalPrompt, setGeneralPrompt] = useState('');
  const [whiteBackground, setWhiteBackground] = useState(false);
  const [realistic, setRealistic] = useState(false);
  const [promptPreview, setPromptPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadProjects = async () => {
      try {
        const token = await getIdToken();
        const response = await fetch('/api/projects', {
          headers: {'Authorization': `Bearer ${token}`},
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {projects?: ProjectItem[]};
        if (!cancelled) {
          setExistingProjects(data.projects ?? []);
        }
      } catch {
        // Ignore project-load errors to avoid blocking generation flow.
      }
    };

    loadProjects();

    return () => {
      cancelled = true;
    };
  }, [getIdToken]);

  const handleProjectSelection = (slug: string) => {
    setSelectedProjectSlug(slug);
    if (!slug) {
      setReferences([]);
      setSelectedReferences([]);
      return;
    }

    const selectedProject = existingProjects.find((project) => project.slug === slug);
    if (selectedProject) {
      setProjectName(selectedProject.displayName);
    }

    const loadRefs = async () => {
      try {
        const token = await getIdToken();
        const response = await fetch(`/api/projects/${encodeURIComponent(slug)}/references`, {
          headers: {'Authorization': `Bearer ${token}`},
        });
        if (!response.ok) return;
        const data = (await response.json()) as {references?: Array<{id: string; name: string; description?: string; fileName: string; contentType: string; downloadUrl: string}>};
        const loaded = (data.references ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          remoteUrl: r.downloadUrl,
        }));
        setReferences(loaded);
        setSelectedReferences(loaded.map((ref) => ref.id));
      } catch {
        // Ignore
      }
    };
    loadRefs();
  };

  const handleAddReference = (ref: Reference) => {
    setReferences([...references, ref]);
  };

  const handleRemoveReference = (id: string) => {
    setReferences(references.filter((r) => r.id !== id));
    setSelectedReferences(selectedReferences.filter((s) => s !== id));
  };

  const handleUpdateReferenceName = (id: string, name: string) => {
    setReferences(references.map((r) => (r.id === id ? {...r, name} : r)));
  };

  const handleUpdateReferenceDescription = (id: string, description: string) => {
    setReferences(references.map((r) => (r.id === id ? {...r, description} : r)));
  };

  const handleShowPreview = () => {
    if (!projectName.trim()) {
      setError('Por favor ingresa un nombre de proyecto.');
      return;
    }
    const modifiers: string[] = [];
    if (whiteBackground) modifiers.push('Fondo blanco puro, sin sombras ni gradientes.');
    if (realistic) modifiers.push('Estilo fotorrealista, máximo detalle y realismo.');
    const segments = [generalPrompt.trim(), ...modifiers, prompt.trim()].filter(Boolean);
    const base = segments.length > 0 ? segments.join('\n\n') : 'Crea una variacion visual coherente para Imagen.';
    const selectedRefs = selectedReferences.map((id) => references.find((r) => r.id === id)).filter(Boolean) as typeof references;
    let preview = base;
    if (selectedRefs.length > 0) {
      const refLines = selectedRefs.map((r, i) => r.description?.trim() ? `${i + 1}. ${r.name}: ${r.description}` : `${i + 1}. ${r.name}`).join('\n');
      const refSection = `Usa las imagenes de referencia adjuntas como guia visual obligatoria.\nMantén coherencia de estilo, iluminacion, materialidad y composicion con estas referencias:\n${refLines}`;
      preview = `${refSection}\n\nPrompt principal:\n${base}`;
    }
    setPromptPreview(preview);
    setError('');
  };

  const handleGenerate = async () => {
    if (!projectName.trim()) {
      setError('Por favor ingresa un nombre de proyecto.');
      return;
    }

    if (!prompt.trim()) {
      setError('Por favor ingresa un prompt.');
      return;
    }

    setIsGenerating(true);
    setError('');
    setMessage('Generando imagen...');
    setGeneratedImage(null);
    setPricing(null);
    setPromptPreview(null);

    try {
      const formData = new FormData();
      formData.append('projectName', projectName.trim());
      formData.append('imageCount', '1');
      formData.append('prompts', JSON.stringify([
        {id: 'a', label: 'Imagen', prompt: prompt.trim()},
      ]));
      formData.append('generalPrompt', generalPrompt.trim());
      if (whiteBackground) formData.append('whiteBackground', '1');
      if (realistic) formData.append('realistic', '1');

      // Add all references to formData
      references.forEach((ref) => {
        formData.append(`referenceName_${ref.id}`, ref.name);
        formData.append(`referenceDescription_${ref.id}`, ref.description ?? '');
        if (ref.file) {
          formData.append(`reference_${ref.id}`, ref.file);
        } else if (ref.remoteUrl) {
          formData.append(`referenceUrl_${ref.id}`, ref.remoteUrl);
        }
      });

      // Add reference selection mapping for this single image
      formData.append('imageReferences', JSON.stringify({a: selectedReferences}));

      const token = await getIdToken();
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        setMessage('');
        const data = (await response.json().catch(() => ({}))) as any;
        setError(data.error || 'Error al generar la imagen.');
        return;
      }

      const data = (await response.json()) as any;
      if (data.outputs && data.outputs.length > 0) {
        setGeneratedImage(data.outputs[0]);
        setPricing(data.pricing ?? null);
        const imageCost = typeof data?.pricing?.estimatedCostPerImageUsd === 'number'
          ? ` Coste estimado: $${data.pricing.estimatedCostPerImageUsd.toFixed(4)}.`
          : '';
        setMessage(`Imagen generada correctamente en ${data.project.displayName}.${imageCost}`);
        setPrompt('');
      } else {
        setError('No se generó ninguna imagen.');
        setMessage('');
      }
    } catch (err) {
      setMessage('');
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="shell">
      <section className="grid">
        <div className="panel">
          <div className="panelHeader">
            <div>
              <h2>Crear una imagen</h2>
              <p>Genera una sola imagen con un prompt personalizado y referencias opcionales.</p>
            </div>
          </div>

          <div className="form">
            {existingProjects.length > 0 && (
              <div className="field">
                <label htmlFor="existing-project">Abrir proyecto existente</label>
                <select
                  id="existing-project"
                  className="select"
                  value={selectedProjectSlug}
                  onChange={(e) => handleProjectSelection(e.target.value)}
                >
                  <option value="">Crear o escribir uno nuevo</option>
                  {existingProjects.map((project) => (
                    <option key={project.slug} value={project.slug}>
                      {project.displayName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="field">
              <label htmlFor="project-name">Nombre del proyecto</label>
              <input
                id="project-name"
                className="input"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="mi-proyecto"
              />
            </div>

            <div className="field">
              <label htmlFor="prompt">Prompt</label>
              <textarea
                id="prompt"
                className="textarea"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe la imagen que deseas generar..."
              />
            </div>

            <div className="field">
              <label htmlFor="general-prompt-img">Prompt genérico (opcional)</label>
              <textarea
                id="general-prompt-img"
                className="textarea"
                value={generalPrompt}
                onChange={(e) => setGeneralPrompt(e.target.value)}
                placeholder="Estilo, paleta de color, contexto general..."
              />
            </div>

            <div className="fieldRow">
              <label className="checkboxLabel">
                <input
                  type="checkbox"
                  checked={whiteBackground}
                  onChange={(e) => setWhiteBackground(e.target.checked)}
                />
                Fondo Blanco
              </label>
              <label className="checkboxLabel">
                <input
                  type="checkbox"
                  checked={realistic}
                  onChange={(e) => setRealistic(e.target.checked)}
                />
                Realista
              </label>
            </div>

            <div className="actions">
              <button
                type="button"
                className="button"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? 'Generando...' : 'Generar imagen'}
              </button>
              <button
                type="button"
                className="button buttonSecondary"
                onClick={handleShowPreview}
                disabled={isGenerating}
              >
                Ver Prompt
              </button>
            </div>

            {promptPreview && (
              <div className="promptPreviewBox">
                <div className="promptPreviewHeader">
                  <strong>Vista previa del prompt</strong>
                  <button type="button" className="button buttonSecondary buttonSmall" onClick={() => setPromptPreview(null)}>Cerrar</button>
                </div>
                <pre className="promptPreviewItem">{promptPreview}</pre>
              </div>
            )}

            {message && <p className="message">{message}</p>}
            {error && <p className="message error">{error}</p>}
            {pricing && (
              <p className="message">
                Coste estimado: ${pricing.estimatedCostPerImageUsd.toFixed(4)} {pricing.currency} por imagen.
              </p>
            )}
          </div>
        </div>

        {/* Reference Manager */}
        <ReferenceManager
          references={references}
          onAdd={handleAddReference}
          onRemove={handleRemoveReference}
          onUpdateName={handleUpdateReferenceName}
          onUpdateDescription={handleUpdateReferenceDescription}
        />

        {/* Reference Picker */}
        {references.length > 0 && (
          <div className="panel">
            <div className="panelHeader">
              <h2>Seleccionar referencias</h2>
            </div>
            <div className="form">
              <ReferencePicker
                references={references}
                selectedIds={selectedReferences}
                onSelectionChange={setSelectedReferences}
                label="Usar referencias para esta imagen"
              />
            </div>
          </div>
        )}

        {/* Generated Image */}
        {generatedImage && (
          <div className="singleGeneratedPanel">
            <h3>Imagen generada</h3>
            <img
              src={generatedImage.publicUrl}
              alt={generatedImage.label}
              className="singleGeneratedImage"
            />
            <p><strong>Prompt:</strong> {generatedImage.prompt}</p>
            {typeof generatedImage.estimatedCostUsd === 'number' && (
              <p><strong>Coste estimado:</strong> ${generatedImage.estimatedCostUsd.toFixed(4)} USD</p>
            )}
            {Array.isArray(generatedImage.usedReferences) && generatedImage.usedReferences.length > 0 && (
              <p><strong>Referencias usadas:</strong> {generatedImage.usedReferences.join(', ')}</p>
            )}
            <a
              href={generatedImage.publicUrl}
              download
              className="button buttonSecondary singleGeneratedDownload"
            >
              Descargar
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
