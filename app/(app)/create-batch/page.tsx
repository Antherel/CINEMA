'use client';

import React, {useState} from 'react';
import {useAuth} from '@/app/lib/AuthProvider';
import ReferenceManager, {type Reference} from '@/components/ReferenceManager';
import ReferencePicker from '@/components/ReferencePicker';

type GeneratedImage = {
  id: string;
  label: string;
  prompt: string;
  publicUrl: string;
  fileName: string;
};

/**
 * Batch image generation page (3 images)
 * Supports multiple references with per-image selection
 */
export default function CreateBatchPage() {
  const {getIdToken} = useAuth();
  const [projectName, setProjectName] = useState('');
  const [prompts, setPrompts] = useState([
    {id: 'a', label: 'Toma 1', prompt: ''},
    {id: 'b', label: 'Toma 2', prompt: ''},
    {id: 'c', label: 'Toma 3', prompt: ''},
  ]);
  const [references, setReferences] = useState<Reference[]>([]);
  const [selectedReferencesPerImage, setSelectedReferencesPerImage] = useState<Record<string, string[]>>({
    a: [],
    b: [],
    c: [],
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);

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

  const handleGenerate = async () => {
    if (!projectName.trim()) {
      setError('Por favor ingresa un nombre de proyecto.');
      return;
    }

    setIsGenerating(true);
    setError('');
    setMessage('Generando lote...');
    setGeneratedImages([]);

    try {
      const formData = new FormData();
      formData.append('projectName', projectName.trim());
      formData.append('imageCount', '3');
      formData.append('prompts', JSON.stringify(prompts));

      // Add all references to formData
      references.forEach((ref) => {
        formData.append(`reference_${ref.id}`, ref.file);
        formData.append(`referenceName_${ref.id}`, ref.name);
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
        setMessage(`Lote generado correctamente: ${data.outputs.length} imágenes en ${data.project.displayName}.`);
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
              <p>Genera 3 imágenes con prompts diferentes. Puedes usar referencias para guiar la generación.</p>
            </div>
          </div>

          <div className="form">
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

                <div style={{marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#f9f9f9', borderRadius: '3px'}}>
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

          <div className="actions" style={{marginTop: '1rem'}}>
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
        </div>

        {/* Generated Images */}
        {generatedImages.length > 0 && (
          <div className="panel" style={{marginTop: '2rem'}}>
            <div className="panelHeader">
              <h2>Imágenes generadas</h2>
            </div>
            <div className="promptGrid">
              {generatedImages.map((image) => (
                <div className="promptCard" key={image.id} style={{padding: '1rem'}}>
                  <img
                    src={image.publicUrl}
                    alt={image.label}
                    style={{width: '100%', height: 'auto', borderRadius: '4px', marginBottom: '0.5rem'}}
                  />
                  <p><strong>{image.label}</strong></p>
                  <p style={{fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem'}}>{image.prompt}</p>
                  <a
                    href={image.publicUrl}
                    download
                    className="button buttonSecondary buttonSmall"
                    style={{display: 'inline-block', width: '100%', textAlign: 'center'}}
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
