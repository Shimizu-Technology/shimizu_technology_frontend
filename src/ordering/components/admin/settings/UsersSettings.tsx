// src/ordering/components/admin/settings/UsersSettings.tsx

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import toastUtils from '../../../../shared/utils/toastUtils';
import { UserModal } from './UserModal';
import { SettingsHeader } from '../../../../shared/components/ui';
import { Users } from 'lucide-react';
import { useAuthStore } from '../../../../shared/auth';

interface User {
  id: number;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

type RoleFilter = 'all' | 'super_admin' | 'admin' | 'staff' | 'customer';

// For sorting
type SortBy = 'created_at' | 'email';
type SortDir = 'asc' | 'desc';

interface UsersSettingsProps {
  restaurantId?: string;
}

export function UsersSettings({ restaurantId }: UsersSettingsProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const isSuperAdmin = useAuthStore(state => state.isSuperAdmin());

  // For editing
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<RoleFilter>('all');

  // Sorting
  const [sortBy, setSortBy] = useState<SortBy>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const perPage = 10; // or 20, etc.

  useEffect(() => {
    fetchUsers();
  }, [searchTerm, filterRole, sortBy, sortDir, page]);

  interface UsersResponse {
    users: User[];
    total_count: number;
    page: number;
    per_page: number;
  }

  async function fetchUsers() {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterRole !== 'all') params.append('role', filterRole);

      // Add a parameter to exclude super_admin users for non-super_admin users
      if (!isSuperAdmin) {
        params.append('exclude_super_admin', 'true');
      }

      params.append('page', String(page));
      params.append('per_page', String(perPage));
      params.append('sort_by', sortBy);
      params.append('sort_dir', sortDir);

      const url = `/admin/users?${params.toString()}`;
      const data = await api.get<UsersResponse>(url);

      // data = { users, total_count, page, per_page }
      setUsers(data.users);
      setTotalCount(data.total_count);
    } catch (error) {
      console.error(error);
      toastUtils.error('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }

  function handleUserClick(user: User) {
    // Prevent non-super_admin users from editing super_admin users
    if (user.role === 'super_admin' && !isSuperAdmin) {
      toastUtils.error('You do not have permission to edit Super Admin users.');
      return;
    }
    
    setIsCreateMode(false);
    setSelectedUser(user);
    setShowModal(true);
  }

  function handleCreateNewUser() {
    setIsCreateMode(true);
    setSelectedUser(null);
    setShowModal(true);
  }

  function handleModalClose(didChange: boolean) {
    setShowModal(false);
    setSelectedUser(null);
    if (didChange) {
      // re-fetch data
      fetchUsers();
    }
  }

  // Pagination helpers
  const totalPages = Math.ceil(totalCount / perPage);

  function handlePrevPage() {
    if (page > 1) setPage(page - 1);
  }

  function handleNextPage() {
    if (page < totalPages) setPage(page + 1);
  }

  // Helper for date formatting
  function formatDate(dateStr: string) {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'long',
    }).format(new Date(dateStr));
    // e.g. "February 21, 2025"
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <SettingsHeader 
        title="User Management"
        description="Manage users and their access to the system."
        icon={<Users className="h-6 w-6" />}
      />
      
      {/* Controls section - mobile optimized */}
      <div className="space-y-4 mb-4">
        {/* Search input - full width on mobile */}
        <div className="w-full">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => {
              setPage(1); // reset to page 1
              setSearchTerm(e.target.value);
            }}
            className="border border-gray-300 rounded-md px-3 py-2
                       text-sm focus:outline-none focus:ring-1 
                       focus:ring-[#c1902f] w-full transition-colors duration-200"
          />
        </div>
        
        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Role filter */}
          <select
            value={filterRole}
            onChange={(e) => {
              setPage(1);
              setFilterRole(e.target.value as RoleFilter);
            }}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm
                       focus:outline-none focus:ring-1 focus:ring-[#c1902f] flex-1 min-w-[120px]
                       transition-colors duration-200"
          >
            <option value="all">All Roles</option>
            {isSuperAdmin && <option value="super_admin">Super Admin</option>}
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
            <option value="customer">Customer</option>
          </select>

          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as SortBy);
              setPage(1);
            }}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm 
                       focus:outline-none focus:ring-1 focus:ring-[#c1902f] flex-1 min-w-[120px]
                       transition-colors duration-200"
          >
            <option value="created_at">Sort: Date Created</option>
            <option value="email">Sort: Email</option>
          </select>

          <select
            value={sortDir}
            onChange={(e) => {
              setSortDir(e.target.value as SortDir);
              setPage(1);
            }}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm
                       focus:outline-none focus:ring-1 focus:ring-[#c1902f] w-20
                       transition-colors duration-200"
          >
            <option value="desc">DESC</option>
            <option value="asc">ASC</option>
          </select>
        </div>

        {/* Create User Button - full width on mobile */}
        <button
          onClick={handleCreateNewUser}
          className="w-full sm:w-auto px-4 py-2 bg-[#c1902f] text-white rounded-md hover:bg-[#d4a43f]
                     text-sm transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
        >
          + Create New User
        </button>
      </div>

      {/* Users Table - with responsive design */}
      {loading ? (
        // Skeleton loader for the table
        <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-x-auto animate-fadeIn">
          <div className="min-w-full text-sm">
            <div className="bg-gray-50 border-b border-gray-200 p-3">
              <div className="grid grid-cols-4 gap-4">
                <div className="h-5 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-5 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-5 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-5 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
            <div className="divide-y divide-gray-200">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="p-3 animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="h-5 bg-gray-200 rounded"></div>
                    <div className="h-5 bg-gray-200 rounded"></div>
                    <div className="h-5 bg-gray-200 rounded"></div>
                    <div className="h-5 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-x-auto animate-fadeIn">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 hidden sm:table-cell">
                  Email
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">
                  Role
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 hidden md:table-cell">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => {
                const fullName =
                  user.first_name || user.last_name
                    ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
                    : '—';

                return (
                  <tr
                    key={user.id}
                    onClick={() => handleUserClick(user)}
                    className="hover:bg-gray-50 cursor-pointer border-b last:border-b-0 transition-colors duration-150 animate-fadeIn"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{fullName}</div>
                      {/* Show email on mobile when email column is hidden */}
                      <div className="text-xs text-gray-500 sm:hidden">{user.email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 hidden sm:table-cell">{user.email}</td>
                    <td className="px-4 py-3 capitalize text-gray-600">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 transition-colors duration-200">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                      {formatDate(user.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* If no users found */}
          {users.length === 0 && (
            <div className="p-4 text-center text-gray-500 text-sm">
              No users found.
            </div>
          )}
        </div>
      )}

      {/* Pagination Controls - mobile friendly */}
      <div className="flex flex-col sm:flex-row justify-between items-center mt-4 text-sm gap-2">
        <div className="text-gray-600 w-full sm:w-auto text-center sm:text-left">
          Page {page} of {Math.max(totalPages, 1)}
        </div>
        <div className="flex justify-center w-full sm:w-auto space-x-2">
          <button
            onClick={handlePrevPage}
            disabled={page <= 1}
            className="px-4 py-2 border rounded-md disabled:opacity-50 w-24 transition-colors duration-200 hover:bg-gray-50"
          >
            Prev
          </button>
          <button
            onClick={handleNextPage}
            disabled={page >= totalPages}
            className="px-4 py-2 border rounded-md disabled:opacity-50 w-24 transition-colors duration-200 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="animate-fadeIn">
          <UserModal
            user={selectedUser}
            isCreateMode={isCreateMode}
            onClose={handleModalClose}
            restaurantId={restaurantId}
          />
        </div>
      )}
    </div>
  );
}
