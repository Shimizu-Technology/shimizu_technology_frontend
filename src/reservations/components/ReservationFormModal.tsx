// src/reservations/components/ReservationFormModal.tsx

import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import toastUtils from '../../shared/utils/toastUtils';
import Select, { SingleValue } from 'react-select';

import {
  fetchAvailability,
  createReservation,
  fetchLayout,
  fetchRestaurant
} from '../services/api';

import SeatPreferenceMapModal from './SeatPreferenceMapModal';
import type { SeatSectionData } from './SeatLayoutCanvas';

// Types for React Select
interface TimeOption {
  value: string; // e.g. "17:30"
  label: string; // e.g. "5:30 PM"
}
interface DurationOption {
  value: number; // e.g. 60
  label: string; // e.g. "60" or "1 hour"
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  defaultDate?: string; // e.g. "2025-01-26"
}

export default function ReservationFormModal({ onClose, onSuccess, defaultDate }: Props) {
  // -- Helpers --
  function parseYYYYMMDD(dateStr: string): Date | null {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }
  function formatYYYYMMDD(d: Date): string {
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  function format12hSlot(slot: string) {
    const [hhStr, mmStr] = slot.split(':');
    const hh = parseInt(hhStr, 10);
    const mins = parseInt(mmStr, 10);
    const d = new Date(2020, 0, 1, hh, mins);
    return d.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  // -- State --
  const [date, setDate] = useState(defaultDate || ''); // "YYYY-MM-DD"
  const [time, setTime] = useState('');
  const [partySizeText, setPartySizeText] = useState('2');

  // Contact info
  const [contactName, setContactName]   = useState('');
  const [contactPhone, setContactPhone] = useState('+1671');
  const [contactEmail, setContactEmail] = useState('');

  // Duration (minutes)
  const [duration, setDuration] = useState(60);

  // Timeslots from server
  const [timeslots, setTimeslots] = useState<string[]>([]);
  // If there's exactly 1 timeslot => forcibly set a large duration
  const hideDuration = timeslots.length === 1;

  // Seat preferences
  const [allSets, setAllSets] = useState<string[][]>([[], [], []]);
  const [showSeatMapModal, setShowSeatMapModal] = useState(false);

  // Layout
  const [layoutSections, setLayoutSections] = useState<SeatSectionData[]>([]);
  const [layoutLoading, setLayoutLoading]   = useState(false);

  function getPartySize(): number {
    return parseInt(partySizeText, 10) || 1;
  }

  // -- Effects --

  // 1) Load default reservation length from the restaurant
  useEffect(() => {
    async function loadRestaurant() {
      try {
        const rest = await fetchRestaurant(1);
        if (rest.default_reservation_length) {
          setDuration(rest.default_reservation_length);
        }
      } catch (err) {
        console.error('Error fetching restaurant:', err);
      }
    }
    loadRestaurant();
  }, []);

  // 2) Load timeslots on date/partySize changes
  useEffect(() => {
    const sizeNum = getPartySize();
    if (!date || !sizeNum) {
      setTimeslots([]);
      return;
    }
    async function loadTimes() {
      try {
        const data = await fetchAvailability(date, sizeNum);
        setTimeslots(data.slots || []);
      } catch (err) {
        console.error('Error fetching availability:', err);
        setTimeslots([]);
      }
    }
    loadTimes();
  }, [date, partySizeText]);

  // 3) If only 1 timeslot => forcibly set duration
  useEffect(() => {
    if (hideDuration) {
      setDuration(720); // e.g. 12 hours to block entire day
    }
  }, [hideDuration]);

  // 4) Load layout for seat map
  useEffect(() => {
    async function loadLayout() {
      setLayoutLoading(true);
      try {
        const layout = await fetchLayout(1);
        const sections: SeatSectionData[] = layout.seat_sections.map((sec: any) => ({
          id: sec.id,
          name: sec.name,
          section_type: sec.section_type === 'table' ? 'table' : 'counter',
          offset_x: sec.offset_x,
          offset_y: sec.offset_y,
          floor_number: sec.floor_number ?? 1,
          seats: sec.seats.map((s: any) => ({
            id: s.id,
            label: s.label,
            position_x: s.position_x,
            position_y: s.position_y,
            capacity: s.capacity ?? 1,
          })),
        }));
        setLayoutSections(sections);
      } catch (err) {
        console.error('Error fetching layout:', err);
      } finally {
        setLayoutLoading(false);
      }
    }
    loadLayout();
  }, []);

  // -- Handlers --

  // numeric input for partySize
  function handlePartySizeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digitsOnly = e.target.value.replace(/\D/g, '');
    setPartySizeText(digitsOnly);
  }

  // Build React-Select options for timeslots
  const timeOptions: TimeOption[] = timeslots.map((slot) => ({
    value: slot,
    label: format12hSlot(slot),
  }));

  // Build React-Select options for possible durations
  const durationValues = [30, 60, 90, 120, 180, 240, 360, 480, 720];
  const durationOptions: DurationOption[] = durationValues.map((val) => ({
    value: val,
    label: val.toString(),
  }));

  // Attempt create reservation
  async function handleCreate() {
    if (!contactName) {
      toastUtils.error('Guest name is required.');
      return;
    }
    if (!date || !time) {
      toastUtils.error('Please pick a valid date/time.');
      return;
    }

    const finalPartySize = getPartySize();
    let phoneVal         = contactPhone.trim();
    // cleanup phone
    const cleanedPhone = phoneVal.replace(/[-()\s]+/g, '');
    if (cleanedPhone === '+1671') {
      phoneVal = '';
    }

    const start_time = `${date}T${time}:00`;

    // Only store seat preferences if they are non-empty
    const seat_prefs_for_db = allSets.filter((arr) => arr.length > 0);

    try {
      await createReservation({
        reservation: {
          restaurant_id: 1,
          start_time,
          party_size: finalPartySize,
          contact_name: contactName,
          contact_phone: phoneVal,
          contact_email: contactEmail,
          status: 'booked',
          seat_preferences: seat_prefs_for_db,
          duration_minutes: duration,
        },
      });

      toastUtils.success('Reservation created successfully!');
      onSuccess(); // parent can reload
    } catch (err) {
      console.error('Error creating reservation:', err);
      toastUtils.error('Failed to create reservation. Please try again.');
    }
  }

  // Seat map
  function handleOpenSeatMap() {
    if (!layoutSections.length) {
      alert('Layout not loaded or no seats available.');
      return;
    }
    setShowSeatMapModal(true);
  }
  function handleCloseSeatMap() {
    setShowSeatMapModal(false);
  }
  function handleSeatMapSave(threeSets: string[][]) {
    setAllSets(threeSets);
    setShowSeatMapModal(false);
  }

  // Convert date => Date object for <DatePicker>
  const parsedDate = date ? parseYYYYMMDD(date) : null;

  // React-Select styling to match brand colors
  const reactSelectStyles = {
    control: (base: any) => ({
      ...base,
      minHeight: '2.25rem',
      borderColor: '#D1D5DB', // tailwind gray-300
      fontSize: '0.875rem',
      boxShadow: 'none',
      '&:hover': {
        borderColor: '#EB578C', // pink
      },
    }),
    option: (base: any, state: any) => ({
      ...base,
      fontSize: '0.875rem',
      color: state.isSelected ? 'white' : '#374151', // gray-700
      backgroundColor: state.isSelected ? '#EB578C' : 'white',
      '&:hover': {
        backgroundColor: '#FF7F6A', // coral
      },
    }),
    menu: (base: any) => ({
      ...base,
      zIndex: 9999,
    }),
  };

  return (
    <>
      {/* Modal background */}
      <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
        <div className="relative bg-white max-w-lg w-full mx-4 rounded-lg shadow-lg">
          <div className="p-6 max-h-[85vh] overflow-y-auto relative">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>

            <h2 className="text-2xl font-bold mb-4 text-gray-900">
              New Reservation
            </h2>

            {/* 2-col grid: Date + PartySize */}
            <div className="grid grid-cols-2 gap-4">
              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <DatePicker
                  selected={parsedDate ?? undefined}
                  onChange={(selected: Date | null) => {
                    if (selected) {
                      setDate(formatYYYYMMDD(selected));
                    } else {
                      setDate('');
                    }
                  }}
                  dateFormat="MM/dd/yyyy"
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                  placeholderText="Select date"
                />
              </div>

              {/* Party Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Party Size
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={partySizeText}
                  onChange={handlePartySizeChange}
                  placeholder="2"
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                />
              </div>
            </div>

            {/* Time => React Select */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time
              </label>
              <Select<TimeOption>
                options={timeOptions}
                placeholder="-- Select a time --"
                value={time ? timeOptions.find((opt) => opt.value === time) : null}
                onChange={(opt: SingleValue<TimeOption>) => {
                  setTime(opt?.value || '');
                }}
                styles={reactSelectStyles}
              />
            </div>

            {/* Duration => also React Select, unless only 1 timeslot found */}
            {!hideDuration && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (minutes)
                </label>
                <Select<DurationOption>
                  options={durationOptions}
                  placeholder="Select duration"
                  value={durationOptions.find((o) => o.value === duration) || null}
                  onChange={(opt) => setDuration(opt?.value || 60)}
                  styles={reactSelectStyles}
                />
              </div>
            )}

            {/* Contact Name */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Guest Name
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
                className="w-full p-2 border border-gray-300 rounded text-sm"
              />
            </div>

            {/* Phone */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded text-sm"
                placeholder="+1671"
              />
            </div>

            {/* Email */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded text-sm"
              />
            </div>

            {/* Seat Preferences */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Seat Preferences (Optional)
              </label>
              <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
                <p className="text-xs italic">
                  Option 1: {allSets[0].length ? allSets[0].join(', ') : '(none)'}
                </p>
                <p className="text-xs italic">
                  Option 2: {allSets[1].length ? allSets[1].join(', ') : '(none)'}
                </p>
                <p className="text-xs italic">
                  Option 3: {allSets[2].length ? allSets[2].join(', ') : '(none)'}
                </p>
                <button
                  type="button"
                  onClick={handleOpenSeatMap}
                  className="mt-2 px-3 py-1 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
                  disabled={layoutLoading}
                >
                  {allSets.some((a) => a.length)
                    ? 'Edit Seat Preferences'
                    : 'Select Seat Preferences'}
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-6 flex justify-end space-x-2">
              <button
                onClick={handleCreate}
                className="
                  px-4 py-2
                  bg-hafaloha-pink
                  hover:bg-hafaloha-coral
                  text-white
                  rounded
                  transition-colors
                "
              >
                Create
              </button>
              <button
                onClick={onClose}
                className="
                  px-4 py-2
                  bg-gray-200
                  text-gray-800
                  rounded
                  hover:bg-gray-300
                  transition-colors
                "
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Seat Map Modal */}
      {showSeatMapModal && (
        <SeatPreferenceMapModal
          date={date}
          time={time}
          duration={duration}
          partySize={getPartySize()}
          sections={layoutSections}
          initialPreferences={allSets}
          onSave={handleSeatMapSave}
          onClose={handleCloseSeatMap}
        />
      )}
    </>
  );
}
