// src/ordering/components/admin/settings/UserModal.tsx
import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import toastUtils from '../../../../shared/utils/toastUtils';
import { formatPhoneNumber } from '../../../../shared/utils/formatters';
import { X, KeyRound, Mail, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../../../shared/auth';

// Same phone check from SignUpForm
// Matches +3-4 digits for country/area code, plus exactly 7 digits => total 10 or 11 digits after the plus
function isValidPhone(phoneStr: string) {
  // Example: +16711234567 or +9251234567
  return /^\+\d{3,4}\d{7}$/.test(phoneStr);
}

interface User {
  id: number;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  role: string;
}

interface UserModalProps {
  user: User | null;
  isCreateMode: boolean;
  onClose: (didChange: boolean) => void;
  restaurantId?: string;
}

export function UserModal({ user, isCreateMode, onClose, restaurantId }: UserModalProps) {
  // If creating new => default phone to +1671; otherwise load existing phone
  const [email, setEmail] = useState(user?.email || '');
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [phone, setPhone] = useState(
    isCreateMode ? '+1671' : user?.phone || ''
  );
  const [role, setRole] = useState(user?.role || 'customer');
  const [loading, setLoading] = useState(false);
  const isSuperAdmin = useAuthStore(state => state.isSuperAdmin());
  
  // If a non-super_admin user tries to edit a super_admin user, prevent it
  useEffect(() => {
    if (user?.role === 'super_admin' && !isSuperAdmin) {
      toastUtils.error('You do not have permission to edit Super Admin users.');
      onClose(false);
    }
  }, [user, isSuperAdmin, onClose]);

  async function handleSave() {
    setLoading(true);
    try {
      // Prevent non-super_admin users from setting role to super_admin
      if (role === 'super_admin' && !isSuperAdmin) {
        toastUtils.error('Only Super Admins can create or modify Super Admin accounts.');
        setLoading(false);
        return;
      }
      
      const finalPhone = phone.trim();
      // If phone isn't blank => validate it
      if (finalPhone && !isValidPhone(finalPhone)) {
        toastUtils.error('Phone must be + (3 or 4 digit area code) + 7 digits, e.g. +16711234567');
        setLoading(false);
        return;
      }

      if (isCreateMode) {
        // POST /admin/users
        await api.post('/admin/users', {
          email,
          first_name: firstName,
          last_name: lastName,
          phone: finalPhone || undefined, // if blank => undefined
          role,
          restaurant_id: restaurantId
        });
        toastUtils.success('User created!');
        onClose(true);
      } else if (user) {
        // PATCH /admin/users/:id
        await api.patch(`/admin/users/${user.id}`, {
          email,
          first_name: firstName,
          last_name: lastName,
          phone: finalPhone || undefined,
          role,
        });
        toastUtils.success('User updated!');
        onClose(true);
      }
    } catch (error) {
      console.error(error);
      toastUtils.error('Failed to save user.');
      onClose(false);
    } finally {
      setLoading(false);
    }
  }

  // States for delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Open delete confirmation modal
  function openDeleteModal() {
    setShowDeleteModal(true);
  }
  
  // Close delete confirmation modal
  function closeDeleteModal() {
    setShowDeleteModal(false);
  }
  
  async function handleDelete() {
    if (!user) return;
    
    setLoading(true);
    try {
      await api.delete(`/admin/users/${user.id}`);
      toastUtils.success('User deleted.');
      onClose(true);
    } catch (error) {
      console.error(error);
      toastUtils.error('Failed to delete user.');
      setLoading(false);
      closeDeleteModal();
    }
  }

  // Re-send (invite + reset link) => POST /admin/users/:id/resend_invite
  async function handleResendInvite() {
    if (!user) return;
    setLoading(true);
    try {
      await api.post(`/admin/users/${user.id}/resend_invite`, {});
      toastUtils.success(`Invite/reset link sent to ${user.email}`);
    } catch (error) {
      console.error(error);
      toastUtils.error('Failed to send the invite/reset link.');
    } finally {
      setLoading(false);
    }
  }

  // States for reset password modal
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  
  // Open password reset modal
  function openPasswordResetModal() {
    setNewPassword('');
    setPasswordError('');
    setResetSuccess(false);
    setShowPasswordResetModal(true);
  }
  
  // Close password reset modal
  function closePasswordResetModal() {
    setShowPasswordResetModal(false);
  }
  
  // Admin reset password function => POST /admin/users/:id/admin_reset_password
  async function handleAdminResetPassword() {
    if (!user) return;
    
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    try {
      await api.post(`/admin/users/${user.id}/admin_reset_password`, {
        password: newPassword
      });
      
      setResetSuccess(true);
      toastUtils.success(`Password has been reset for ${user.email}`);
    } catch (error) {
      console.error(error);
      toastUtils.error('Failed to reset the password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="
        fixed inset-0 z-[9999] flex items-center justify-center
        bg-black bg-opacity-50 backdrop-blur-sm animate-fadeIn transition-all duration-300
      "
    >
      <div className="bg-white w-full max-w-md rounded shadow-lg p-6 relative mx-2 animate-slideUp transform-gpu will-change-transform">
        <h2 className="text-xl font-semibold mb-4">
          {isCreateMode ? 'Create User' : 'Edit User'}
        </h2>

        <div className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full border border-gray-300 rounded-md
                         focus:ring-[#c1902f] focus:border-[#c1902f] p-2
                         transition-colors duration-200"
            />
          </div>

          {/* First & Last Name */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-md
                           focus:ring-[#c1902f] focus:border-[#c1902f] p-2
                           transition-colors duration-200"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-md
                           focus:ring-[#c1902f] focus:border-[#c1902f] p-2
                           transition-colors duration-200"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Phone <span className="text-red-500">*</span>
              <span className="ml-1 text-gray-500 text-xs" title="Enter in format: +16719893444">ⓘ</span>
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1671"
              required
              className="mt-1 w-full border border-gray-300 rounded-md
                         focus:ring-[#c1902f] focus:border-[#c1902f] p-2
                         transition-colors duration-200"
            />
            {phone && (
              <p className="mt-1 text-sm text-gray-500">
                Will display as: {formatPhoneNumber(phone)}
              </p>
            )}
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Role <span className="text-red-500">*</span>
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
              className="mt-1 block w-full border border-gray-300 rounded-md
                         focus:ring-[#c1902f] focus:border-[#c1902f] 
                         p-2 text-base transition-colors duration-200"
            >
              <option value="customer">Customer</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
              {isSuperAdmin && <option value="super_admin">Super Admin</option>}
            </select>
          </div>
        </div>

          {/* Delete Confirmation Modal */}
          {showDeleteModal && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm animate-fadeIn">
              <div className="bg-white w-full max-w-md rounded-lg shadow-xl p-6 mx-4 animate-slideUp">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Confirm Deletion</h3>
                  <button 
                    onClick={closeDeleteModal}
                    className="text-gray-400 hover:text-gray-500 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <Trash2 className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-red-800">
                        Are you sure you want to delete {user?.email}?
                      </p>
                      <p className="mt-1 text-sm text-red-700">
                        This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={closeDeleteModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 
                            rounded-md shadow-sm hover:bg-gray-50 focus:outline-none transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent 
                            rounded-md shadow-sm hover:bg-red-700 focus:outline-none transition-colors
                            disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Deleting...' : 'Delete User'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Password Reset Modal */}
          {showPasswordResetModal && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm animate-fadeIn">
              <div className="bg-white w-full max-w-md rounded-lg shadow-xl p-6 mx-4 animate-slideUp">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Reset Password</h3>
                  <button 
                    onClick={closePasswordResetModal}
                    className="text-gray-400 hover:text-gray-500 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                {resetSuccess ? (
                  <div className="p-4 mb-4 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <KeyRound className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-green-800">
                          Password has been successfully reset for {user?.email}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mb-4 text-sm text-gray-700">
                      Set a new password for <span className="font-medium">{user?.email}</span>. Make sure to communicate this password to the user securely.
                    </p>
                    
                    <div className="mb-4">
                      <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
                        New Password
                      </label>
                      <input
                        id="new-password"
                        type="text"
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          if (passwordError && e.target.value.length >= 6) {
                            setPasswordError('');
                          }
                        }}
                        className={`w-full p-2 border ${passwordError ? 'border-red-300' : 'border-gray-300'} 
                                  rounded-md focus:ring-[#c1902f] focus:border-[#c1902f] transition-colors`}
                        placeholder="Enter new password"
                      />
                      {passwordError && (
                        <p className="mt-1 text-sm text-red-600">{passwordError}</p>
                      )}
                    </div>
                    
                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={closePasswordResetModal}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 
                                 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAdminResetPassword}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-white bg-[#c1902f] border border-transparent 
                                rounded-md shadow-sm hover:bg-[#d4a43f] focus:outline-none transition-colors
                                disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Resetting...' : 'Reset Password'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons Section */}
          <div className="mt-8">
            {/* Admin special actions - only if existing user */}
            {!isCreateMode && (
              <div className="grid grid-cols-3 gap-4 mb-6">
                {/* Send Reset Link button */}
                <button
                  type="button"
                  onClick={handleResendInvite}
                  disabled={loading}
                  className="flex flex-col items-center justify-center px-4 py-3 text-sm font-medium text-white bg-blue-600 
                          rounded-md shadow-md hover:bg-blue-700 transition-colors duration-200
                          disabled:opacity-50 disabled:cursor-not-allowed h-24"
                >
                  {loading ? (
                    <span className="flex flex-col items-center justify-center h-full">
                      <svg className="animate-spin mb-2 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Sending...</span>
                    </span>
                  ) : (
                    <>
                      <Mail className="mb-2 h-6 w-6" />
                      <span>Send Reset Link</span>
                    </>
                  )}
                </button>
                
                {/* Reset Password Directly button */}
                <button
                  type="button"
                  onClick={openPasswordResetModal}
                  disabled={loading}
                  className="flex flex-col items-center justify-center px-4 py-3 text-sm font-medium text-white bg-[#8854d0]
                          rounded-md shadow-md hover:bg-[#a55eea] transition-colors duration-200
                          disabled:opacity-50 disabled:cursor-not-allowed h-24"
                >
                  <KeyRound className="mb-2 h-6 w-6" />
                  <span>Reset Password</span>
                </button>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={openDeleteModal}
                  disabled={loading}
                  className="flex flex-col items-center justify-center px-4 py-3 text-sm font-medium text-white bg-red-600 
                          rounded-md shadow-md hover:bg-red-700 transition-colors duration-200
                          disabled:opacity-50 disabled:cursor-not-allowed h-24"
                >
                  <Trash2 className="mb-2 h-6 w-6" />
                  <span>Delete</span>
                </button>
              </div>
            )}

            {/* Save/Cancel Buttons */}
            <div className="flex justify-between pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => onClose(false)}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300
                        rounded-md shadow-sm hover:bg-gray-50 transition-colors duration-200"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleSave}
                className="px-5 py-2.5 text-sm font-medium text-white bg-[#c1902f]
                        rounded-md shadow-sm hover:bg-[#d4a43f] transition-all duration-200
                        transform hover:scale-[1.02] active:scale-[0.98]
                        disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isCreateMode ? 'Creating...' : 'Saving...'}
                  </span>
                ) : (isCreateMode ? 'Create' : 'Save')}
              </button>
            </div>
        </div>
      </div>
    </div>
  );
}
