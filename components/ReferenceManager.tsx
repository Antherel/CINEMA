'use client';

import React, {useState} from 'react';

export type Reference = {
  id: string;
  name: string;
  file: File;
  description?: string;
};

type ReferenceManagerProps = {
  references: Reference[];
  onAdd: (reference: Reference) => void;
  onRemove: (id: string) => void;
  onUpdateName: (id: string, name: string) => void;
  onUpdateDescription: (id: string, description: string) => void;
};

/**
 * Component to manage multiple reference images
 * Allows uploading, naming, and describing reference images
 */
export default function ReferenceManager({
  references,
  onAdd,
  onRemove,
  onUpdateName,
  onUpdateDescription,
}: ReferenceManagerProps) {
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');

  const handleFileAdd = (file: File) => {
    const id = `ref-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const name = nameInput.trim() || file.name.split('.')[0] || `Referencia ${references.length + 1}`;
    
    onAdd({
      id,
      name,
      file,
      description: descInput.trim() || undefined,
    });
    
    setNameInput('');
    setDescInput('');
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileAdd(file);
    }
    // Reset input
    event.target.value = '';
  };

  return (
    <div className="panel referencePanel">
      <div className="panelHeader">
        <div>
          <h3>Gestor de referencias</h3>
          <p>Sube imágenes de referencia para guiar la generación. Puedes seleccionar cuál usar por cada imagen.</p>
        </div>
      </div>

      <div className="form">
        {/* Add new reference */}
        <div className="referenceCreateCard">
          <h4 className="referenceCreateTitle">Añadir nueva referencia</h4>
          
          <div className="fieldRow">
            <div className="field">
              <label htmlFor="ref-name">Nombre de la referencia</label>
              <input
                id="ref-name"
                className="input"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="ej: Estilo moderno"
              />
            </div>

            <div className="field">
              <label htmlFor="ref-file">Seleccionar imagen</label>
              <input
                id="ref-file"
                className="input"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="ref-desc">Descripción (opcional)</label>
            <input
              id="ref-desc"
              className="input"
              value={descInput}
              onChange={(e) => setDescInput(e.target.value)}
              placeholder="ej: Colores pastel, iluminación suave"
            />
          </div>
        </div>

        {/* List of added references */}
        {references.length > 0 && (
          <div>
            <h4 className="referenceListTitle">Referencias añadidas ({references.length})</h4>
            <div className="referenceGrid">
              {references.map((ref) => (
                <div key={ref.id} className="referenceCard">
                  <button
                    type="button"
                    onClick={() => onRemove(ref.id)}
                    className="referenceDelete"
                    title="Eliminar"
                  >
                    ✕
                  </button>

                  <div className="referenceMeta">
                    <strong className="referenceName">
                      {ref.name}
                    </strong>
                    {ref.description && (
                      <p className="referenceDescription">
                        {ref.description}
                      </p>
                    )}
                    <p className="referenceFileName">
                      {ref.file.name}
                    </p>
                  </div>

                  <div className="referenceEditRow">
                    <input
                      type="text"
                      value={ref.name}
                      onChange={(e) => onUpdateName(ref.id, e.target.value)}
                      aria-label={`Editar nombre de referencia ${ref.name}`}
                      className="referenceNameInput"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {references.length === 0 && (
          <p className="referenceEmpty">
            No hay referencias añadidas. Sube una imagen para empezar.
          </p>
        )}
      </div>
    </div>
  );
}
