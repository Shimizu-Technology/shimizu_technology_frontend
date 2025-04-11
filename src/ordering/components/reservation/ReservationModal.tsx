// src/ordering/components/reservation/ReservationModal.tsx
import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Users,
  Mail,
  MapPin,
  Share2,
} from 'lucide-react';
import { fetchAvailability, createReservation } from '../../../reservations/services/api';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ReservationData {
  date: string;
  time: string;
  partySize: number;
  duration: string;
  firstName: string;
  lastName: string;
  phone: string; // We'll prefill +1671 if blank
  email: string;
}

interface ConfirmationData extends ReservationData {
  confirmed: boolean;
}

/**
 * 3-4 digit “area code” + 7 local digits => total 10-11 digits after the plus.
 * e.g. +16711234567, +9251234567, etc.
 */
function isValidPhone(phoneStr: string) {
  return /^\+\d{3,4}\d{7}$/.test(phoneStr);
}

export function ReservationModal({ isOpen, onClose }: ReservationModalProps) {
  const [formData, setFormData] = useState<ReservationData>({
    date: '',
    time: '',
    partySize: 1,
    duration: '1 hour',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
  });
  const [confirmation, setConfirmation] = useState<ConfirmationData | null>(null);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);

  // On open, if phone is blank => set +1671 as the default
  useEffect(() => {
    if (isOpen && formData.phone.trim() === '') {
      setFormData((prev) => ({ ...prev, phone: '+1671' }));
    }
  }, [isOpen]);

  // Whenever date or party size changes => fetch new time slots
  useEffect(() => {
    if (!formData.date || !formData.partySize) {
      setTimeSlots([]);
      return;
    }
    fetchAvailability(formData.date, formData.partySize)
      .then((res) => {
        setTimeSlots(res.slots || []);
      })
      .catch((err) => {
        console.error('Error fetching availability:', err);
        setTimeSlots([]);
      });
  }, [formData.date, formData.partySize]);

  if (!isOpen) return null;

  function handleShare() {
    if (!confirmation) return;
    const text = `I just made a reservation at Håfaloha!
    
Date: ${confirmation.date}
Time: ${confirmation.time}
Party Size: ${confirmation.partySize} people`;

    if (navigator.share) {
      navigator.share({ title: 'Håfaloha Reservation', text }).catch(console.error);
    }
  }

  function parseDuration(durStr: string): number {
    const num = parseFloat(durStr);
    if (isNaN(num)) return 60;
    return Math.round(num * 60);
  }

  async function handleSubmitReal(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.date || !formData.time) {
      alert('Please fill out date and time');
      return;
    }

    const finalPhone = formData.phone.trim();
    if (!isValidPhone(finalPhone)) {
      alert('Phone must be + (3 or 4 digit area code) + 7 digits, e.g. +16711234567');
      return;
    }

    try {
      const start_time = `${formData.date}T${formData.time}:00`;

      await createReservation({
        reservation: {
          restaurant_id: 1,
          start_time,
          party_size: formData.partySize,
          contact_name: `${formData.firstName} ${formData.lastName}`.trim(),
          contact_phone: finalPhone,
          contact_email: formData.email,
          status: 'booked',
          duration_minutes: parseDuration(formData.duration),
        },
      });

      // If successful => Show confirmation
      setConfirmation({
        ...formData,
        phone: finalPhone,
        confirmed: true,
      });
    } catch (err) {
      console.error('Failed to create reservation:', err);
      alert('Reservation failed. Check console for details.');
    }
  }

  // ------------------------------------------------------
  // CONFIRMATION SCREEN
  // ------------------------------------------------------
  if (confirmation) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
        <div className="relative bg-white rounded-lg w-full max-w-2xl">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-500 hover:text-gray-700"
          >
            <X className="h-6 w-6" />
          </button>

          <div className="pt-8 px-6 pb-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <Calendar className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mt-4">Reservation Confirmed!</h2>
            <p className="mt-2 text-sm text-gray-600">Thank you! We look forward to serving you.</p>

            <div className="mt-6 space-y-6 text-left max-w-md mx-auto">
              <div>
                <h4 className="font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#c1902f]" />
                  Date &amp; Time
                </h4>
                <p className="mt-1 text-gray-600">
                  {confirmation.date} at {confirmation.time}
                </p>
                <p className="text-sm text-gray-500">{confirmation.duration}</p>
              </div>
              <div>
                <h4 className="font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#c1902f]" />
                  Party Size
                </h4>
                <p className="mt-1 text-gray-600">
                  {confirmation.partySize} {confirmation.partySize === 1 ? 'person' : 'people'}
                </p>
              </div>
              {(confirmation.phone || confirmation.email) && (
                <div>
                  <h4 className="font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4 text-[#c1902f]" />
                    Contact Info
                  </h4>
                  {confirmation.phone && (
                    <p className="mt-1 text-gray-600">{confirmation.phone}</p>
                  )}
                  {confirmation.email && (
                    <p className="text-gray-600">{confirmation.email}</p>
                  )}
                </div>
              )}
              <div>
                <h4 className="font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#c1902f]" />
                  Location
                </h4>
                <p className="mt-1 text-gray-600">
                  955 Pale San Vitores Rd
                  <br />
                  Tamuning, Guam 96913
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none rounded-md bg-[#c1902f] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#d4a43f]"
              >
                Done
              </button>
              <button
                onClick={handleShare}
                className="flex-1 sm:flex-none rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                <Share2 className="h-4 w-4 inline-block mr-2" />
                Share Details
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------
  // MAIN FORM
  // ------------------------------------------------------
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="relative bg-white rounded-lg w-full max-w-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-500 hover:text-gray-700"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="pt-8 px-6 pb-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">Make a Reservation</h2>
          <p className="text-gray-600">Book your seat for an unforgettable dining experience</p>
        </div>

        <div className="px-6 pb-8">
          <form onSubmit={handleSubmitReal} className="space-y-4">
            {/* Date / Party Size */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Date</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, date: e.target.value }))
                  }
                  min={new Date().toISOString().split('T')[0]}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
                             focus:border-[#c1902f] focus:outline-none focus:ring-1 focus:ring-[#c1902f]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Party Size</label>
                <select
                  value={formData.partySize}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      partySize: parseInt(e.target.value, 10),
                    }))
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
                             focus:border-[#c1902f] focus:outline-none focus:ring-1 focus:ring-[#c1902f]"
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((size) => (
                    <option key={size} value={size}>
                      {size} {size === 1 ? 'person' : 'people'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Time / Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Time</label>
                <select
                  required
                  value={formData.time}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, time: e.target.value }))
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
                             focus:border-[#c1902f] focus:outline-none focus:ring-1 focus:ring-[#c1902f]"
                >
                  <option value="">Select a time</option>
                  {timeSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {formatTime(slot)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Duration</label>
                <select
                  value={formData.duration}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, duration: e.target.value }))
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
                             focus:border-[#c1902f] focus:outline-none focus:ring-1 focus:ring-[#c1902f]"
                >
                  <option value="1 hour">1 hour</option>
                  <option value="1.5 hours">1.5 hours</option>
                  <option value="2 hours">2 hours</option>
                </select>
              </div>
            </div>

            {/* FirstName / LastName */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">First Name</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, firstName: e.target.value }))
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
                             focus:border-[#c1902f] focus:outline-none focus:ring-1 focus:ring-[#c1902f]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Last Name</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, lastName: e.target.value }))
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
                             focus:border-[#c1902f] focus:outline-none focus:ring-1 focus:ring-[#c1902f]"
                />
              </div>
            </div>

            {/* Phone / Email */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  placeholder="+1671"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
                             focus:border-[#c1902f] focus:outline-none focus:ring-1 focus:ring-[#c1902f]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
                             focus:border-[#c1902f] focus:outline-none focus:ring-1 focus:ring-[#c1902f]"
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="w-full rounded-md bg-[#c1902f] px-3 py-2
                           text-sm font-semibold text-white shadow-sm
                           hover:bg-[#d4a43f]"
              >
                Reserve Now
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/** Formats "12:00" => "12:00 PM" for displayed slots. */
function formatTime(t: string) {
  const [hh, mm] = t.split(':').map(Number);
  if (isNaN(hh)) return t;
  const date = new Date(2020, 0, 1, hh, mm);
  return date.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}
