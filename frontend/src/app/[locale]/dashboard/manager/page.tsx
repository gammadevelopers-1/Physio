'use client';

import { useAuth } from '@/contexts';
import { Users, BookOpen, TrendingUp, Award } from 'lucide-react';

export default function ManagerDashboard() {
  const { user } = useAuth();

  const stats = [
    { label: 'Total Instructors', value: '24', icon: Users, color: 'bg-purple-500' },
    { label: 'Active Courses', value: '48', icon: BookOpen, color: 'bg-blue-500' },
    { label: 'Completion Rate', value: '78%', icon: TrendingUp, color: 'bg-green-500' },
    { label: 'Certifications', value: '156', icon: Award, color: 'bg-yellow-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Manager Dashboard</h1>
        <p className="text-white/80">
          Welcome back, {user?.firstName || 'Manager'}. Here&apos;s your department overview.
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

      {/* Instructors & Courses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Instructors */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-5 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Top Instructors</h2>
          </div>
          <div className="p-5 space-y-4">
            {[
              { name: 'Dr. Ahmed Hassan', courses: 8, students: 342, rating: 4.9 },
              { name: 'Dr. Sara Mohamed', courses: 6, students: 280, rating: 4.8 },
              { name: 'Dr. Omar Ali', courses: 5, students: 195, rating: 4.7 },
            ].map((instructor, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
              >
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 font-medium">
                    {instructor.name.split(' ')[1]?.charAt(0) || instructor.name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{instructor.name}</h3>
                  <p className="text-sm text-gray-500">
                    {instructor.courses} courses • {instructor.students} students
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-yellow-500">
                    <span className="text-sm font-medium">{instructor.rating}</span>
                    <span>★</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Course Performance */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-5 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Course Performance</h2>
          </div>
          <div className="p-5 space-y-4">
            {[
              { name: 'Physical Therapy Basics', enrollments: 120, completion: 85 },
              { name: 'Sports Rehabilitation', enrollments: 98, completion: 72 },
              { name: 'Elderly Care', enrollments: 76, completion: 68 },
            ].map((course, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{course.name}</span>
                  <span className="text-sm text-gray-500">{course.enrollments} enrolled</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${course.completion}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-600">{course.completion}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
