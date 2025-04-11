// src/components/WaitlistForm.tsx
import React, { useState } from 'react';
import { Users, User, Phone } from 'lucide-react';

// 1) Import your new API helper
import { createWaitlistEntry } from '../services/api';

interface WaitlistFormData {
  name: string;
  partySize: number;
  phone: string;
}

export default function WaitlistForm() {
  const [formData, setFormData] = useState<WaitlistFormData>({
    name: '',
    partySize: 1,
    phone: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      // 2) Use createWaitlistEntry
      //    The Rails WaitlistEntriesController might expect:
      //    contact_name, party_size, contact_phone, check_in_time, status, etc.
      await createWaitlistEntry({
        contact_name: formData.name,
        party_size: formData.partySize,
        contact_phone: formData.phone,
        check_in_time: new Date().toISOString(),
        status: 'waiting',
      });

      setSuccess('Added to waitlist successfully!');
      // Reset form
      setFormData({ name: '', partySize: 1, phone: '' });
    } catch (err: any) {
      console.error('Error adding to waitlist:', err);
      setError('Failed to join waitlist. Please try again.');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md mx-auto bg-white rounded-lg shadow-lg p-6"
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md mb-4">
          {success}
        </div>
      )}

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Name
          </label>
          <div className="relative mt-1">
            <User className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md
                         focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              required
            />
          </div>
        </div>

        {/* Party Size */}
        <div>
          <label htmlFor="partySize" className="block text-sm font-medium text-gray-700">
            Party Size
          </label>
          <div className="relative mt-1">
            <Users className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="number"
              id="partySize"
              min="1"
              max="8"
              value={formData.partySize}
              onChange={(e) =>
                setFormData({ ...formData, partySize: parseInt(e.target.value, 10) || 1 })
              }
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md
                         focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              required
            />
          </div>
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
            Phone Number
          </label>
          <div className="relative mt-1">
            <Phone className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="tel"
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md
                         focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              required
            />
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="mt-6">
        <button
          type="submit"
          className="w-full bg-orange-600 text-white py-3 px-6 rounded-md
                     hover:bg-orange-700 transition-colors duration-200 font-semibold"
        >
          Join Waitlist
        </button>
      </div>
    </form>
  );
}
