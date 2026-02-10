'use client';

import { useAuth } from '@/contexts';
import { Users, BookOpen, DollarSign, TrendingUp, UserPlus, AlertCircle } from 'lucide-react';

export default function AdminDashboard() {
  const { user } = useAuth();

  const stats = [
    { label: 'Total Users', value: '2,456', icon: Users, color: 'bg-blue-500', change: '+12%' },
    { label: 'Active Courses', value: '48', icon: BookOpen, color: 'bg-green-500', change: '+5%' },
    { label: 'Revenue (MTD)', value: '$45,230', icon: DollarSign, color: 'bg-purple-500', change: '+18%' },
    { label: 'Growth Rate', value: '23%', icon: TrendingUp, color: 'bg-orange-500', change: '+3%' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          Admin Dashboard
        </h1>
        <p className="text-white/80">
          Welcome back, {user?.firstName || 'Admin'}. Here&apos;s your system overview.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white rounded-xl p-5 shadow-sm border border-gray-100"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm font-medium text-green-600">{stat.change}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Actions & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-5 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="p-5 grid grid-cols-2 gap-3">
            {[
              { label: 'Add User', icon: UserPlus, color: 'bg-blue-100 text-blue-600' },
              { label: 'New Course', icon: BookOpen, color: 'bg-green-100 text-green-600' },
              { label: 'View Reports', icon: TrendingUp, color: 'bg-purple-100 text-purple-600' },
              { label: 'Manage Roles', icon: Users, color: 'bg-orange-100 text-orange-600' },
            ].map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={index}
                  className={`${action.color} p-4 rounded-lg flex flex-col items-center gap-2 hover:opacity-80 transition-opacity`}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-sm font-medium">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* System Alerts */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-5 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">System Alerts</h2>
          </div>
          <div className="p-5 space-y-3">
            {[
              { message: '5 users pending verification', type: 'warning' },
              { message: 'Database backup completed', type: 'success' },
              { message: '2 courses awaiting approval', type: 'info' },
            ].map((alert, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  alert.type === 'warning'
                    ? 'bg-yellow-50 text-yellow-700'
                    : alert.type === 'success'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-blue-50 text-blue-700'
                }`}
              >
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Users */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Users</h2>
          <button className="text-sm text-[#a37f49] hover:underline">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">User</th>
                <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">Email</th>
                <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">Role</th>
                <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                { name: 'Ahmed Hassan', email: 'ahmed@example.com', role: 'Student', status: 'Active' },
                { name: 'Sara Mohamed', email: 'sara@example.com', role: 'Instructor', status: 'Active' },
                { name: 'Omar Ali', email: 'omar@example.com', role: 'Student', status: 'Pending' },
              ].map((user, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">
                          {user.name.charAt(0)}
                        </span>
                      </div>
                      <span className="font-medium text-gray-900">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-gray-600">{user.email}</td>
                  <td className="px-5 py-4">
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        user.status === 'Active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
