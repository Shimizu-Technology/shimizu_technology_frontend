// src/shared/components/auth/LoginForm.tsx

import React, { useState } from 'react';
import { useAuth } from '../../auth';
import { Mail, Lock } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import toastUtils from '../../../shared/utils/toastUtils';

export function LoginForm() {
  const { login, isLoading: loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login({ email, password });
      toastUtils.success('Welcome back!');
      navigate('/');
    } catch (err) {
      // Login error is already handled by the auth store
      // No need to do anything here as the error will be displayed in the UI
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col items-center justify-center">
        <div className="w-full max-w-md">
          <div className="max-w-sm w-full mx-auto px-6 py-8 bg-white shadow-xl rounded-lg border border-gray-100">
            <h2 className="text-3xl font-extrabold text-gray-900 text-center mb-6">
              Welcome Back!
            </h2>

            {/* Always reserve space for error message to prevent layout shift */}
            <div 
              className={`mb-4 rounded-md transition-all duration-300 overflow-hidden ${
                error ? 'bg-red-100 text-red-700 opacity-100 p-3 min-h-[50px]' : 'opacity-0 max-h-0 min-h-0 p-0 mb-0'
              }`}
              aria-live="polite"
              aria-atomic="true"
            >
              {error === 'Request failed with status code 401' 
                ? 'Invalid email or password. Please try again.' 
                : error || 'Error placeholder'}
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  <Mail className="inline-block w-4 h-4 mr-1 text-[#c1902f]" />
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="
                    block w-full px-4 py-2 mt-1 text-base border border-gray-300 rounded-md
                    focus:outline-none focus:ring-2 focus:ring-[#c1902f] focus:border-transparent
                    placeholder-gray-400
                  "
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  <Lock className="inline-block w-4 h-4 mr-1 text-[#c1902f]" />
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  id="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="
                    block w-full px-4 py-2 mt-1 text-base border border-gray-300 rounded-md
                    focus:outline-none focus:ring-2 focus:ring-[#c1902f] focus:border-transparent
                    placeholder-gray-400
                  "
                  required
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="
                  inline-flex items-center justify-center w-full px-4 py-3 mt-1 text-base font-medium
                  text-white bg-[#c1902f] border border-transparent rounded-md
                  hover:bg-[#d4a43f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#c1902f]
                  transition-colors duration-200 disabled:opacity-50
                "
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            {/* Forgot Password */}
            <div className="mt-4 text-center text-sm">
              <Link to="/forgot-password" className="text-blue-600 hover:underline">
                Forgot Password?
              </Link>
            </div>

            {/* Sign Up Link */}
            <div className="mt-6 text-center text-sm">
              <p className="text-gray-600">Don't have an account?</p>
              <Link
                to="/signup"
                className="font-medium text-blue-600 hover:underline"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginForm;
