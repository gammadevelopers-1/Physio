"use client";

/**
 * Prompt-then-run helper for anywhere the user triggers an invoice /
 * proforma PDF operation (download, view, resend email, regenerate).
 *
 * Usage in a component:
 *   const { dialogProps, promptForLocale } = useInvoiceLanguage();
 *   const handleDownload = async () => {
 *     const locale = await promptForLocale();
 *     if (!locale) return; // user closed without picking
 *     const { url } = await invoiceApi.getPdfUrl(id, locale);
 *     window.open(url, "_blank");
 *   };
 *   ...
 *   <InvoiceLanguageDialog {...dialogProps} />
 *
 * The prompt fires every call (per Amna's spec — no session memory) so the
 * caller does not need to remember state, and every download becomes
 * intentional.
 */

import { useCallback, useRef, useState } from "react";

export type InvoiceLocale = "en" | "ar";

export function useInvoiceLanguage() {
  const [open, setOpen] = useState(false);
  const resolverRef = useRef<((locale: InvoiceLocale | null) => void) | null>(
    null,
  );

  const promptForLocale = useCallback((): Promise<InvoiceLocale | null> => {
    setOpen(true);
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handlePick = useCallback((locale: InvoiceLocale) => {
    setOpen(false);
    resolverRef.current?.(locale);
    resolverRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    resolverRef.current?.(null);
    resolverRef.current = null;
  }, []);

  return {
    promptForLocale,
    dialogProps: {
      open,
      onPick: handlePick,
      onClose: handleClose,
    },
  };
}
