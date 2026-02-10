'use client';

import { useAuth } from '@/contexts';
import { Ticket, Clock, CheckCircle, AlertCircle } from 'lucide-react';

export default function SupportDashboard() {
  const { user } = useAuth();

  const stats = [
    { label: 'Open Tickets', value: '23', icon: Ticket, color: 'bg-blue-500' },
    { label: 'Pending', value: '12', icon: Clock, color: 'bg-yellow-500' },
    { label: 'Resolved Today', value: '18', icon: CheckCircle, color: 'bg-green-500' },
    { label: 'High Priority', value: '5', icon: AlertCircle, color: 'bg-red-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Support Dashboard</h1>
        <p className="text-white/80">
          Welcome back, {user?.firstName || 'Support Agent'}. You have 5 high priority tickets.
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
              <div className="flex items-center gap-4">
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Tickets */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Tickets</h2>
          <button className="text-sm text-[#a37f49] hover:underline">View All</button>
        </div>
        <div className="divide-y divide-gray-100">
          {[
            { id: '#1234', subject: 'Cannot access my course', user: 'Ahmed', priority: 'High', status: 'Open', time: '10 min ago' },
            { id: '#1233', subject: 'Payment issue', user: 'Sara', priority: 'Medium', status: 'Pending', time: '30 min ago' },
            { id: '#1232', subject: 'Certificate not showing', user: 'Omar', priority: 'Low', status: 'Open', time: '1 hour ago' },
            { id: '#1231', subject: 'Video not playing', user: 'Fatima', priority: 'High', status: 'Open', time: '2 hours ago' },
          ].map((ticket, index) => (
            <div
              key={index}
              className="p-5 hover:bg-gray-50 cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-500">{ticket.id}</span>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        ticket.priority === 'High'
                          ? 'bg-red-100 text-red-700'
                          : ticket.priority === 'Medium'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {ticket.priority}
                    </span>
                  </div>
                  <h3 className="font-medium text-gray-900">{ticket.subject}</h3>
                  <p className="text-sm text-gray-500">From: {ticket.user}</p>
                </div>
                <div className="text-right">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      ticket.status === 'Open'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {ticket.status}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">{ticket.time}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
