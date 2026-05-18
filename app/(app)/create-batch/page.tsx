'use client';

import React, {useEffect, useState} from 'react';
import {useAuth} from '@/app/lib/AuthProvider';
import ReferenceManager, {type Reference} from '@/components/ReferenceManager';
import ReferencePicker from '@/components/ReferencePicker';

const MIN_BATCH_IMAGES = 1;
const MAX_BATCH_IMAGES = 10;

function createPromptEntries(
  count: number,
  previous: Array<{id: string; label: string; prompt: string}> = [],
) {
  return Array.from({length: count}, (_, index) => {
    const id = String.fromCharCode(97 + index);
    const existing = previous.find((entry) => entry.id === id);
    return {
      id,
      label: count === 1 ? 'Imagen' : `Toma ${index + 1}`,
      prompt: existing?.prompt ?? '',
    };
  });
}

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

type ProjectItem = {
  displayName: string;
  slug: string;
};

/**
 * Batch image generation page (3 images)
 * Supports multiple references with per-image selection
 */
export default function CreateBatchPage() {
  const {getIdToken} = useAuth();
  const [projectName, setProjectName] = useState('');
  const [selectedProjectSlug, setSelectedProjectSlug] = useState('');
  const [existingProjects, setExistingProjects] = useState<ProjectItem[]>([]);
  const [imageCount, setImageCount] = useState(3);
  const [prompts, setPrompts] = useState(() => createPromptEntries(3));
  const [references, setReferences] = useState<Reference[]>([]);
  const [selectedReferencesPerImage, setSelectedReferencesPerImage] = useState<Record<string, string[]>>(() => ({
    a: [],
    b: [],
    c: [],
  }));
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [pricing, setPricing] = useState<PricingSummary | null>(null);

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
      return;
    }

    const selectedProject = existingProjects.find((project) => project.slug === slug);
    if (selectedProject) {
      setProjectName(selectedProject.displayName);
    }
  };

  const handleUpdatePrompt = (index: number, value: string) => {
    const updated = [...prompts];
    updated[index].prompt = value;
    setPrompts(updated);
  };

  const handleAddReference = (ref: Reference) => {
    setReferences([...references, ref]);
  };

  const handleRemoveReference = (id: string) => {
    setReferences(references.filter((r) => r.id !== id));
    // Remove from all image selections
    setSelectedReferencesPerImage((prev) => {
      const updated = {...prev};
      Object.keys(updated).forEach((key) => {
        updated[key] = updated[key].filter((refId) => refId !== id);
      });
      return updated;
    });
  };

  const handleUpdateReferenceName = (id: string, name: string) => {
    setReferences(references.map((r) => (r.id === id ? {...r, name} : r)));
  };

  const handleUpdateReferenceDescription = (id: string, description: string) => {
    setReferences(references.map((r) => (r.id === id ? {...r, description} : r)));
  };

  const handleRefSelectionChange = (promptId: string, selectedIds: string[]) => {
    setSelectedReferencesPerImage((prev) => ({
      ...prev,
      [promptId]: selectedIds,
    }));
  };

  const handleImageCountChange = (nextCountRaw: number) => {
    const nextCount = Math.max(MIN_BATCH_IMAGES, Math.min(MAX_BATCH_IMAGES, nextCountRaw));
    setImageCount(nextCount);
    setPrompts((currentPrompts) => createPromptEntries(nextCount, currentPrompts));
    setSelectedReferencesPerImage((currentMap) => {
      const updatedMap: Record<string, string[]> = {};
      for (let index = 0; index < nextCount; index += 1) {
        const id = String.fromCharCode(97 + index);
        updatedMap[id] = currentMap[id] ?? [];
      }
      return updatedMap;
    });
  };

  const handleGenerate = async () => {
    if (!projectName.trim()) {
      setError('Por favor ingresa un nombre de proyecto.');
      return;
    }

    setIsGenerating(true);
    setError('');
    setMessage('Generando lote...');
    setGeneratedImages([]);
    setPricing(null);

    try {
      const formData = new FormData();
      formData.append('projectName', projectName.trim());
      formData.append('imageCount', String(imageCount));
      formData.append('prompts', JSON.stringify(prompts));

      // Add all references to formData
      references.forEach((ref) => {
        formData.append(`reference_${ref.id}`, ref.file);
        formData.append(`referenceName_${ref.id}`, ref.name);
        formData.append(`referenceDescription_${ref.id}`, ref.description ?? '');
      });

      // Add reference selection mapping
      formData.append('imageReferences', JSON.stringify(selectedReferencesPerImage));

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
        setError(data.error || 'Error al generar el lote.');
        return;
      }

      const data = (await response.json()) as any;
      if (data.outputs && Array.isArray(data.outputs)) {
        setGeneratedImages(data.outputs);
        setPricing(data.pricing ?? null);
        const totalCost = typeof data?.pricing?.estimatedTotalCostUsd === 'number'
          ? ` Coste estimado: $${data.pricing.estimatedTotalCostUsd.toFixed(4)}.`
          : '';
        setMessage(`Lote generado correctamente: ${data.outputs.length} imágenes en ${data.project.displayName}.${totalCost}`);
      } else {
        setError('No se generaron imágenes.');
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
              <h2>Crear lote de imágenes</h2>
              <p>Genera varias imágenes con prompts diferentes. Puedes usar referencias para guiar cada toma.</p>
            </div>
          </div>

          <div className="form">
            <div className="fieldRow">
              <div className="field">
                <label htmlFor="image-count">Cantidad de imágenes</label>
                <select
                  id="image-count"
                  className="select"
                  value={imageCount}
                  onChange={(e) => handleImageCountChange(Number(e.target.value))}
                >
                  {Array.from({length: MAX_BATCH_IMAGES}, (_, index) => index + 1).map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </div>

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
            </div>
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

        {/* Prompts with reference selection */}
        <div className="panel">
          <div className="panelHeader">
            <div>
              <h2>Prompts y referencias</h2>
              <p>Define los prompts para cada toma y selecciona qué referencias usar.</p>
            </div>
          </div>

          <div className="promptGrid">
            {prompts.map((promptEntry, index) => (
              <div className="promptCard" key={promptEntry.id}>
                <div className="field">
                  <label htmlFor={`prompt-${promptEntry.id}`}>{promptEntry.label}</label>
                  <textarea
                    id={`prompt-${promptEntry.id}`}
                    className="textarea"
                    value={promptEntry.prompt}
                    onChange={(e) => handleUpdatePrompt(index, e.target.value)}
                    placeholder={`Variación visual ${index + 1} para el lote.`}
                  />
                </div>

                <div className="referencePickerWrap">
                  <ReferencePicker
                    references={references}
                    selectedIds={selectedReferencesPerImage[promptEntry.id] ?? []}
                    onSelectionChange={(ids) => handleRefSelectionChange(promptEntry.id, ids)}
                    label={`Referencias para ${promptEntry.label}`}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="actions actionsCompactTop">
            <button
              type="button"
              className="button"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? 'Generando...' : 'Generar lote'}
            </button>
          </div>

          {message && <p className="message">{message}</p>}
          {error && <p className="message error">{error}</p>}
          {pricing && (
            <p className="message">
              Coste estimado por imagen: ${pricing.estimatedCostPerImageUsd.toFixed(4)} {pricing.currency}. Total estimado: ${pricing.estimatedTotalCostUsd.toFixed(4)} {pricing.currency}.
            </p>
          )}
        </div>

        {/* Generated Images */}
        {generatedImages.length > 0 && (
          <div className="panel generatedPanelTop">
            <div className="panelHeader">
              <h2>Imágenes generadas</h2>
            </div>
            <div className="promptGrid">
              {generatedImages.map((image) => (
                <div className="promptCard generatedPromptCard" key={image.id}>
                  <img
                    src={image.publicUrl}
                    alt={image.label}
                    className="generatedImage"
                  />
                  <p><strong>{image.label}</strong></p>
                  <p className="generatedPromptText">{image.prompt}</p>
                  {typeof image.estimatedCostUsd === 'number' && (
                    <p className="generatedPromptText">
                      Coste estimado: ${image.estimatedCostUsd.toFixed(4)} USD
                    </p>
                  )}
                  {Array.isArray(image.usedReferences) && image.usedReferences.length > 0 && (
                    <p className="generatedPromptText">
                      Referencias usadas: {image.usedReferences.join(', ')}
                    </p>
                  )}
                  <a
                    href={image.publicUrl}
                    download
                    className="button buttonSecondary buttonSmall blockButton"
                  >
                    Descargar
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
