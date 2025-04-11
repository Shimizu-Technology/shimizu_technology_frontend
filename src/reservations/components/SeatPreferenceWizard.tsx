// src/components/SeatPreferenceWizard.tsx
import React, { useEffect, useState } from 'react';
import { fetchSeatAllocations } from '../services/api';
import { X } from 'lucide-react';

// Example seat interface
interface DBSeat {
  id: number;
  label: string;
  // Possibly other fields like position_x, position_y, etc.
}

interface SeatAllocation {
  seat_id: number;
  occupant_status: string; // "reserved", "occupied", etc.
}

interface Props {
  date: string;
  time: string;
  partySize: number;
  initialPreferences: string[][];
  onClose: () => void;
  onSave: (prefs: string[][]) => void;
}

/**
 * A mini wizard that shows seats for the chosen date/time, color-coded by status,
 * and lets staff pick 1–3 preference sets.
 */
export default function SeatPreferenceWizard({
  date,
  time,
  partySize,
  initialPreferences,
  onClose,
  onSave,
}: Props) {
  // We'll store 3 sets of chosen seat labels here
  const [prefs, setPrefs] = useState<string[][]>(initialPreferences);

  // Example: we fetch seat allocations for the entire day, then we filter for the timeslot
  // or you have a custom endpoint that returns occupant seat data for just that timeslot.
  const [seatAllocs, setSeatAllocs] = useState<SeatAllocation[]>([]);
  const [allSeats, setAllSeats] = useState<DBSeat[]>([]); // You might fetch from /seats

  // Which preference index we are editing (0,1,2)
  const [activePrefIndex, setActivePrefIndex] = useState(0);

  useEffect(() => {
    // Example: fetch occupant data. We'll ignore actual seat objects for brevity.
    async function loadSeatData() {
      try {
        const data = await fetchSeatAllocations({ date });
        setSeatAllocs(data); // might be a large array

        // You might also fetch all seats if you haven't already
        // setAllSeats( ...
      } catch (err) {
        console.error('Wizard seat fetch error:', err);
      }
    }
    loadSeatData();
  }, [date]);

  // For simplicity, let's assume allSeats is known or you can put a placeholder array
  useEffect(() => {
    // Fake example seats:
    setAllSeats([
      { id: 1, label: "A1" },
      { id: 2, label: "A2" },
      { id: 3, label: "B1" },
      { id: 4, label: "B2" },
      // ...
    ]);
  }, []);

  // We'll define a helper to see if seat is free vs. reserved/occupied
  function getSeatStatus(seatId: number): "free" | "reserved" | "occupied" {
    // For the chosen time, check if seatAllocs has occupantStatus
    // This is a placeholder. You might need real overlap logic.
    // We'll just see if occupant_status includes "seated" => occupied, or "reserved" => reserved
    // In real code, you'd also check if start_time/end_time overlap.
    const alloc = seatAllocs.find(a => a.seat_id === seatId);
    if (!alloc) return "free";
    if (alloc.occupant_status === "seated" || alloc.occupant_status === "occupied") {
      return "occupied";
    } else if (alloc.occupant_status === "reserved") {
      return "reserved";
    }
    return "free";
  }

  // Check if the seat is currently chosen in the active preference
  function isSeatChosen(seatLabel: string) {
    const current = prefs[activePrefIndex] || [];
    return current.includes(seatLabel);
  }

  // Toggle seat in the active preference
  function handleSeatClick(seatLabel: string) {
    const seatStatus = getSeatStatusByLabel(seatLabel);
    if (seatStatus !== "free") {
      alert(`Seat ${seatLabel} is not available at that time.`);
      return;
    }

    setPrefs(prev => {
      const clone = [...prev];
      // ensure we have an array for activePrefIndex
      if (!clone[activePrefIndex]) {
        clone[activePrefIndex] = [];
      }
      const arr = clone[activePrefIndex];
      if (arr.includes(seatLabel)) {
        // remove it
        clone[activePrefIndex] = arr.filter(s => s !== seatLabel);
      } else {
        // add it
        clone[activePrefIndex] = [...arr, seatLabel];
      }
      return clone;
    });
  }

  function getSeatStatusByLabel(label: string) {
    const seat = allSeats.find(s => s.label === label);
    if (!seat) return "free"; // fallback
    return getSeatStatus(seat.id);
  }

  // For color-coding
  function getSeatColor(label: string) {
    const status = getSeatStatusByLabel(label);
    if (status === "occupied") return "bg-red-500";
    if (status === "reserved") return "bg-yellow-400";
    return "bg-green-500"; // free
  }

  // Save => pass the `prefs` array up
  function handleSave() {
    // Filter out empty arrays if you want
    const final = prefs.filter(arr => arr && arr.length > 0);
    onSave(final);
  }

  // Provide a way to switch between preference #1, #2, #3
  function handlePrefSwitch(idx: number) {
    setActivePrefIndex(idx);
    // ensure we have an array at that index
    setPrefs(prev => {
      const clone = [...prev];
      if (!clone[idx]) {
        clone[idx] = [];
      }
      return clone;
    });
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-3xl p-4 rounded relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
        >
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-bold mb-2">
          Select Seat Preferences (Party of {partySize})
        </h3>

        {/* Preference Tabs */}
        <div className="flex space-x-2 mb-4">
          {[0,1,2].map(idx => (
            <button
              key={idx}
              onClick={() => handlePrefSwitch(idx)}
              className={`px-3 py-1 rounded ${
                activePrefIndex === idx ? 'bg-orange-200' : 'bg-gray-100'
              }`}
            >
              {idx + 1}st Choice
            </button>
          ))}
        </div>

        {/* Example seat listing, you could do a grid or seat map */}
        <div className="grid grid-cols-4 gap-4">
          {allSeats.map(seat => {
            const statusColor = getSeatColor(seat.label);
            const chosen = isSeatChosen(seat.label);
            return (
              <div
                key={seat.id}
                onClick={() => handleSeatClick(seat.label)}
                className={`
                  cursor-pointer text-white text-sm rounded
                  flex items-center justify-center h-12
                  ${statusColor}
                  ${chosen ? 'ring-4 ring-blue-400' : ''}
                `}
                title={`Seat ${seat.label}`}
              >
                {seat.label}
              </div>
            );
          })}
        </div>

        {/* Current preference seat labels */}
        <div className="mt-4">
          <p className="text-sm text-gray-700">
            {`Choice #${activePrefIndex + 1}: `} 
            {prefs[activePrefIndex]?.join(', ') || '(none)'}
          </p>
        </div>

        <div className="mt-6 flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
