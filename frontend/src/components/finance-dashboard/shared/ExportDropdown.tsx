"use client";

/**
 * Shared "Export" dropdown for finance pages.
 *
 * Replaces the previous trio of inline Excel / CSV / PDF buttons that
 * wrapped awkwardly when sitting next to Refresh / Scan-all on tighter
 * viewports. Renders a single trigger button and a portal-anchored menu
 * with one row per format. Disabled while a download is in flight.
 */

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, FileSpreadsheet, FileText, ChevronDown, Loader2 } from "lucide-react";
import PortalMenu from "./PortalMenu";

interface Props {
  onExport: (format: "csv" | "xlsx" | "pdf") => void | Promise<void>;
  /** Which format is currently downloading, or null when idle. */
  busy: "csv" | "xlsx" | "pdf" | null;
  /** Optional ARIA label override; defaults to the i18n "export.menuLabel". */
  ariaLabel?: string;
}

const ExportDropdown = ({ onExport, busy, ariaLabel }: Props) => {
  const t = useTranslations("financeDashboard");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const handleSelect = async (format: "csv" | "xlsx" | "pdf") => {
    setOpen(false);
    await onExport(format);
  };

  const triggerLabel = busy
    ? t("reportsPage.exportingLabel")
    : t("reportsPage.exportLabel");

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={!!busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="flex items-center gap-1.5 px-3 py-2 h-9 text-sm font-medium text-[var(--color-text-primary)] border border-[var(--color-border)] bg-[var(--color-surface-card)] rounded-lg hover:bg-[var(--color-surface-page)] transition-colors disabled:opacity-60"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        <span>{triggerLabel}</span>
        {!busy && <ChevronDown className="w-3.5 h-3.5 opacity-70" />}
      </button>

      <PortalMenu anchorRef={triggerRef} open={open} onClose={() => setOpen(false)} minWidth={160}>
        <MenuItem
          icon={<FileSpreadsheet className="w-4 h-4 text-[#16A34A]" />}
          label={t("reportsPage.exportExcel")}
          hint=".xlsx"
          onClick={() => handleSelect("xlsx")}
        />
        <MenuItem
          icon={<FileText className="w-4 h-4 text-[#2563EB]" />}
          label={t("reportsPage.exportCsv")}
          hint=".csv"
          onClick={() => handleSelect("csv")}
        />
        <MenuItem
          icon={<Download className="w-4 h-4 text-[#DC2626]" />}
          label={t("reportsPage.exportPdf")}
          hint=".pdf"
          onClick={() => handleSelect("pdf")}
        />
      </PortalMenu>
    </>
  );
};

const MenuItem = ({
  icon, label, hint, onClick,
}: { icon: React.ReactNode; label: string; hint: string; onClick: () => void }) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)] transition-colors text-left"
  >
    {icon}
    <span className="flex-1">{label}</span>
    <span className="text-[11px] text-[var(--color-text-secondary)] font-mono">{hint}</span>
  </button>
);

export default ExportDropdown;
