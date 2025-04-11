// src/components/ReservationForm.tsx

import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Select, { SingleValue } from 'react-select';
import {
  Clock,
  Users,
  Phone,
  Mail,
  Check,
  MapPin,
  CalendarClock,
  Share2,
} from 'lucide-react';

import { useAuth } from '../../shared/auth';
import toastUtils from '../../shared/utils/toastUtils';
import { api } from '../../shared/api';
import { Tooltip } from '../../shared/components/ui';
import { formatPhoneNumber } from '../../shared/utils/formatters';

// Define API types
interface AvailabilityResponse {
  slots: string[];
  date: string;
}

// Define API functions
const fetchAvailability = async (date: string, partySize: number): Promise<AvailabilityResponse> => {
  return api.get<AvailabilityResponse>(`/availability?date=${date}&party_size=${partySize}`);
};

const createReservation = async (data: any): Promise<any> => {
  return api.post<any>('/reservations', data);
};

/** Helpers */
function formatYYYYMMDD(dateObj: Date): string {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function parseYYYYMMDD(dateStr: string): Date | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function format12hSlot(slot: string) {
  const [hhStr, mmStr] = slot.split(':');
  const hh = parseInt(hhStr, 10);
  const mm = parseInt(mmStr, 10);
  const d = new Date(2020, 0, 1, hh, mm);
  return d.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
function formatDuration(minutes: number) {
  if (minutes === 30) return '30 minutes';
  if (minutes === 60) return '1 hour';
  if (minutes === 90) return '1.5 hours';
  return `${minutes / 60} hours`;
}

/** React Select types */
interface TimeOption {
  value: string;
  label: string;
}
interface DurationOption {
  value: number;
  label: string;
}

/** Form fields */
interface ReservationFormData {
  date: string;
  time: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

/** Data for the confirmation UI */
interface ConfirmationData {
  date: string;
  time: string;
  partySize: number;
  duration: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

/** “Reservation Confirmed!” screen */
function ReservationConfirmation({
  reservation,
  onClose,
}: {
  reservation: ConfirmationData;
  onClose: () => void;
}) {
  const dateObj = parseYYYYMMDD(reservation.date);
  const dateStr = dateObj
    ? dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : reservation.date;

  return (
    <div className="relative p-6 max-w-md sm:max-w-xl mx-auto bg-white rounded-lg shadow-lg">
      {/* Pink check bubble */}
      <div className="absolute left-1/2 -top-8 -translate-x-1/2">
        <div className="bg-shimizu-blue text-white p-3 rounded-full shadow-lg">
          <Check className="h-7 w-7" />
        </div>
      </div>

      <div className="text-center mt-8 mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold">Reservation Confirmed!</h2>
        <p className="text-gray-600 mt-1">
          {reservation.firstName ? `Thank you, ${reservation.firstName}! ` : 'Thank you! '}
          We’re excited to serve you at Hafaloha.
        </p>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 sm:p-6 mb-4">
        <h3 className="font-semibold text-base sm:text-lg mb-4 text-gray-900">
          Reservation Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Date & Time */}
          <div className="flex items-start space-x-2">
            <CalendarClock className="h-5 w-5 text-shimizu-blue mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Date &amp; Time</p>
              <p className="text-gray-600">{dateStr}</p>
              <p className="text-gray-600">{reservation.time}</p>
            </div>
          </div>

          {/* Party & Duration */}
          <div className="flex items-start space-x-2">
            <Users className="h-5 w-5 text-shimizu-blue mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Party Size</p>
              <p className="text-gray-600">
                {reservation.partySize}{' '}
                {reservation.partySize === 1 ? 'person' : 'people'}
              </p>
              <p className="text-gray-600">{reservation.duration}</p>
            </div>
          </div>

          {/* Contact */}
          {(reservation.phone || reservation.email) && (
            <div className="flex items-start space-x-2 md:col-span-2">
              <Mail className="h-5 w-5 text-shimizu-blue mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Contact Information</p>
                {reservation.phone && (
                  <p className="text-gray-600">{formatPhoneNumber(reservation.phone)}</p>
                )}
                {reservation.email && (
                  <p className="text-gray-600">{reservation.email}</p>
                )}
              </div>
            </div>
          )}

          {/* Location */}
          <div className="flex items-start space-x-2">
            <MapPin className="h-5 w-5 text-shimizu-blue mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Location</p>
              <p className="text-gray-600">955 Pale San Vitores Rd</p>
              <p className="text-gray-600">Tamuning, Guam 96913</p>
            </div>
          </div>
        </div>
      </div>

      {/* Done / Share buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onClose}
          className="w-full sm:w-auto flex-1 bg-shimizu-light-blue hover:bg-shimizu-blue text-white font-medium py-2 sm:py-3 px-4 rounded-lg transition-colors"
        >
          Done
        </button>
        <button
          onClick={() => alert('Share feature not yet implemented!')}
          className="w-full sm:w-auto flex-1 bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 sm:py-3 px-4 rounded-lg border border-gray-300 transition-colors inline-flex items-center justify-center"
        >
          <Share2 className="h-5 w-5 mr-2" />
          Share Details
        </button>
      </div>
    </div>
  );
}

/** Main ReservationForm */
export default function ReservationForm({
  onClose,                // Parent can close the modal
  onToggleConfirmation,   // Tells parent if we’re confirming
}: {
  onClose?: () => void;
  onToggleConfirmation?: (confirming: boolean) => void;
}) {
  const { user } = useAuth();
  // Basic form data
  const [formData, setFormData] = useState<ReservationFormData>({
    date: '',
    time: '',
    firstName: '',
    lastName: '',
    phone: user?.phone?.trim() || '+1671',
    email: '',
  });

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [partySizeText, setPartySizeText] = useState('1');
  const [duration, setDuration] = useState(60);
  const [timeslots, setTimeslots] = useState<string[]>([]);

  // For confirmation screen
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [reservationDetails, setReservationDetails] = useState<ConfirmationData | null>(null);

  /** Convert typed partySize => number */
  function getPartySize(): number {
    return parseInt(partySizeText, 10) || 1;
  }

  /** Fetch timeslots on date or partySize changes */
  useEffect(() => {
    async function loadTimes() {
      if (!formData.date || !getPartySize()) {
        setTimeslots([]);
        return;
      }
      try {
        const data = await fetchAvailability(formData.date, getPartySize());
        setTimeslots(data.slots || []);
      } catch (err) {
        console.error('Error fetching availability:', err);
        setTimeslots([]);
      }
    }
    loadTimes();
  }, [formData.date, partySizeText]);

  /** Build time options for react-select */
  const timeOptions: TimeOption[] = timeslots.map((slot) => ({
    value: slot,
    label: format12hSlot(slot),
  }));

  /** Duration (minutes) options */
  const durations = [30, 60, 90, 120, 180, 240];
  const durationOptions: DurationOption[] = durations.map((val) => {
    if (val === 30) return { value: val, label: '30 minutes' };
    if (val === 60) return { value: val, label: '1 hour' };
    if (val === 90) return { value: val, label: '1.5 hours' };
    return { value: val, label: `${val / 60} hours` };
  });

  /** Sync the selectedDate with formData.date */
  function handleDateChange(date: Date | null) {
    setSelectedDate(date);
    setFormData({ ...formData, date: date ? formatYYYYMMDD(date) : '' });
  }

  useEffect(() => {
    if (formData.date) {
      setSelectedDate(parseYYYYMMDD(formData.date));
    } else {
      setSelectedDate(null);
    }
  }, [formData.date]);

  /** On form submit => create reservation => show confirmation */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.date || !formData.time) {
      toastUtils.error('Please pick a date and time.');
      return;
    }

    const start_time = `${formData.date}T${formData.time}:00`;

    // fallback contact info
    const contactFirstName =
      formData.firstName.trim() || user?.name?.split(' ')[0] || '';
    const contactLastName =
      formData.lastName.trim() || user?.name?.split(' ')[1] || '';
    let contactPhone = formData.phone.trim();
    const contactEmail = formData.email.trim() || user?.email || '';

    if (!contactFirstName) {
      toastUtils.error('First name is required.');
      return;
    }

    const finalPartySize = getPartySize();
    // phone cleanup
    const cleanedPhone = contactPhone.replace(/[-()\s]+/g, '');
    if (cleanedPhone === '+1671') {
      contactPhone = '';
    }

    try {
      await createReservation({
        start_time,
        party_size: finalPartySize,
        contact_name: [contactFirstName, contactLastName].filter(Boolean).join(' '),
        contact_phone: contactPhone,
        contact_email: contactEmail,
        restaurant_id: 1,
        duration_minutes: duration,
      });
      toastUtils.success('Reservation created successfully!');

      // Build data for the Confirmation UI
      const confirmData: ConfirmationData = {
        date: formData.date,
        time: format12hSlot(formData.time),
        partySize: finalPartySize,
        duration: formatDuration(duration),
        firstName: contactFirstName || undefined,
        lastName: contactLastName || undefined,
        phone: contactPhone || undefined,
        email: contactEmail || undefined,
      };
      setReservationDetails(confirmData);
      setShowConfirmation(true);
      onToggleConfirmation?.(true);
    } catch (err) {
      console.error('Error creating reservation:', err);
      toastUtils.error('Failed to create reservation. Please try again.');
    }
  }

  /** Filter out non-numeric for partySize */
  function handlePartySizeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digitsOnly = e.target.value.replace(/\D/g, '');
    setPartySizeText(digitsOnly);
  }

  /** Custom React-Select styles */
  const reactSelectStyles = {
    control: (base: any) => ({
      ...base,
      minHeight: '2.25rem',
      borderColor: '#D1D5DB',
      fontSize: '0.875rem',
      boxShadow: 'none',
      paddingLeft: '2rem',
      '&:hover': { borderColor: '#EB578C' },
    }),
    option: (base: any, state: any) => ({
      ...base,
      fontSize: '0.875rem',
      color: state.isSelected ? 'white' : '#374151',
      backgroundColor: state.isSelected ? '#EB578C' : 'white',
      '&:hover': { backgroundColor: '#FF7F6A' },
    }),
    menu: (base: any) => ({ ...base, zIndex: 9999 }),
  };

  /** If we are showing the Confirmation screen */
  if (showConfirmation && reservationDetails) {
    return (
      <div className="w-full max-w-md mx-auto">
        <ReservationConfirmation
          reservation={reservationDetails}
          onClose={() => {
            onClose?.();
            setShowConfirmation(false);
            setReservationDetails(null);
            onToggleConfirmation?.(false);
          }}
        />
      </div>
    );
  }

  /** Otherwise, render the narrower form with two columns */
  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {/* Date */}
          <div className="space-y-1">
            <label className="block text-sm sm:text-base font-medium text-gray-700">
              Date
            </label>
            <DatePicker
              selected={selectedDate}
              onChange={handleDateChange}
              dateFormat="MM/dd/yyyy"
              minDate={new Date()}
              className="
                w-full
                px-3 py-2
                border border-gray-300
                rounded-md
                focus:ring-2 focus:ring-shimizu-blue focus:border-shimizu-blue
                text-sm sm:text-base
              "
              placeholderText="Select date"
              required
              shouldCloseOnSelect
            />
          </div>

          {/* Time => React Select */}
          <div className="space-y-1">
            <label className="block text-sm sm:text-base font-medium text-gray-700">
              Time
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Select<TimeOption>
                options={timeOptions}
                placeholder="Select a time"
                value={
                  formData.time
                    ? timeOptions.find((opt) => opt.value === formData.time)
                    : null
                }
                onChange={(opt: SingleValue<TimeOption>) =>
                  setFormData({ ...formData, time: opt?.value || '' })
                }
                styles={reactSelectStyles}
              />
            </div>
          </div>

          {/* Party Size */}
          <div className="space-y-1">
            <div className="flex items-center">
              <label
                htmlFor="partySize"
                className="block text-sm sm:text-base font-medium text-gray-700"
              >
                Party Size
              </label>
              <Tooltip 
                content="Enter the number of people in your party. This helps us allocate the right table size for your group."
                position="top"
                icon
                iconClassName="ml-1 h-4 w-4"
              />
            </div>
            <div className="relative">
              <Users className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                id="partySize"
                inputMode="numeric"
                pattern="[0-9]*"
                value={partySizeText}
                onChange={handlePartySizeChange}
                placeholder="1"
                required
                className="
                  w-full
                  pl-10 pr-3
                  py-2
                  border border-gray-300
                  rounded-md
                  focus:ring-2 focus:ring-shimizu-blue focus:border-shimizu-blue
                  text-sm sm:text-base
                "
              />
            </div>
          </div>

          {/* Duration => React Select */}
          <div className="space-y-1">
            <div className="flex items-center">
              <label className="block text-sm sm:text-base font-medium text-gray-700">
                Duration
              </label>
              <Tooltip 
                content="Select how long you expect to need the table. This helps us manage reservations efficiently."
                position="top"
                icon
                iconClassName="ml-1 h-4 w-4"
              />
            </div>
            <Select<DurationOption>
              options={durationOptions}
              placeholder="Select duration"
              value={durationOptions.find((opt) => opt.value === duration) || null}
              onChange={(opt) => setDuration(opt?.value || 60)}
              styles={reactSelectStyles}
            />
          </div>

          {/* First Name */}
          <div className="space-y-1">
            <label
              htmlFor="firstName"
              className="block text-sm sm:text-base font-medium text-gray-700"
            >
              {user ? 'First Name (Optional)' : 'First Name (Required)'}
            </label>
            <input
              type="text"
              id="firstName"
              placeholder={
                user ? user.name?.split(' ')[0] || '' : 'Enter your first name'
              }
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="
                w-full
                px-3 py-2
                border border-gray-300
                rounded-md
                focus:ring-2 focus:ring-shimizu-blue focus:border-shimizu-blue
                text-sm sm:text-base
              "
            />
          </div>

          {/* Last Name */}
          <div className="space-y-1">
            <label
              htmlFor="lastName"
              className="block text-sm sm:text-base font-medium text-gray-700"
            >
              Last Name (Optional)
            </label>
            <input
              type="text"
              id="lastName"
              placeholder={user ? user.name?.split(' ')[1] || '' : 'Last name (optional)'}
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="
                w-full
                px-3 py-2
                border border-gray-300
                rounded-md
                focus:ring-2 focus:ring-shimizu-blue focus:border-shimizu-blue
                text-sm sm:text-base
              "
            />
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <div className="flex items-center">
              <label
                htmlFor="phone"
                className="block text-sm sm:text-base font-medium text-gray-700"
              >
                Phone {user ? '(Optional)' : '(Required)'}
              </label>
              <Tooltip 
                content="We may contact you about your reservation. Include country code (e.g., +1671 for Guam)."
                position="top"
                icon
                iconClassName="ml-1 h-4 w-4"
              />
            </div>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="tel"
                id="phone"
                placeholder={user ? user.phone ?? '' : '+1671'}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="
                  w-full
                  pl-10 pr-3
                  py-2
                  border border-gray-300
                  rounded-md
                  focus:ring-2 focus:ring-shimizu-blue focus:border-shimizu-blue
                  text-sm sm:text-base
                "
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label
              htmlFor="email"
              className="block text-sm sm:text-base font-medium text-gray-700"
            >
              Email {user ? '(Optional)' : '(Required)'}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="email"
                id="email"
                placeholder={user ? user.email ?? '' : 'Enter your email'}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="
                  w-full
                  pl-10 pr-3
                  py-2
                  border border-gray-300
                  rounded-md
                  focus:ring-2 focus:ring-shimizu-blue focus:border-shimizu-blue
                  text-sm sm:text-base
                "
              />
            </div>
          </div>
        </div>

        {/* Submit button */}
        <div className="mt-4 sm:mt-6">
          <button
            type="submit"
            className="
              w-full
              bg-shimizu-blue
              hover:bg-shimizu-light-blue
              text-white
              py-2 sm:py-3
              px-4 sm:px-6
              rounded-md
              font-semibold
              transition-colors
              duration-200
              text-sm sm:text-base
            "
          >
            Reserve Now
          </button>
        </div>
      </form>
    </div>
  );
}
