'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts';
import { adminApi, User } from '@/lib/api';
import { Search, MoreVertical, Shield, Mail, Loader2, RefreshCw, X, Plus, Trash2 } from 'lucide-react';

const ALL_ROLES = ['STUDENT', 'INSTRUCTOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN', 'FINANCE', 'SUPPORT'];

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Role management modal
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.getUsers();
      setUsers(data);
    } catch (err) {
      setError('Failed to load users. Make sure you have admin privileges.');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openRoleModal = (user: User) => {
    setSelectedUser(user);
    setRoleModalOpen(true);
    setRoleError(null);
  };

  const closeRoleModal = () => {
    setSelectedUser(null);
    setRoleModalOpen(false);
    setRoleError(null);
  };

  const handleAddRole = async (role: string) => {
    if (!selectedUser) return;

    try {
      setRoleLoading(true);
      setRoleError(null);
      await adminApi.assignRole(selectedUser.id, role);

      // Update local state
      const updatedRoles = [...selectedUser.roles, role];
      setSelectedUser({ ...selectedUser, roles: updatedRoles });
      setUsers(users.map(u =>
        u.id === selectedUser.id ? { ...u, roles: updatedRoles } : u
      ));
    } catch (err: any) {
      setRoleError(err.message || 'Failed to add role');
    } finally {
      setRoleLoading(false);
    }
  };

  const handleRemoveRole = async (role: string) => {
    if (!selectedUser) return;

    // Prevent removing the last role
    if (selectedUser.roles.length <= 1) {
      setRoleError('User must have at least one role');
      return;
    }

    try {
      setRoleLoading(true);
      setRoleError(null);
      await adminApi.removeRole(selectedUser.id, role);

      // Update local state
      const updatedRoles = selectedUser.roles.filter(r => r !== role);
      setSelectedUser({ ...selectedUser, roles: updatedRoles });
      setUsers(users.map(u =>
        u.id === selectedUser.id ? { ...u, roles: updatedRoles } : u
      ));
    } catch (err: any) {
      setRoleError(err.message || 'Failed to remove role');
    } finally {
      setRoleLoading(false);
    }
  };

  // Filter users based on search and filters
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !searchQuery ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.firstName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (u.lastName?.toLowerCase() || '').includes(searchQuery.toLowerCase());

    const matchesRole = !roleFilter || u.roles.includes(roleFilter);

    const matchesStatus =
      !statusFilter ||
      (statusFilter === 'Active' && u.isActive) ||
      (statusFilter === 'Inactive' && !u.isActive) ||
      (statusFilter === 'Verified' && u.isVerified) ||
      (statusFilter === 'Unverified' && !u.isVerified);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getUserInitials = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.firstName) {
      return user.firstName.slice(0, 2).toUpperCase();
    }
    return user.email.slice(0, 2).toUpperCase();
  };

  const getUserDisplayName = (user: User) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email.split('@')[0];
  };

  const getAvailableRoles = (user: User) => {
    return ALL_ROLES.filter(role => !user.roles.includes(role));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#a37f49]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchUsers}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500">{users.length} total users</p>
        </div>
        <button
          onClick={fetchUsers}
          className="flex items-center gap-2 px-4 py-2 bg-[#a37f49] text-white rounded-lg hover:bg-[#8a6b3d] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#a37f49]"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#a37f49]"
          >
            <option value="">All Roles</option>
            <option value="STUDENT">Student</option>
            <option value="INSTRUCTOR">Instructor</option>
            <option value="MANAGER">Manager</option>
            <option value="ADMIN">Admin</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="FINANCE">Finance</option>
            <option value="SUPPORT">Support</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#a37f49]"
          >
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Verified">Verified</option>
            <option value="Unverified">Unverified</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">User</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Roles</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Joined</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#a37f49]/10 rounded-full flex items-center justify-center">
                          <span className="text-[#a37f49] font-medium">
                            {getUserInitials(u)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{getUserDisplayName(u)}</p>
                          <p className="text-sm text-gray-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((role) => (
                          <span
                            key={role}
                            className={`px-2 py-1 text-xs rounded-full ${
                              role === u.activeRole
                                ? 'bg-[#a37f49]/20 text-[#a37f49] font-medium'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {role}
                            {role === u.activeRole && ' (active)'}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-block px-2 py-1 text-xs rounded-full w-fit ${
                            u.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {u.isVerified && (
                          <span className="inline-block px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 w-fit">
                            Verified
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          title="Manage Roles"
                          onClick={() => openRoleModal(u)}
                          className="p-2 text-gray-400 hover:text-[#a37f49] hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                        <button
                          title="Send Email"
                          className="p-2 text-gray-400 hover:text-[#a37f49] hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                        <button
                          title="More Options"
                          className="p-2 text-gray-400 hover:text-[#a37f49] hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {filteredUsers.length} of {users.length} users
          </p>
        </div>
      </div>

      {/* Role Management Modal */}
      {roleModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Manage Roles</h2>
                <p className="text-sm text-gray-500">{getUserDisplayName(selectedUser)}</p>
              </div>
              <button
                onClick={closeRoleModal}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Error Message */}
              {roleError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{roleError}</p>
                </div>
              )}

              {/* Current Roles */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Current Roles</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedUser.roles.map((role) => (
                    <div
                      key={role}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
                        role === selectedUser.activeRole
                          ? 'bg-[#a37f49]/20 text-[#a37f49]'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      <span className="text-sm font-medium">{role}</span>
                      {role === selectedUser.activeRole && (
                        <span className="text-xs">(active)</span>
                      )}
                      <button
                        onClick={() => handleRemoveRole(role)}
                        disabled={roleLoading || selectedUser.roles.length <= 1}
                        className="p-0.5 hover:bg-black/10 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        title={selectedUser.roles.length <= 1 ? 'Cannot remove last role' : 'Remove role'}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add Roles */}
              {getAvailableRoles(selectedUser).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Add Role</h3>
                  <div className="flex flex-wrap gap-2">
                    {getAvailableRoles(selectedUser).map((role) => (
                      <button
                        key={role}
                        onClick={() => handleAddRole(role)}
                        disabled={roleLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:border-[#a37f49] hover:text-[#a37f49] transition-colors disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {role}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading Indicator */}
              {roleLoading && (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="w-5 h-5 animate-spin text-[#a37f49]" />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end p-6 border-t border-gray-100">
              <button
                onClick={closeRoleModal}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
