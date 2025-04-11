// src/components/ReservationModal.tsx

import React, { useEffect, useState } from 'react';
import { XCircle } from 'lucide-react';
import toastUtils from '../../shared/utils/toastUtils';
import { formatPhoneNumber } from '../../shared/utils/formatters';

import {
  fetchLayout,
  fetchSeatAllocations,
  updateReservation,
  seatAllocationReserve,
} from '../services/api';
import SeatPreferenceMapModal from './SeatPreferenceMapModal';
import type { SeatSectionData } from './SeatLayoutCanvas';

interface Reservation {
  id: number;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  party_size?: number;
  status?: string;
  start_time?: string;      // e.g. "2025-01-25T19:00:00Z"
  created_at?: string;
  seat_preferences?: string[][];
  seat_labels?: string[];
  duration_minutes?: number;
}

interface Props {
  reservation: Reservation;
  onClose: () => void;
  onDelete?: (id: number) => void;
  onRefreshData?: () => void; // triggers parent to re-fetch seat data
}

export default function ReservationModal({
  reservation,
  onClose,
  onDelete,
  onRefreshData,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);

  // Basic fields
  const [guestName, setGuestName] = useState(reservation.contact_name || '');
  // Store the party size as a string for free editing in edit mode
  const [partySizeText, setPartySizeText] = useState(String(reservation.party_size || 1));
  const [contactPhone, setContactPhone]   = useState(reservation.contact_phone || '');
  const [contactEmail, setContactEmail]   = useState(reservation.contact_email || '');
  const [status, setStatus]               = useState(reservation.status || 'booked');
  const [duration, setDuration]           = useState(reservation.duration_minutes ?? 60);

  // If seat_preferences is populated, store it; else default to 3 empty arrays
  const [allSets, setAllSets] = useState<string[][]>(
    reservation.seat_preferences?.length ? reservation.seat_preferences : [[], [], []]
  );

  // Layout & seat allocations for the date
  const [layoutSections, setLayoutSections] = useState<SeatSectionData[]>([]);
  const [occupiedSeatLabels, setOccupiedSeatLabels] = useState<Set<string>>(new Set());

  // For seat map modal
  const [showSeatMapModal, setShowSeatMapModal] = useState(false);

  // Format createdAt
  const createdAtStr = reservation.created_at
    ? new Date(reservation.created_at).toLocaleString('en-US', {
        timeZone: 'Pacific/Guam',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : '';

  // Format startTime
  const startTimeDate = reservation.start_time ? new Date(reservation.start_time) : null;
  const startTimeStr = startTimeDate
    ? startTimeDate.toLocaleString('en-US', {
        timeZone: 'Pacific/Guam',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : '';

  // ---------- Load layout + seat allocations for the reservation date ----------
  useEffect(() => {
    async function loadLayoutAndAllocations() {
      try {
        // 1) Layout
        const layout = await fetchLayout(1); // or active layout ID
        const sections: SeatSectionData[] = layout.seat_sections.map((sec: any) => ({
          id: sec.id,
          name: sec.name,
          section_type: sec.section_type === 'table' ? 'table' : 'counter',
          offset_x: sec.offset_x,
          offset_y: sec.offset_y,
          floor_number: sec.floor_number ?? 1,
          seats: sec.seats.map((s: any) => ({
            id: s.id,
            label: s.label || '',
            position_x: s.position_x,
            position_y: s.position_y,
            capacity: s.capacity || 1,
          })),
        }));
        setLayoutSections(sections);

        // 2) Occupied seats
        if (reservation.start_time) {
          const isoDateOnly = reservation.start_time.slice(0, 10);
          const seatAllocs = await fetchSeatAllocations({ date: isoDateOnly });

          // seatId => label
          const seatIdToLabel: Record<number, string> = {};
          sections.forEach((sec) => {
            sec.seats.forEach((seat) => {
              seatIdToLabel[seat.id] = seat.label;
            });
          });

          // Make a set of currently occupied seat labels
          const occSet = new Set<string>();
          seatAllocs.forEach((alloc: any) => {
            const occupantStatus = alloc.occupant_status;
            const released = alloc.released_at;
            // If not released & occupant_status in [reserved, seated, occupied], seat is taken
            if (
              !released &&
              (occupantStatus === 'reserved' ||
               occupantStatus === 'seated' ||
               occupantStatus === 'occupied')
            ) {
              const lbl = seatIdToLabel[alloc.seat_id];
              if (lbl) occSet.add(lbl);
            }
          });
          setOccupiedSeatLabels(occSet);
        }
      } catch (err) {
        console.error('Error loading data in ReservationModal:', err);
        toastUtils.error('Failed to load seat data.');
      }
    }
    loadLayoutAndAllocations();
  }, [reservation.start_time]);

  // ---------- Digit-only filter for Party Size (in edit mode) ----------
  function handlePartySizeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digitsOnly = e.target.value.replace(/\D/g, '');
    setPartySizeText(digitsOnly);
  }

  // Convert partySizeText -> number
  function getPartySize(): number {
    return parseInt(partySizeText, 10) || 1;
  }

  // ---------- Save changes (Edit mode -> Update) ----------
  async function handleSave() {
    try {
      // Filter out empty seat-preference sets
      const seat_preferences = allSets.filter((arr) => arr.length > 0);

      await updateReservation(reservation.id, {
        contact_name:   guestName,
        party_size:     getPartySize(),
        contact_phone:  contactPhone,
        contact_email:  contactEmail,
        status,
        seat_preferences,
        duration_minutes: duration,
      });

      toastUtils.success('Reservation updated!');
      setIsEditing(false);
      onClose();
    } catch (err) {
      console.error('Failed to update reservation:', err);
      toastUtils.error('Error updating reservation. Please try again.');
    }
  }

  // ---------- If user clicks Delete ----------
  function handleDelete() {
    if (!onDelete) return;
    // Usually you'd confirm with the user first
    onDelete(reservation.id);
    toastUtils.success('Reservation deleted.');
  }

  // ---------- Seat Map Modal ----------
  function handleOpenSeatMap() {
    setShowSeatMapModal(true);
  }
  function handleCloseSeatMap() {
    setShowSeatMapModal(false);
  }
  function handleSeatMapSave(newSets: string[][]) {
    setAllSets(newSets);
    setShowSeatMapModal(false);
  }

  // ---------- Attempt seat assignment from a preference set ----------
  async function handleAssignSeatsFromOption(optionIndex: number) {
    const seatLabels = reservation.seat_preferences?.[optionIndex];
    if (!seatLabels || seatLabels.length === 0) {
      toastUtils.error('No seats found in that preference.');
      return;
    }
    if (!reservation.start_time) {
      toastUtils.error('This reservation has no start_time, cannot assign seats.');
      return;
    }

    try {
      await seatAllocationReserve({
        occupant_type: 'reservation',
        occupant_id:   reservation.id,
        seat_labels,
        start_time:    reservation.start_time,
      });
      // Then update the reservation to "reserved"
      await updateReservation(reservation.id, { status: 'reserved' });

      toastUtils.success(`Assigned seats from Option ${optionIndex + 1}!`);
      // optional: re-fetch data if the parent passes onRefreshData
      if (onRefreshData) {
        onRefreshData();
      }
    } catch (err: any) {
      console.error('Error assigning seats:', err);
      if (err.response?.status === 422) {
        toastUtils.error('Some seats are already taken. Choose another preference.');
      } else {
        toastUtils.error('Failed to assign seats. Check console.');
      }
    }
  }

  // If occupant is free for all seats in that preference => we can show "Assign"
  function isOptionFullyFree(seatLabels: string[]): boolean {
    return seatLabels.every((lbl) => !occupiedSeatLabels.has(lbl));
  }

  // seat_preferences from the server
  const seatPrefs = reservation.seat_preferences || [];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="relative bg-white max-w-md w-full mx-4 rounded-lg shadow-lg">
        {/* Scrollable container */}
        <div className="p-6 max-h-[85vh] overflow-y-auto relative">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          >
            <XCircle className="w-6 h-6" />
          </button>

          <h2 className="text-2xl font-bold mb-4 text-gray-900">
            Reservation Details
          </h2>

          {!isEditing ? (
            // ==================== VIEW MODE ====================
            <div className="space-y-3 text-gray-700">
              {/* Guest */}
              <div>
                <strong>Guest:</strong> {reservation.contact_name || '(none)'}
              </div>
              {/* Start time */}
              <div>
                <strong>Date/Time:</strong> {startTimeStr || '(none)'}
              </div>
              {/* Party size */}
              <div>
                <strong>Party Size:</strong> {reservation.party_size ?? '(none)'}
              </div>
              {/* Duration */}
              <div>
                <strong>Duration (min):</strong> {reservation.duration_minutes ?? 60}
              </div>
              {/* Phone */}
              <div>
                <strong>Phone:</strong> {reservation.contact_phone ? formatPhoneNumber(reservation.contact_phone) : '(none)'}
              </div>
              {/* Email */}
              <div>
                <strong>Email:</strong> {reservation.contact_email || '(none)'}
              </div>
              {/* Status */}
              <div>
                <strong>Status:</strong>{' '}
                <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-hafaloha-gold/10 text-hafaloha-gold">
                  {reservation.status || 'N/A'}
                </span>
              </div>
              {/* Created At */}
              {reservation.created_at && (
                <div>
                  <strong>Created At:</strong> {createdAtStr}
                </div>
              )}

              {/* seat_preferences => up to 3 sets */}
              <div>
                <strong>Preferred Seats:</strong>{' '}
                {seatPrefs.length ? (
                  seatPrefs.map((arr, idx) => {
                    const joined = arr.join(', ');
                    const canAssign =
                      reservation.status === 'booked' &&
                      arr.length > 0 &&
                      isOptionFullyFree(arr);

                    return (
                      <div key={idx} className="my-1">
                        <span className="font-semibold mr-1">
                          Option {idx + 1}:
                        </span>
                        {joined || '(none)'}
                        {/* If seats exist & are free => show "Assign" */}
                        {canAssign && (
                          <button
                            onClick={() => handleAssignSeatsFromOption(idx)}
                            className="
                              ml-2 text-xs px-2 py-1
                              bg-hafaloha-pink/10
                              text-hafaloha-pink
                              rounded
                              hover:bg-hafaloha-pink/20
                            "
                          >
                            Assign
                          </button>
                        )}
                        {!isOptionFullyFree(arr) && arr.length > 0 && (
                          <span className="ml-2 text-xs text-red-500">
                            (Some seat(s) taken)
                          </span>
                        )}
                      </div>
                    );
                  })
                ) : (
                  '(none)'
                )}
              </div>

              {/* seat_labels => currently assigned seats */}
              {reservation.seat_labels?.length ? (
                <div>
                  <strong>Current Seats:</strong>{' '}
                  {reservation.seat_labels.join(', ')}
                </div>
              ) : null}

              {/* View mode buttons */}
              <div className="mt-6 flex justify-end space-x-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-hafaloha-gold text-white rounded hover:bg-hafaloha-coral"
                >
                  Edit
                </button>
                {onDelete && (
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            // ==================== EDIT MODE ====================
            <div className="space-y-4 text-gray-700">
              {/* Guest Name */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Guest Name
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="
                    w-full p-2 border border-gray-300
                    rounded
                    focus:ring-2 focus:ring-hafaloha-gold focus:border-hafaloha-gold
                  "
                />
              </div>
              {/* Party Size => text-based numeric */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Party Size
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={partySizeText}
                  onChange={handlePartySizeChange}
                  className="
                    w-full p-2 border border-gray-300
                    rounded
                    focus:ring-2 focus:ring-hafaloha-gold focus:border-hafaloha-gold
                  "
                />
              </div>
              {/* Duration (minutes) */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  min={30}
                  step={30}
                  value={duration}
                  onChange={(e) => setDuration(+e.target.value || 60)}
                  className="
                    w-full p-2 border border-gray-300
                    rounded
                    focus:ring-2 focus:ring-hafaloha-gold focus:border-hafaloha-gold
                  "
                />
              </div>
              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="
                    w-full p-2 border border-gray-300
                    rounded
                    focus:ring-2 focus:ring-hafaloha-gold focus:border-hafaloha-gold
                  "
                />
              </div>
              {/* Email */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="
                    w-full p-2 border border-gray-300
                    rounded
                    focus:ring-2 focus:ring-hafaloha-gold focus:border-hafaloha-gold
                  "
                />
              </div>
              {/* Status */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="
                    w-full p-2 border border-gray-300
                    rounded
                    focus:ring-2 focus:ring-hafaloha-gold focus:border-hafaloha-gold
                  "
                >
                  <option value="booked">booked</option>
                  <option value="reserved">reserved</option>
                  <option value="seated">seated</option>
                  <option value="finished">finished</option>
                  <option value="canceled">canceled</option>
                  <option value="no_show">no_show</option>
                </select>
              </div>
              {/* seat_preferences => up to 3 sets => staff can open seat map if needed */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Seat Preferences (up to 3)
                </label>
                <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
                  {allSets.map((arr, idx) => (
                    <div key={idx} className="text-xs italic">
                      Option {idx + 1}: {arr.length ? arr.join(', ') : '(none)'}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleOpenSeatMap}
                    className="
                      mt-2 px-3 py-2 bg-gray-100
                      border border-gray-300
                      rounded hover:bg-gray-200
                      text-sm
                    "
                  >
                    Edit Seat Preferences
                  </button>
                </div>
              </div>

              {/* Edit mode buttons */}
              <div className="mt-6 flex justify-end space-x-2">
                <button
                  onClick={handleSave}
                  className="
                    px-4 py-2
                    bg-hafaloha-gold
                    text-white
                    rounded
                    hover:bg-hafaloha-coral
                  "
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="
                    px-4 py-2
                    bg-gray-200
                    text-gray-800
                    rounded
                    hover:bg-gray-300
                  "
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* If staff wants to open seat map modal */}
      {showSeatMapModal && (
        <SeatPreferenceMapModal
          date={reservation.start_time ? reservation.start_time.slice(0, 10) : ''}
          time={reservation.start_time ? reservation.start_time.slice(11, 16) : ''}
          duration={duration}
          // parse string-based party size => number for seat map
          partySize={getPartySize()}
          sections={layoutSections}
          initialPreferences={allSets}
          onSave={handleSeatMapSave}
          onClose={handleCloseSeatMap}
        />
      )}
    </div>
  );
}
