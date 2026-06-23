"use client";

/**
 * Portal-based popover menu.
 *
 * Renders its children at `document.body` so the menu can escape any
 * ancestor with `overflow-hidden` / `overflow-x-auto` (e.g. table
 * wrappers). Positioning is computed from the trigger button's bounding
 * rect — anchored to the trigger's bottom-end corner by default.
 *
 * Auto-flips above the trigger if it would overflow the viewport bottom,
 * and closes on outside-click + Escape.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "next-intl";

interface Props {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Min width of the popover. */
  minWidth?: number;
}

const PortalMenu = ({ anchorRef, open, onClose, children, minWidth = 170 }: Props) => {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const computePosition = () => {
      const rect = anchorRef.current!.getBoundingClientRect();
      const menuHeight = menuRef.current?.offsetHeight ?? 200;
      const menuWidth = Math.max(minWidth, menuRef.current?.offsetWidth ?? 0);

      // Vertical: anchor bottom; flip above if it would overflow viewport.
      let top = rect.bottom + 4;
      if (top + menuHeight > window.innerHeight - 8) {
        top = rect.top - menuHeight - 4;
        if (top < 8) top = 8;
      }

      // Horizontal: anchor end-corner — right in LTR, left in RTL.
      let left = isRTL
        ? rect.left // RTL: start of dropdown = left of anchor
        : rect.right - menuWidth;
      if (left + menuWidth > window.innerWidth - 8) {
        left = window.innerWidth - menuWidth - 8;
      }
      if (left < 8) left = 8;
      setPos({ top, left });
    };
    computePosition();
    // Re-position on resize/scroll so the menu tracks the trigger when
    // the page scrolls while it's open.
    window.addEventListener("resize", computePosition);
    window.addEventListener("scroll", computePosition, true);
    return () => {
      window.removeEventListener("resize", computePosition);
      window.removeEventListener("scroll", computePosition, true);
    };
  }, [open, anchorRef, isRTL, minWidth]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[1000] bg-[var(--color-surface-card)] rounded-lg shadow-xl border border-[var(--color-border)] py-1"
      style={{
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        minWidth,
        visibility: pos ? "visible" : "hidden",
      }}
      role="menu"
    >
      {children}
    </div>,
    document.body,
  );
};

export default PortalMenu;
