// src/shared/components/auth/VerifyPhonePage.tsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth';
import { useNavigate } from 'react-router-dom';
import toastUtils from '../../../shared/utils/toastUtils';

export function VerifyPhonePage() {
  const navigate = useNavigate();
  const { user, verifyPhone, resendVerificationCode, isLoading: loading, error } = useAuth();

  const [code, setCode] = useState('');
  const [resendMsg, setResendMsg] = useState<string>('');

  useEffect(() => {
    // If user is not logged in, boot to /login
    if (!user) {
      navigate('/login');
    } 
    // If already verified, no need to be here.
    else if (user.phone_verified) {
      navigate('/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;

    try {
      await verifyPhone(code);
      toastUtils.success('Phone verified successfully!');
      navigate('/');
    } catch (err) {
      // Typically 422 Unprocessable if code is invalid/expired.
      toastUtils.error('Invalid code or verification expired.');
    }
  }

  async function handleResend() {
    try {
      const resp = await resendVerificationCode();
      if (resp.message) {
        setResendMsg(resp.message);
        toastUtils.success(resp.message);
      }
    } catch (err: any) {
      // If the server returned 429, the error message likely has "Please wait before requesting another code"
      if (err.message?.includes('Please wait before requesting another code')) {
        toastUtils.error('You must wait 1 minute before requesting another code again.');
      } else {
        toastUtils.error(err.message || 'Failed to resend code.');
      }
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col items-center justify-center">
        <div className="w-full max-w-md">
          <div className="max-w-md w-full mx-auto p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4 text-center">Verify Your Phone</h2>
            <p className="text-sm text-gray-600 mb-6 text-center">
              Please enter the code we sent to {user?.phone}.
            </p>

            {/* If our store has a general error, display it. */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded">
                {error}
              </div>
            )}

            {/* If the resend() call returned a success message, show it. */}
            {resendMsg && (
              <div className="mb-4 p-3 bg-green-50 text-green-700 border border-green-200 rounded">
                {resendMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block font-medium mb-1">Verification Code</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full border border-gray-300 px-3 py-2 rounded"
                  placeholder="123456"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#c1902f] text-white py-2 rounded hover:bg-[#d4a43f] transition-colors"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </form>

            <div className="mt-4 text-sm text-center">
              Didn't get the code?{' '}
              <button
                type="button"
                disabled={loading}
                onClick={handleResend}
                className="text-blue-600 underline"
              >
                Resend
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VerifyPhonePage;
