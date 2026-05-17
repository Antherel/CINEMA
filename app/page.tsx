'use client';

import {useEffect, useMemo, useState} from 'react';

type ProjectItem = {
  displayName: string;
  slug: string;
  rootDir: string;
  resultsDir: string;
  referencePath: string;
  publicUrl: string;
};

type OutputItem = {
  id: string;
  label: string;
  prompt: string;
  fileName: string;
  filePath: string;
  publicUrl: string;
};

const DEFAULT_PROMPTS = [
  {id: 'a', label: 'Toma 1', prompt: ''},
  {id: 'b', label: 'Toma 2', prompt: ''},
  {id: 'c', label: 'Toma 3', prompt: ''},
];

function makeProjectName(seed: string) {
  const value = seed.trim();
  return value || 'proyecto-visual';
}

function toFileUrl(absPath: string) {
  return `file:///${absPath.replace(/\\/g, '/')}`;
}

export default function Page() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [projectName, setProjectName] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [generalPrompt, setGeneralPrompt] = useState('');
  const [prompts, setPrompts] = useState(DEFAULT_PROMPTS);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState('1K');
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [outputs, setOutputs] = useState<OutputItem[]>([]);
  const [projectInfo, setProjectInfo] = useState<ProjectItem | null>(null);

  const activeProject = useMemo(() => {
    return projects.find((project) => project.slug === selectedProject) ?? null;
  }, [projects, selectedProject]);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await fetch('/api/projects');
        if (!response.ok) {
          console.error('Failed to load projects:', response.status);
          return;
        }
        const data = (await response.json()) as {projects: ProjectItem[]};
        setProjects(data.projects);

        if (data.projects.length > 0) {
          setSelectedProject((current) => current || data.projects[0].slug);
        }
      } catch (error) {
        console.error('Error loading projects:', error);
      }
    };

    void loadProjects();
  }, []);

  useEffect(() => {
    if (!projectName && activeProject) {
      setProjectName(activeProject.displayName);
    }
  }, [activeProject, projectName]);

  const updatePrompt = (index: number, value: string) => {
    setPrompts((current) =>
      current.map((entry, promptIndex) =>
        promptIndex === index ? {...entry, prompt: value} : entry,
      ),
    );
  };

  const handleCreateProject = async () => {
    const nextProject = makeProjectName(projectName || selectedProject);
    if (!nextProject) {
      setError('Introduce un nombre de proyecto.');
      return;
    }

    setError('');
    setMessage('Creando proyecto...');
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({projectName: nextProject}),
      });

      const data = (await response.json()) as
        | {project: ProjectItem}
        | {error: string};

      if (!response.ok) {
        setMessage('');
        setError('error' in data ? data.error : 'No se pudo crear el proyecto.');
        return;
      }

    if (!('project' in data)) {
      setMessage('');
      setError('No se pudo crear el proyecto.');
      return;
    }

    const createdProject = data.project;
    setProjects((current) => {
      const withoutDuplicate = current.filter(
        (project) => project.slug !== createdProject.slug,
      );
      return [...withoutDuplicate, createdProject].sort((left, right) =>
        left.slug.localeCompare(right.slug),
      );
    });
    setSelectedProject(createdProject.slug);
    setProjectInfo(createdProject);
    setMessage(`Proyecto listo: ${createdProject.displayName}`);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError('');
    setMessage('Generando lote...');

    try {
      const formData = new FormData();
      const resolvedProjectName = makeProjectName(projectName || selectedProject);

      formData.append('projectName', resolvedProjectName);
      formData.append('generalPrompt', generalPrompt);
      formData.append('aspectRatio', aspectRatio);
      formData.append('imageSize', imageSize);
      formData.append('prompts', JSON.stringify(prompts));

      if (referenceFile) {
        formData.append('reference', referenceFile);
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        setOutputs([]);
        setMessage('');
        try {
          const data = (await response.json()) as {error?: string};
          setError(data.error || 'No se pudo generar el lote.');
        } catch {
          setError(`Error del servidor: ${response.status}`);
        }
        return;
      }

      const data = (await response.json()) as
        | {project: ProjectItem; outputs: OutputItem[]}
        | {error: string};

      if ('project' in data) {
        setProjectInfo(data.project);
        setSelectedProject(data.project.slug);
        setProjects((current) => {
          const withoutDuplicate = current.filter(
            (project) => project.slug !== data.project.slug,
          );
          return [...withoutDuplicate, data.project].sort((left, right) =>
            left.slug.localeCompare(right.slug),
          );
        });
        setOutputs(data.outputs);
        setMessage(`Generadas ${data.outputs.length} imagenes en ${data.project.displayName}.`);
      }
    } catch (generationError) {
      setOutputs([]);
      setError(
        generationError instanceof Error
          ? generationError.message
          : 'Error inesperado al generar.',
      );
      setMessage('');
    } finally {
      setIsGenerating(false);
    }
  };

  const openFolder = () => {
    const fallbackUrl = outputs[0]?.publicUrl;
    const targetProject = projectInfo ?? activeProject;
    if (!targetProject && !fallbackUrl) {
      return;
    }

    if (fallbackUrl) {
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (!targetProject) {
      return;
    }

    window.open(toFileUrl(targetProject.resultsDir), '_blank', 'noopener,noreferrer');
  };

  return (
    <main className="shell">
      <section className="hero">
        <div className="masthead">
          <p className="eyebrow">Next.js · Gemini · local browser workflow</p>
          <h1 className="title">Generador de lotes de imagenes, ahora en Next.js.</h1>
          <p className="lede">
            Una interfaz local para crear proyectos, subir una referencia, definir tres
            variantes y guardar cada salida en <strong>public/proyectos</strong> para
            verlas al instante en el navegador.
          </p>
        </div>

        <aside className="statusCard">
          <h2>Estado del proyecto</h2>
          <div className="statusRow">
            <div className="stat">
              <span>Proyecto activo</span>
              <strong>{projectInfo?.displayName || activeProject?.displayName || 'Sin seleccionar'}</strong>
            </div>
            <div className="stat">
              <span>Carpeta de salida</span>
              <strong>{projectInfo?.resultsDir || activeProject?.resultsDir || 'Se crea al generar'}</strong>
            </div>
            <div className="stat">
              <span>Imágenes listas</span>
              <strong>{outputs.length}</strong>
            </div>
          </div>
        </aside>
      </section>

      <section className="grid">
        <div className="panel">
          <div className="panelHeader">
            <div>
              <h2>Proyecto y prompts</h2>
              <p>Todo el renderizado ocurre en el servidor. La clave Gemini no llega al navegador.</p>
            </div>
            <div className="actions">
              <button type="button" className="button buttonSecondary" onClick={handleCreateProject}>
                Crear proyecto
              </button>
              <button type="button" className="button buttonSecondary" onClick={openFolder}>
                Abrir resultado
              </button>
            </div>
          </div>

          <div className="form">
            <div className="fieldRow">
              <div className="field">
                <label htmlFor="project-name">Nombre del proyecto</label>
                <input
                  id="project-name"
                  className="input"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  placeholder="campana-febrero"
                />
              </div>

              <div className="field">
                <label htmlFor="project-select">Proyectos existentes</label>
                <select
                  id="project-select"
                  className="select"
                  value={selectedProject}
                  onChange={(event) => setSelectedProject(event.target.value)}
                >
                  <option value="">Nuevo proyecto</option>
                  {projects.map((project) => (
                    <option key={project.slug} value={project.slug}>
                      {project.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="reference">Referencia</label>
                <input
                  id="reference"
                  className="input"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setReferenceFile(file);
                  }}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="general-prompt">Prompt general</label>
              <textarea
                id="general-prompt"
                className="textarea"
                value={generalPrompt}
                onChange={(event) => setGeneralPrompt(event.target.value)}
                placeholder="Describe el estilo, la luz, la camara y las restricciones comunes para todo el lote."
              />
            </div>

            <div className="fieldRow">
              <div className="field">
                <label htmlFor="aspect-ratio">Aspect ratio</label>
                <select
                  id="aspect-ratio"
                  className="select"
                  value={aspectRatio}
                  onChange={(event) => setAspectRatio(event.target.value)}
                >
                  {['1:1', '3:2', '4:5', '5:4', '9:16', '16:9'].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="image-size">Tamaño</label>
                <select
                  id="image-size"
                  className="select"
                  value={imageSize}
                  onChange={(event) => setImageSize(event.target.value)}
                >
                  {['1K', '2K', '4K'].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Salida</label>
                <div className="promptCard compact">Se generan 3 imagenes por lote.</div>
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
                      onChange={(event) => updatePrompt(index, event.target.value)}
                      placeholder={`Variacion visual ${index + 1} para el lote.`}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="actions">
              <button
                type="button"
                className="button"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? 'Generando...' : 'Generar lote'}
              </button>
              {message && <p className="message">{message}</p>}
              {error && <p className="message error">{error}</p>}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <div>
              <h2>Resumen local</h2>
              <p>El resultado queda disponible en el navegador y en disco.</p>
            </div>
          </div>

          <div className="statusRow">
            <div className="stat">
              <span>Proyecto</span>
              <strong>{projectInfo?.slug || activeProject?.slug || 'sin-slug'}</strong>
            </div>
            <div className="stat">
              <span>Referencia</span>
              <strong>{referenceFile?.name || projectInfo?.referencePath || 'ninguna'}</strong>
            </div>
            <div className="stat">
              <span>Estado</span>
              <strong>{isGenerating ? 'Trabajando' : 'En espera'}</strong>
            </div>
          </div>

          <div style={{marginTop: 16}} className="message">
            Si quieres repetir el lote, solo cambia los prompts o el proyecto y vuelve a generar.
          </div>
        </div>
      </section>

      {outputs.length > 0 && (
        <section className="gallery">
          <div className="panelHeader">
            <div>
              <h2>Resultados</h2>
              <p>Cada tarjeta enlaza al archivo guardado dentro de public/proyectos.</p>
            </div>
          </div>

          <div className="galleryGrid">
            {outputs.map((output) => (
              <article className="resultCard" key={output.id}>
                <div className="resultImageWrap">
                  <img src={output.publicUrl} alt={output.label} />
                </div>
                <div className="resultMeta">
                  <h3>{output.label}</h3>
                  <p>{output.prompt}</p>
                  <p style={{marginTop: 10}}>
                    <a href={output.publicUrl} target="_blank" rel="noreferrer">
                      Abrir imagen
                    </a>
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}