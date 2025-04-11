// src/components/RenameSeatsModal.tsx

import React, { useState } from 'react';
import { updateSeat } from '../services/api'; // We'll add this in api.ts
import { X } from 'lucide-react';

interface DBSeat {
  id?: number;
  label?: string;
  position_x: number;
  position_y: number;
  capacity: number;
}

interface RenameSeatsModalProps {
  sectionName: string;
  seats: DBSeat[];
  onClose: () => void;
  /** 
   * onSave is called after we've attempted to rename seats. 
   * You can pass back any updated seat array or do a parent refresh.
   */
  onSave: (updatedSeats: DBSeat[]) => void;
}

export default function RenameSeatsModal({
  sectionName,
  seats,
  onClose,
  onSave,
}: RenameSeatsModalProps) {
  // We'll copy seat labels into local state so we can edit them.
  const [localSeats, setLocalSeats] = useState<DBSeat[]>(
    seats.map(seat => ({
      ...seat,
      label: seat.label || '', // default to empty string if none
    }))
  );
  const [isSaving, setIsSaving] = useState(false);

  function handleLabelChange(index: number, newLabel: string) {
    setLocalSeats(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        label: newLabel,
      };
      return updated;
    });
  }

  async function handleSave() {
    setIsSaving(true);

    const updatedArray = [...localSeats];

    // We'll attempt to PATCH each seat that has an ID. 
    // If seat.id is undefined, it means it's not persisted, 
    // so we only update local state in the parent.
    for (let i = 0; i < updatedArray.length; i++) {
      const seat = updatedArray[i];
      if (!seat.id) {
        // Not in DB yet, skip API call.
        continue;
      }
      try {
        const resp = await updateSeat(seat.id, { label: seat.label || '' });
        // Merge any returned changes
        updatedArray[i] = resp;
      } catch (err) {
        console.error(`Failed to update seat ID=${seat.id}`, err);
      }
    }

    setIsSaving(false);
    onSave(updatedArray);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded p-6 w-[420px] relative">
        {/* Close button */}
        <button
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-semibold mb-4">
          Rename Seats ({sectionName})
        </h3>

        <div className="max-h-80 overflow-y-auto space-y-2">
          {localSeats.map((seat, idx) => (
            <div key={idx} className="flex items-center space-x-2">
              <label className="text-sm text-gray-600 w-24">
                Seat #{idx + 1}:
              </label>
              <input
                type="text"
                className="border border-gray-300 rounded px-2 py-1 w-full"
                value={seat.label}
                onChange={e => handleLabelChange(idx, e.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
