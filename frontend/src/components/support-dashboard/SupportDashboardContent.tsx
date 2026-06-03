"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

/**
 * Base /dashboard/support route — redirects to the correct sub-role dashboard.
 * Supervisor → /dashboard/support/supervisor
 * Agent → /dashboard/support/agent
 */
const SupportDashboardContent = () => {
  const locale = useLocale();
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    if (user.supportSubRole === "supervisor") {
      router.replace(`/${locale}/dashboard/support/supervisor`);
    } else {
      router.replace(`/${locale}/dashboard/support/agent`);
    }
  }, [user, locale, router]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen bg-[var(--color-surface-page)] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
    </div>
  );
};

export default SupportDashboardContent;
