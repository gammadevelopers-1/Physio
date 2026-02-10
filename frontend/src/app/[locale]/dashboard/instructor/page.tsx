'use client';

import { useAuth } from '@/contexts';
import { BookOpen, Users, Star, DollarSign } from 'lucide-react';

export default function InstructorDashboard() {
  const { user } = useAuth();

  const stats = [
    { label: 'Total Courses', value: '8', icon: BookOpen, color: 'bg-blue-500' },
    { label: 'Total Students', value: '342', icon: Users, color: 'bg-green-500' },
    { label: 'Avg. Rating', value: '4.8', icon: Star, color: 'bg-yellow-500' },
    { label: 'Revenue', value: '$12,450', icon: DollarSign, color: 'bg-purple-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          Welcome back, {user?.firstName || 'Instructor'}!
        </h1>
        <p className="text-white/80">
          You have 15 new student enrollments this week.
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

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Courses */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-5 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">My Courses</h2>
          </div>
          <div className="p-5 space-y-3">
            {[
              { title: 'Physical Therapy Fundamentals', students: 120, rating: 4.9 },
              { title: 'Sports Injury Rehabilitation', students: 85, rating: 4.7 },
              { title: 'Elderly Care Techniques', students: 67, rating: 4.8 },
            ].map((course, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <h3 className="font-medium text-gray-900">{course.title}</h3>
                  <p className="text-sm text-gray-500">{course.students} students</p>
                </div>
                <div className="flex items-center gap-1 text-yellow-500">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="text-sm font-medium">{course.rating}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Enrollments */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-5 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Recent Enrollments</h2>
          </div>
          <div className="p-5 space-y-3">
            {[
              { name: 'Ahmed Hassan', course: 'Physical Therapy Fundamentals', time: '2 hours ago' },
              { name: 'Sara Mohamed', course: 'Sports Injury Rehabilitation', time: '5 hours ago' },
              { name: 'Omar Ali', course: 'Elderly Care Techniques', time: '1 day ago' },
            ].map((enrollment, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 font-medium">
                    {enrollment.name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{enrollment.name}</h3>
                  <p className="text-sm text-gray-500">{enrollment.course}</p>
                </div>
                <span className="text-xs text-gray-400">{enrollment.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
