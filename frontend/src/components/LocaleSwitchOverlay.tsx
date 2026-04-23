"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Full-screen overlay shown during locale (en ↔ ar) switches.
 * Hides the brief RTL/LTR flip flash. Other route changes fall through
 * to the NavigationProgress bar + page-level loading.tsx skeletons.
 *
 * Triggered by calling window.__showLocaleSwitchOverlay() from the
 * locale toggle. Auto-dismisses when pathname changes.
 */
export default function LocaleSwitchOverlay() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    (window as unknown as { __showLocaleSwitchOverlay?: () => void }).__showLocaleSwitchOverlay = () => {
      setVisible(true);
    };
    return () => {
      delete (window as unknown as { __showLocaleSwitchOverlay?: () => void }).__showLocaleSwitchOverlay;
    };
  }, []);

  // Dismiss once the new locale's page has mounted
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-white/80 backdrop-blur-sm"
      style={{ animation: "fadeIn 150ms ease-out" }}
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2
          className="w-10 h-10 animate-spin text-[var(--color-primary)]"
          strokeWidth={2.5}
        />
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
