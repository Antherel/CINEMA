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
      <div className="referencePickerEmpty">
        Sin referencias disponibles
      </div>
    );
  }

  return (
    <div className="referencePicker">
      <label className="referencePickerLabel">
        {label}
      </label>
      <div className="referencePickerList">
        {references.map((ref) => (
          <label key={ref.id} className="referencePickerItem">
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
