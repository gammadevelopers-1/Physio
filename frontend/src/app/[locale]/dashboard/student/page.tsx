'use client';

import { useAuth } from '@/contexts';
import { BookOpen, Award, Clock, TrendingUp } from 'lucide-react';

export default function StudentDashboard() {
  const { user } = useAuth();

  const stats = [
    { label: 'Enrolled Courses', value: '4', icon: BookOpen, color: 'bg-blue-500' },
    { label: 'Completed', value: '2', icon: Award, color: 'bg-green-500' },
    { label: 'In Progress', value: '2', icon: Clock, color: 'bg-yellow-500' },
    { label: 'Certificates', value: '2', icon: TrendingUp, color: 'bg-purple-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-[#a37f49] to-[#6b4e24] rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          Welcome back, {user?.firstName || 'Student'}!
        </h1>
        <p className="text-white/80">
          Continue your learning journey. You have 2 courses in progress.
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

      {/* Recent Courses */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Continue Learning</h2>
        </div>
        <div className="p-5 space-y-4">
          {[
            { title: 'Introduction to Physical Therapy', progress: 75, lessons: '15/20' },
            { title: 'Advanced Rehabilitation Techniques', progress: 30, lessons: '6/20' },
          ].map((course, index) => (
            <div
              key={index}
              className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-[#a37f49] to-[#6b4e24] rounded-lg flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">{course.title}</h3>
                <p className="text-sm text-gray-500">{course.lessons} lessons completed</p>
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#a37f49] rounded-full"
                    style={{ width: `${course.progress}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-medium text-[#a37f49]">{course.progress}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
