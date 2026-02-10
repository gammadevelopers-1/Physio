'use client';

import { useAuth } from '@/contexts';
import { DollarSign, TrendingUp, CreditCard, Receipt, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function FinanceDashboard() {
  const { user } = useAuth();

  const stats = [
    { label: 'Total Revenue', value: '$125,430', icon: DollarSign, color: 'bg-green-500', change: '+12%', positive: true },
    { label: 'Monthly Revenue', value: '$45,230', icon: TrendingUp, color: 'bg-blue-500', change: '+8%', positive: true },
    { label: 'Pending Payments', value: '$3,450', icon: CreditCard, color: 'bg-yellow-500', change: '-5%', positive: false },
    { label: 'Refunds', value: '$890', icon: Receipt, color: 'bg-red-500', change: '-2%', positive: true },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Finance Dashboard</h1>
        <p className="text-white/80">
          Welcome back, {user?.firstName || 'Finance Manager'}. Here&apos;s your financial overview.
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
                <div className={`flex items-center gap-1 text-sm font-medium ${stat.positive ? 'text-green-600' : 'text-red-600'}`}>
                  {stat.positive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  {stat.change}
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
          <button className="text-sm text-[#a37f49] hover:underline">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">Transaction</th>
                <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">User</th>
                <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">Amount</th>
                <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                { id: 'TXN001', user: 'Ahmed Hassan', amount: '$299', status: 'Completed', date: 'Today' },
                { id: 'TXN002', user: 'Sara Mohamed', amount: '$499', status: 'Completed', date: 'Yesterday' },
                { id: 'TXN003', user: 'Omar Ali', amount: '$199', status: 'Pending', date: 'Yesterday' },
                { id: 'TXN004', user: 'Fatima Ahmed', amount: '$399', status: 'Completed', date: '2 days ago' },
              ].map((txn, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-5 py-4 font-medium text-gray-900">{txn.id}</td>
                  <td className="px-5 py-4 text-gray-600">{txn.user}</td>
                  <td className="px-5 py-4 font-medium text-gray-900">{txn.amount}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        txn.status === 'Completed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {txn.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-gray-500">{txn.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
