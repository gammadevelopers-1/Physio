"use client";

import AdminNavbar from "./AdminNavbar";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import LoopedInTickets from "@/components/support-shared/LoopedInTickets";
import { useLocale } from "next-intl";

export default function AdminAssistingSupportContent() {
  const admin = useAdminProfile();
  const locale = useLocale();

  return (
    <>
      <AdminNavbar admin={admin} />
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <AdminSidebar admin={admin} />
            </div>
            <AdminMobileSidebar admin={admin} />
            <div className="flex-1 min-w-0">
              <LoopedInTickets
                detailBasePath={`/${locale}/dashboard/admin/support/tickets`}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
