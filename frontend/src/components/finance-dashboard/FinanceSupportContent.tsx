"use client";

import { useState, type ReactNode } from "react";
import FinanceNavbar from "./FinanceNavbar";
import FinanceSidebar from "./FinanceSidebar";
import FinanceMobileSidebar from "./FinanceMobileSidebar";
import { useAuth } from "@/contexts/AuthContext";
import UserSupportInbox from "@/components/support-shared/UserSupportInbox";
import UserTicketDetail from "@/components/support-shared/UserTicketDetail";

const FinanceSupportContent = () => {
  const { user } = useAuth();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // The Finance dashboard's KPI/profile widgets are still mocked while
  // the dashboard is being built, but the Support tab uses the real
  // signed-in user — tickets land in the real support queue. We pass
  // the auth user to the sidebar so the profile card shows the real
  // name/avatar even though the metric tiles are placeholders.
  const profile = {
    name:
      user && (user.firstName || user.lastName)
        ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
        : user?.email || "",
    email: user?.email || "",
    revenue: "—",
    invoices: 0,
    refundRate: 0,
    avatar: user?.avatar || undefined,
  };

  const renderShell = (children: ReactNode) => (
    <>
      <FinanceNavbar profile={profile} />
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <FinanceSidebar profile={profile} />
            </div>
            <FinanceMobileSidebar profile={profile} />
            <div className="flex-1 min-w-0">{children}</div>
          </div>
        </div>
      </div>
    </>
  );

  if (selectedTicketId) {
    return (
      <UserTicketDetail
        ticketId={selectedTicketId}
        onBack={() => setSelectedTicketId(null)}
        renderShell={renderShell}
      />
    );
  }

  return (
    <UserSupportInbox
      source="finance"
      defaultCategorySlug="payments"
      onOpenTicket={setSelectedTicketId}
      renderShell={renderShell}
    />
  );
};

export default FinanceSupportContent;
