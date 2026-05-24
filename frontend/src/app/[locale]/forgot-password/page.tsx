"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReCAPTCHA from "react-google-recaptcha";
import Navbar from "@/components/Navbar";
import { useNavbarChrome } from "@/hooks/useNavbarChrome";
import Footer from "@/components/Footer";
import { useTranslations, useLocale } from "next-intl";
import { authApi } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";

export default function ForgotPasswordPage() {
  const t = useTranslations("forgotPasswordPage");
  const locale = useLocale();
  const chrome = useNavbarChrome();
  const isRTL = locale === "ar";
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error(t("errors.emailRequired"));
      return;
    }
    // When the env-configured site key is present, require a token. Local
    // dev without RECAPTCHA_SITE_KEY skips the check.
    if (RECAPTCHA_SITE_KEY && !recaptchaToken) {
      toast.error(t("errors.recaptchaRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.forgotPassword(email, recaptchaToken ?? undefined);
      toast.success(t("codeSent"));
      router.push(
        `/${locale}/reset-password?email=${encodeURIComponent(email)}`
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("errors.generic");
      toast.error(message);
      recaptchaRef.current?.reset();
      setRecaptchaToken(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-surface-page)]">
      <Navbar siteSettings={chrome.siteSettings} navLinks={chrome.navLinks} footerLinks={chrome.footerLinks} />

      <main
        id="main-content"
        className="flex-1 bg-[var(--color-surface-page)] px-4 py-10 md:px-16 md:py-20"
      >
        <div className="flex items-center justify-center w-full">
          <div
            className="bg-[var(--color-surface-card)] rounded-[24px] overflow-hidden w-full max-w-[1312px] flex flex-col lg:flex-row"
            style={{
              boxShadow:
                "-2px 8px 2px 0px rgba(0,0,0,0), -1px 5px 2px 0px rgba(0,0,0,0.01), -1px 3px 2px 0px rgba(0,0,0,0.03), 0px 1px 1px 0px rgba(0,0,0,0.05), 0px 0px 1px 0px rgba(0,0,0,0.06)",
            }}
          >
            {/* Form Side */}
            <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-[108px] lg:py-[67px]">
              <div
                className="w-full max-w-[400px] bg-[var(--color-surface-card)] rounded-xl p-6"
                dir={isRTL ? "rtl" : "ltr"}
              >
                {/* Back link */}
                <Link
                  href={`/${locale}/signin`}
                  className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-6 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t("backToLogin")}
                </Link>

                {/* Header */}
                <div className="flex flex-col gap-1 mb-6">
                  <h1
                    className="font-semibold text-[var(--color-text-primary)]"
                    style={{ fontSize: "16px", lineHeight: "24px" }}
                  >
                    {t("title")}
                  </h1>
                  <p
                    className="text-[var(--color-text-secondary)]"
                    style={{ fontSize: "14px", lineHeight: "20px" }}
                  >
                    {t("description")}
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1.5 w-full">
                    <label
                      htmlFor="email"
                      className="font-medium text-[var(--color-text-primary)]"
                      style={{ fontSize: "14px", lineHeight: "20px" }}
                    >
                      {t("emailLabel")}
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full min-h-[36px] px-3 py-[7.5px] bg-[var(--color-surface-page)] border border-[var(--color-input-border)] rounded-lg outline-none focus:border-[var(--color-input-focus)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                        fontSize: "14px",
                      }}
                      placeholder={t("emailPlaceholder")}
                    />
                  </div>

                  {RECAPTCHA_SITE_KEY && (
                    <div className="flex justify-center" dir="ltr">
                      <ReCAPTCHA
                        ref={recaptchaRef}
                        sitekey={RECAPTCHA_SITE_KEY}
                        hl={locale === "ar" ? "ar" : "en"}
                        onChange={(token) => setRecaptchaToken(token)}
                        onExpired={() => setRecaptchaToken(null)}
                        onErrored={() => setRecaptchaToken(null)}
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting || (!!RECAPTCHA_SITE_KEY && !recaptchaToken)}
                    className="w-full h-10 px-5 py-2 rounded-xl text-white font-medium text-sm text-center hover:opacity-90 transition-opacity disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{
                      background: isRTL
                        ? "linear-gradient(to left, var(--color-primary), var(--color-primary-dark))"
                        : "linear-gradient(to right, var(--color-primary), var(--color-primary-dark))",
                    }}
                  >
                    {isSubmitting && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    {t("sendCode")}
                  </button>
                </form>
              </div>
            </div>

            {/* Image Side */}
            <div className="hidden lg:flex flex-1 bg-[var(--color-surface-card)] items-center justify-center">
              <div className="relative w-full h-full min-h-[635px]">
                <Image
                  src="/signin_signup_image/signin_signup.svg"
                  alt="Forgot password illustration"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
