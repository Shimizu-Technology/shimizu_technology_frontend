// src/shared/components/navigation/MainNavigation.tsx

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth';
import { useAuthStore } from '../../auth';
import { User, LogOut, ShoppingCart, Calendar, Menu as MenuIcon, Settings, ClipboardList, Users } from 'lucide-react';

export function MainNavigation() {
  const { user, logout } = useAuth();
  const { isSuperAdmin, isAdmin, isStaff } = useAuthStore();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const isReservationsApp = location.pathname.startsWith('/reservations');
  const isOrderingApp = !isReservationsApp;

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="text-xl font-bold text-[#0078d4]">
                Shimizu Technology
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                to="/"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  isOrderingApp && location.pathname === '/'
                    ? 'border-[#c1902f] text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Home
              </Link>
              <Link
                to="/menu"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  location.pathname === '/menu'
                    ? 'border-[#c1902f] text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Menu
              </Link>
              <Link
                to="/reservations"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  isReservationsApp && location.pathname === '/reservations'
                    ? 'border-[#c1902f] text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Reservations
              </Link>
              
              {/* Admin Dashboard Link - Only visible to admin and super_admin */}
              {user && (isSuperAdmin() || isAdmin()) && (
                <Link
                  to="/admin"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    location.pathname.startsWith('/admin')
                      ? 'border-[#c1902f] text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  Admin
                </Link>
              )}
              
              {/* Staff Orders Link - Only visible to staff */}
              {user && isStaff() && (
                <Link
                  to="/staff-orders"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    location.pathname === '/staff-orders'
                      ? 'border-[#c1902f] text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  Staff Orders
                </Link>
              )}
            </div>
          </div>

          {/* Right side navigation */}
          <div className="hidden sm:ml-6 sm:flex sm:items-center sm:space-x-4">
            {isOrderingApp && (
              <Link
                to="/cart"
                className="p-2 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              >
                <ShoppingCart className="h-6 w-6" />
              </Link>
            )}

            {isReservationsApp && (
              <Link
                to="/reservations/dashboard"
                className="p-2 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              >
                <Calendar className="h-6 w-6" />
              </Link>
            )}

            {user ? (
              <div className="relative">
                <div className="flex items-center space-x-3">
                  <Link
                    to={isReservationsApp ? '/reservations/profile' : '/profile'}
                    className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    <User className="h-5 w-5 mr-1" />
                    <span>{user.first_name || 'Profile'}</span>
                  </Link>

                  <button
                    onClick={logout}
                    className="p-1 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ) : (
              <Link
                to={isReservationsApp ? '/reservations/login' : '/login'}
                className="text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Sign in
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center sm:hidden">
            <button
              onClick={toggleMenu}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              aria-expanded="false"
            >
              <MenuIcon className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="sm:hidden">
          <div className="pt-2 pb-3 space-y-1">
            <Link
              to="/"
              className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                isOrderingApp && location.pathname === '/'
                  ? 'border-[#c1902f] text-[#c1902f] bg-[#c1902f]/10'
                  : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
              }`}
            >
              Home
            </Link>
            <Link
              to="/menu"
              className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                location.pathname === '/menu'
                  ? 'border-[#c1902f] text-[#c1902f] bg-[#c1902f]/10'
                  : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
              }`}
            >
              Menu
            </Link>
            <Link
              to="/reservations"
              className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                isReservationsApp && location.pathname === '/reservations'
                  ? 'border-[#c1902f] text-[#c1902f] bg-[#c1902f]/10'
                  : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
              }`}
            >
              Reservations
            </Link>
            
            {/* Admin Dashboard Link - Only visible to admin and super_admin */}
            {user && (isSuperAdmin() || isAdmin()) && (
              <Link
                to="/admin"
                className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                  location.pathname.startsWith('/admin')
                    ? 'border-[#c1902f] text-[#c1902f] bg-[#c1902f]/10'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                }`}
              >
                <div className="flex items-center">
                  <Settings className="h-5 w-5 mr-2" />
                  Admin
                </div>
              </Link>
            )}
            
            {/* Staff Orders Link - Only visible to staff */}
            {user && isStaff() && (
              <Link
                to="/staff-orders"
                className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                  location.pathname === '/staff-orders'
                    ? 'border-[#c1902f] text-[#c1902f] bg-[#c1902f]/10'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                }`}
              >
                <div className="flex items-center">
                  <ClipboardList className="h-5 w-5 mr-2" />
                  Staff Orders
                </div>
              </Link>
            )}

            {isOrderingApp && (
              <Link
                to="/cart"
                className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                  location.pathname === '/cart'
                    ? 'border-[#c1902f] text-[#c1902f] bg-[#c1902f]/10'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                }`}
              >
                <div className="flex items-center">
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Cart
                </div>
              </Link>
            )}

            {isReservationsApp && (
              <Link
                to="/reservations/dashboard"
                className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                  location.pathname.includes('/reservations/dashboard')
                    ? 'border-[#c1902f] text-[#c1902f] bg-[#c1902f]/10'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                }`}
              >
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2" />
                  Dashboard
                </div>
              </Link>
            )}
          </div>

          <div className="pt-4 pb-3 border-t border-gray-200">
            {user ? (
              <div className="flex items-center px-4">
                <div className="flex-shrink-0">
                  <User className="h-10 w-10 rounded-full bg-gray-100 p-2" />
                </div>
                <div className="ml-3">
                  <div className="text-base font-medium text-gray-800">
                    {user.first_name} {user.last_name}
                  </div>
                  <div className="text-sm font-medium text-gray-500">{user.email}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <Link
                  to={isReservationsApp ? '/reservations/login' : '/login'}
                  className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                >
                  Sign in
                </Link>
              </div>
            )}

            {user && (
              <div className="mt-3 space-y-1">
                <Link
                  to={isReservationsApp ? '/reservations/profile' : '/profile'}
                  className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                >
                  Your Profile
                </Link>
                
                {/* Admin Settings Link - Only visible to admin and super_admin */}
                {(isSuperAdmin() || isAdmin()) && (
                  <Link
                    to="/admin/settings"
                    className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                  >
                    <div className="flex items-center">
                      <Settings className="h-5 w-5 mr-2" />
                      Admin Settings
                    </div>
                  </Link>
                )}
                
                {/* User Management Link - Only visible to admin and super_admin */}
                {(isSuperAdmin() || isAdmin()) && (
                  <Link
                    to="/admin/users"
                    className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                  >
                    <div className="flex items-center">
                      <Users className="h-5 w-5 mr-2" />
                      User Management
                    </div>
                  </Link>
                )}
                
                <button
                  onClick={logout}
                  className="block w-full text-left px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

export default MainNavigation;
