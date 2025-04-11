// src/shared/components/profile/ProfilePage.tsx

import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import toastUtils from '../../utils/toastUtils';
import { useAuth } from '../../auth';
import { User } from '../../types/auth';
import { useAuthStore } from '../../auth/authStore';
import { Input } from '../ui/Input';
import { ProfileSkeleton } from '../ui/SkeletonLoader';

export function ProfilePage() {
  const { user } = useAuth(); // Read the user from shared auth
  const updateUserInStore = useAuthStore((state) => state.updateUser);

  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    // If we have a user in the store, populate the form with it
    if (user) {
      setFirstName(user.first_name ?? '');
      setLastName(user.last_name ?? '');
      setPhone(user.phone ?? '');
      setEmail(user.email ?? '');
    } else {
      fetchProfile(); // or redirect if no user?
    }
    // eslint-disable-next-line
  }, []);

  async function fetchProfile() {
    setLoading(true);
    setError(null);
    try {
      // GET /profile returns the logged-in user's info
      interface ProfileResponse extends User {}
      
      const me = await api.get<ProfileResponse>('/profile');
      setFirstName(me.first_name || '');
      setLastName(me.last_name || '');
      setPhone(me.phone || '');
      setEmail(me.email || '');

      // Optionally, also call updateUserInStore(me) if you want to sync the store
      updateUserInStore(me);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (!user) {
        throw new Error('No user in store. Are you logged in?');
      }

      // 1) Patch => updated user
      interface ProfileUpdateResponse extends User {}
      
      const updatedUser = await api.patch<ProfileUpdateResponse>('/profile', {
        user: {
          first_name: firstName,
          last_name: lastName,
          phone,
          email,
        },
      });

      // 2) Update the authStore => triggers Header re-render with new name
      updateUserInStore(updatedUser);

      // Show success message in the component instead of toast
      setSuccessMessage('Profile updated successfully!');
      
      // Still show toast for additional feedback
      toastUtils.success('Profile updated successfully!');
    } catch (err: any) {
      setError(err.message);
      toastUtils.error('Failed to update profile');
    } finally {
      setSaveLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-fadeIn transition-opacity duration-300">
        <ProfileSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
      <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-6 sm:p-8 md:p-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">My Profile</h1>

        {error && (
          <div className="mb-6 text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 text-green-600 bg-green-50 border border-green-200 rounded-md p-3">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* First Name */}
            <Input
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First Name"
              id="firstName"
              fullWidth
            />
            
            {/* Last Name */}
            <Input
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last Name"
              id="lastName"
              fullWidth
            />
          </div>

          {/* Phone */}
          <Input
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (671) 123-9999"
            id="phone"
            fullWidth
          />

          {/* Email */}
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            id="email"
            fullWidth
          />

          <div className="pt-6 flex justify-end">
            <button
              type="submit"
              disabled={saveLoading}
              className={`
                inline-flex items-center px-6 py-3 text-lg
                bg-[#c1902f] text-white font-medium
                rounded-md hover:bg-[#d4a43f]
                focus:outline-none focus:ring-2 focus:ring-offset-2
                focus:ring-[#c1902f] transition-all
                ${saveLoading ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'}
              `}
            >
              {saveLoading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProfilePage;
