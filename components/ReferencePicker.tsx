'use client';

import React from 'react';
import type {Reference} from './ReferenceManager';

type ReferencePickerProps = {
  references: Reference[];
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  label?: string;
};

/**
 * Component to select which references to use for a specific image/toma
 * Displays checkboxes for each available reference
 */
export default function ReferencePicker({
  references,
  selectedIds,
  onSelectionChange,
  label = 'Usar referencias',
}: ReferencePickerProps) {
  const handleToggle = (id: string) => {
    const newSelected = selectedIds.includes(id)
      ? selectedIds.filter((s) => s !== id)
      : [...selectedIds, id];
    onSelectionChange(newSelected);
  };

  if (references.length === 0) {
    return (
      <div style={{fontSize: '0.875rem', color: '#999', padding: '0.5rem', fontStyle: 'italic'}}>
        Sin referencias disponibles
      </div>
    );
  }

  return (
    <div style={{fontSize: '0.875rem'}}>
      <label style={{display: 'block', fontWeight: 'bold', marginBottom: '0.5rem'}}>
        {label}
      </label>
      <div style={{display: 'flex', flexDirection: 'column', gap: '0.25rem'}}>
        {references.map((ref) => (
          <label key={ref.id} style={{display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer'}}>
            <input
              type="checkbox"
              checked={selectedIds.includes(ref.id)}
              onChange={() => handleToggle(ref.id)}
            />
            <span>{ref.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
