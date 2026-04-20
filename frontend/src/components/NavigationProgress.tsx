"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Thin gold progress bar at the top of the viewport.
 * Animates whenever any route change happens (click, router.push, locale switch).
 *
 * Uses a global click listener on <a> tags + pathname-effect to complete the bar
 * when the new page finishes rendering. Zero dependencies.
 */
export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  // Listen for any link click that will cause client-side navigation
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;

      // Ignore external links, hash-only, mailto/tel, and new-tab clicks
      const isSameOrigin = href.startsWith("/") && !href.startsWith("//");
      const isHashOnly = href.startsWith("#");
      const isNewTab = e.metaKey || e.ctrlKey || e.shiftKey || anchor.target === "_blank";
      if (!isSameOrigin || isHashOnly || isNewTab) return;

      startProgress();
    };

    window.addEventListener("click", handleLinkClick);
    return () => window.removeEventListener("click", handleLinkClick);
  }, []);

  // Also expose a global hook so components (e.g. locale switcher) can trigger it
  useEffect(() => {
    (window as unknown as { __navProgressStart?: () => void }).__navProgressStart = startProgress;
    return () => {
      delete (window as unknown as { __navProgressStart?: () => void }).__navProgressStart;
    };
  }, []);

  // Complete the bar when the path (or query) actually changes
  useEffect(() => {
    if (!visible) return;
    completeProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams?.toString()]);

  function startProgress() {
    setVisible(true);
    setProgress(0);
    // Ramp up quickly to ~80% to show activity
    requestAnimationFrame(() => setProgress(20));
    setTimeout(() => setProgress(60), 150);
    setTimeout(() => setProgress(80), 400);
  }

  function completeProgress() {
    setProgress(100);
    setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 250);
  }

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms ease-out" }}
    >
      <div
        className="h-full bg-[var(--gold-gold-500)] shadow-[0_0_8px_rgba(212,165,32,0.6)]"
        style={{
          width: `${progress}%`,
          transition: "width 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
    </div>
  );
}
