// src/components/dashboard/WaitlistTab.tsx
import React, { useEffect, useState } from 'react';
import { Search, Clock, Users, Phone } from 'lucide-react';
import DatePicker from 'react-datepicker';  // optional if you want a date picker
import 'react-datepicker/dist/react-datepicker.css';
import { formatPhoneNumber } from '../../../shared/utils/formatters';

import { useDateFilter } from '../../context/DateFilterContext';
import { fetchWaitlistEntries as apiFetchWaitlist } from '../../services/api';

interface WaitlistEntry {
  id: number;
  contact_name?: string;
  contact_phone?: string;
  party_size?: number;
  check_in_time?: string;
  status?: string; // "waiting", "seated", "removed", "no_show", etc.
  seat_labels?: string[];
}

// Utility for parse/format
function parseDateFilter(dateStr: string): Date {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}
function formatYYYYMMDD(dateObj: Date): string {
  return dateObj.toISOString().split('T')[0];
}

export default function WaitlistTab() {
  // Using the global date from context (like ReservationsTab)
  const { date /*, setDate */ } = useDateFilter();

  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch waitlist whenever the “global” date changes
  useEffect(() => {
    fetchWaitlistData();
  }, [date]);

  async function fetchWaitlistData() {
    try {
      const data = await apiFetchWaitlist({ date });
      setWaitlist(data);
    } catch (err) {
      console.error('Error fetching waitlist:', err);
    }
  }

  // Searching logic
  const searchedWaitlist = waitlist.filter((w) => {
    const wName = w.contact_name?.toLowerCase() ?? '';
    const wPhone = w.contact_phone ?? '';
    const sTerm = searchTerm.toLowerCase();
    return wName.includes(sTerm) || wPhone.includes(searchTerm);
  });

  return (
    <div className="bg-white shadow rounded-md p-4">
      {/* Top toolbar for search; optionally also a date nav if desired */}
      <div className="border-b border-gray-200 bg-hafaloha-gold/5 rounded-md p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* If you want a date nav, replicate the approach from ReservationsTab. 
              For simplicity, we'll just show the search bar. */}
          <div className="relative w-full sm:w-auto flex-1">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search waitlist..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="
                pl-10 pr-4 py-2 w-full
                border border-gray-300
                rounded-md
                focus:ring-2 focus:ring-hafaloha-gold focus:border-hafaloha-gold
                text-sm
              "
            />
          </div>
          {/* Optionally add DatePicker or arrow nav here if you want date-based waitlist. */}
        </div>
      </div>

      {/* Waitlist table */}
      <div className="overflow-x-auto mt-4">
        {/* Full-width table for desktop */}
        <table className="w-full table-auto divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                Time Joined
              </th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                Guest
              </th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                Party Size
              </th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {searchedWaitlist.map((w) => {
              const joined = new Date(w.check_in_time || '');
              const joinedDisplay = isNaN(joined.getTime())
                ? 'N/A'
                : joined.toLocaleString();

              const seatLabelText = w.seat_labels?.length
                ? `(Seated at ${w.seat_labels.join(', ')})`
                : '';

              return (
                <tr
                  key={w.id}
                  className="hover:bg-hafaloha-gold/5 cursor-pointer"
                >
                  {/* Time Joined */}
                  <td className="px-6 py-4 text-gray-900 whitespace-nowrap">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 text-gray-400 mr-2" />
                      {joinedDisplay}
                    </div>
                  </td>

                  {/* Guest */}
                  <td className="px-6 py-4 text-gray-900 whitespace-nowrap">
                    {w.contact_name ?? 'N/A'}
                    {seatLabelText && (
                      <span className="text-xs text-green-600 ml-1">
                        {seatLabelText}
                      </span>
                    )}
                  </td>

                  {/* Party Size */}
                  <td className="px-6 py-4 text-gray-900 whitespace-nowrap">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 text-gray-400 mr-2" />
                      {w.party_size ?? 1}
                    </div>
                  </td>

                  {/* Contact */}
                  <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                    {w.contact_phone ? (
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 text-gray-400 mr-1" />
                        {formatPhoneNumber(w.contact_phone)}
                      </div>
                    ) : (
                      'N/A'
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {renderWaitlistStatusBadge(w.status)}
                  </td>
                </tr>
              );
            })}

            {/* If no waitlist entries match the search */}
            {searchedWaitlist.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  No waitlist entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Renders a color-coded badge for each waitlist status using
 * brand-friendly or distinct colors.
 */
function renderWaitlistStatusBadge(status?: string) {
  switch (status) {
    case 'waiting':
      // gold for "waiting"
      return (
        <span className="px-2 inline-flex text-xs leading-5 font-semibold
          rounded-full bg-hafaloha-gold/20 text-hafaloha-gold">
          waiting
        </span>
      );
    case 'seated':
      // Teal for "seated"
      return (
        <span className="px-2 inline-flex text-xs leading-5 font-semibold
          rounded-full bg-hafaloha-teal/20 text-hafaloha-teal">
          seated
        </span>
      );
    case 'removed':
      // Gray
      return (
        <span className="px-2 inline-flex text-xs leading-5 font-semibold
          rounded-full bg-gray-200 text-gray-800">
          removed
        </span>
      );
    case 'no_show':
      // Red
      return (
        <span className="px-2 inline-flex text-xs leading-5 font-semibold
          rounded-full bg-red-100 text-red-800">
          no_show
        </span>
      );
    default:
      // Fallback
      return (
        <span className="px-2 inline-flex text-xs leading-5 font-semibold
          rounded-full bg-gray-100 text-gray-800">
          {status || 'N/A'}
        </span>
      );
  }
}
