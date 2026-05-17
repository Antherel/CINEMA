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
    <div className="panel" style={{marginBottom: '1rem'}}>
      <div className="panelHeader">
        <div>
          <h3>Gestor de referencias</h3>
          <p>Sube imágenes de referencia para guiar la generación. Puedes seleccionar cuál usar por cada imagen.</p>
        </div>
      </div>

      <div className="form">
        {/* Add new reference */}
        <div style={{padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '4px', marginBottom: '1rem'}}>
          <h4 style={{marginTop: 0}}>Añadir nueva referencia</h4>
          
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
            <h4>Referencias añadidas ({references.length})</h4>
            <div style={{display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))'}}>
              {references.map((ref) => (
                <div
                  key={ref.id}
                  style={{
                    padding: '1rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    backgroundColor: '#fff',
                    position: 'relative',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onRemove(ref.id)}
                    style={{
                      position: 'absolute',
                      top: '0.5rem',
                      right: '0.5rem',
                      background: '#ff4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      width: '24px',
                      height: '24px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: 0,
                    }}
                    title="Eliminar"
                  >
                    ✕
                  </button>

                  <div style={{marginBottom: '0.5rem'}}>
                    <strong style={{fontSize: '0.9rem', display: 'block', marginBottom: '0.25rem'}}>
                      {ref.name}
                    </strong>
                    {ref.description && (
                      <p style={{fontSize: '0.75rem', color: '#666', margin: 0, marginBottom: '0.25rem'}}>
                        {ref.description}
                      </p>
                    )}
                    <p style={{fontSize: '0.75rem', color: '#999', margin: 0}}>
                      {ref.file.name}
                    </p>
                  </div>

                  <div style={{display: 'flex', gap: '0.25rem'}}>
                    <input
                      type="text"
                      value={ref.name}
                      onChange={(e) => onUpdateName(ref.id, e.target.value)}
                      style={{
                        flex: 1,
                        padding: '0.25rem',
                        fontSize: '0.75rem',
                        border: '1px solid #ddd',
                        borderRadius: '2px',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {references.length === 0 && (
          <p style={{color: '#999', fontStyle: 'italic', marginBottom: 0}}>
            No hay referencias añadidas. Sube una imagen para empezar.
          </p>
        )}
      </div>
    </div>
  );
}
