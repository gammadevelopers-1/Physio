'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { UserMenu } from '@/components/UserMenu';
import { useAuth } from '@/contexts';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Settings,
  BarChart3,
  HelpCircle,
  Menu,
  X,
  Home,
  GraduationCap,
  Briefcase,
  Shield,
  DollarSign,
  HeadphonesIcon,
} from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';

// Role-specific navigation items
const ROLE_NAV_ITEMS: Record<string, { label: string; href: string; icon: React.ElementType }[]> = {
  STUDENT: [
    { label: 'Dashboard', href: '/dashboard/student', icon: LayoutDashboard },
    { label: 'My Courses', href: '/dashboard/student/courses', icon: BookOpen },
    { label: 'Certificates', href: '/dashboard/student/certificates', icon: GraduationCap },
    { label: 'Settings', href: '/dashboard/student/settings', icon: Settings },
  ],
  INSTRUCTOR: [
    { label: 'Dashboard', href: '/dashboard/instructor', icon: LayoutDashboard },
    { label: 'My Courses', href: '/dashboard/instructor/courses', icon: BookOpen },
    { label: 'Students', href: '/dashboard/instructor/students', icon: Users },
    { label: 'Analytics', href: '/dashboard/instructor/analytics', icon: BarChart3 },
    { label: 'Settings', href: '/dashboard/instructor/settings', icon: Settings },
  ],
  MANAGER: [
    { label: 'Dashboard', href: '/dashboard/manager', icon: LayoutDashboard },
    { label: 'Instructors', href: '/dashboard/manager/instructors', icon: Users },
    { label: 'Courses', href: '/dashboard/manager/courses', icon: BookOpen },
    { label: 'Reports', href: '/dashboard/manager/reports', icon: BarChart3 },
    { label: 'Settings', href: '/dashboard/manager/settings', icon: Settings },
  ],
  ADMIN: [
    { label: 'Dashboard', href: '/dashboard/admin', icon: LayoutDashboard },
    { label: 'Users', href: '/dashboard/admin/users', icon: Users },
    { label: 'Courses', href: '/dashboard/admin/courses', icon: BookOpen },
    { label: 'Reports', href: '/dashboard/admin/reports', icon: BarChart3 },
    { label: 'Settings', href: '/dashboard/admin/settings', icon: Settings },
  ],
  FINANCE: [
    { label: 'Dashboard', href: '/dashboard/finance', icon: LayoutDashboard },
    { label: 'Transactions', href: '/dashboard/finance/transactions', icon: DollarSign },
    { label: 'Reports', href: '/dashboard/finance/reports', icon: BarChart3 },
    { label: 'Settings', href: '/dashboard/finance/settings', icon: Settings },
  ],
  SUPPORT: [
    { label: 'Dashboard', href: '/dashboard/support', icon: LayoutDashboard },
    { label: 'Tickets', href: '/dashboard/support/tickets', icon: HelpCircle },
    { label: 'Users', href: '/dashboard/support/users', icon: Users },
    { label: 'Settings', href: '/dashboard/support/settings', icon: Settings },
  ],
  SUPER_ADMIN: [
    { label: 'Dashboard', href: '/dashboard/admin', icon: LayoutDashboard },
    { label: 'Users', href: '/dashboard/admin/users', icon: Users },
    { label: 'Courses', href: '/dashboard/admin/courses', icon: BookOpen },
    { label: 'Reports', href: '/dashboard/admin/reports', icon: BarChart3 },
    { label: 'Settings', href: '/dashboard/admin/settings', icon: Settings },
  ],
};

// Role icons for header
const ROLE_ICONS: Record<string, React.ElementType> = {
  STUDENT: GraduationCap,
  INSTRUCTOR: Users,
  MANAGER: Briefcase,
  ADMIN: Shield,
  FINANCE: DollarSign,
  SUPPORT: HeadphonesIcon,
  SUPER_ADMIN: Shield,
};

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user } = useAuth();
  const locale = useLocale();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeRole = user?.activeRole || 'STUDENT';
  const navItems = ROLE_NAV_ITEMS[activeRole] || ROLE_NAV_ITEMS.STUDENT;
  const RoleIcon = ROLE_ICONS[activeRole] || GraduationCap;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 flex">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          {/* Sidebar Header */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
            <Link href={`/${locale}`} className="flex items-center gap-2">
              <Image
                src="/images/logo.png"
                alt="PhysioGuidance"
                width={40}
                height={40}
                className="object-contain"
              />
              <span className="font-semibold text-gray-900">PhysioGuidance</span>
            </Link>
            <button
              className="lg:hidden p-2 text-gray-500 hover:text-gray-700"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Role Badge */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
              <RoleIcon className="w-4 h-4 text-[#a37f49]" />
              <span className="text-sm font-medium text-gray-700">
                {activeRole.replace('_', ' ')} Dashboard
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const fullHref = `/${locale}${item.href}`;
              const isActive = pathname === fullHref || pathname.startsWith(fullHref + '/');

              return (
                <Link
                  key={item.href}
                  href={fullHref}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-[#a37f49]/10 text-[#a37f49] font-medium'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Back to Home */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
            <Link
              href={`/${locale}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <Home className="w-5 h-5" />
              <span>Back to Home</span>
            </Link>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Top Header */}
          <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
            {/* Mobile Menu Button */}
            <button
              className="lg:hidden p-2 text-gray-500 hover:text-gray-700"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Spacer for desktop */}
            <div className="hidden lg:block" />

            {/* User Menu */}
            <UserMenu />
          </header>

          {/* Page Content */}
          <main className="flex-1 p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
