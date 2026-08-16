"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { api } from "@/lib/api";

type Status = "loading" | "success" | "error";

export default function CancelDeletionContent() {
  const t = useTranslations("cancelDeletion");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage(t("missingToken"));
      return;
    }
    void (async () => {
      try {
        await api.post("/me/account/cancel-deletion", { token });
        setStatus("success");
      } catch (err) {
        const msg =
          (err as { message?: string })?.message ?? t("genericError");
        setStatus("error");
        setErrorMessage(msg);
      }
    })();
  }, [token, t]);

  return (
    <div
      className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] p-8 text-center"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {status === "loading" && (
        <>
          <Loader2 className="w-10 h-10 mx-auto animate-spin text-[var(--color-primary)] mb-4" />
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
            {t("loadingTitle")}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("loadingBody")}
          </p>
        </>
      )}

      {status === "success" && (
        <>
          <CheckCircle2 className="w-12 h-12 mx-auto text-green-600 mb-4" />
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
            {t("successTitle")}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6">
            {t("successBody")}
          </p>
          <Link
            href={`/${locale}/signin`}
            className="inline-block px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {t("signInButton")}
          </Link>
        </>
      )}

      {status === "error" && (
        <>
          <XCircle className="w-12 h-12 mx-auto text-red-600 mb-4" />
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
            {t("errorTitle")}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6">
            {errorMessage ?? t("genericError")}
          </p>
          <Link
            href={`/${locale}`}
            className="inline-block px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm font-medium hover:bg-[var(--color-border-subtle)] transition-colors"
          >
            {t("homeButton")}
          </Link>
        </>
      )}
    </div>
  );
}
