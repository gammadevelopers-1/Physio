"use client";

import { useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthNavbar from "@/components/AuthNavbar";
import Footer from "@/components/Footer";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/contexts";
import { ApiError } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";


function SignInForm() {
  const t = useTranslations("signinPage");
  const tToasts = useTranslations("toasts");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { login, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError(tToasts("fillAllFields"));
      toast.error(tToasts("fillAllFields"));
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password, redirectTo || undefined);
    } catch (err) {
      const message = err instanceof ApiError
        ? err.message
        : tToasts("genericError");
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const loading = isLoading || isSubmitting;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-surface-page)]">
      <AuthNavbar />

      {/* Main Content */}
      <main id="main-content" className="flex-1 bg-[var(--color-surface-page)] px-4 py-10 md:px-16 md:py-20">
        <div className="flex items-center justify-center w-full">
          {/* Auth Card Container */}
          <div
            className="bg-white rounded-[24px] overflow-hidden w-full max-w-[1312px] flex flex-col lg:flex-row"
            style={{
              boxShadow: "-2px 8px 2px 0px rgba(0,0,0,0), -1px 5px 2px 0px rgba(0,0,0,0.01), -1px 3px 2px 0px rgba(0,0,0,0.03), 0px 1px 1px 0px rgba(0,0,0,0.05), 0px 0px 1px 0px rgba(0,0,0,0.06)"
            }}
          >
            {/* Form Side - First in DOM (LEFT in LTR, RIGHT in RTL) */}
            <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-[108px] lg:py-[67px]">
              <div className="w-full max-w-[400px] bg-white rounded-xl p-6" dir={isRTL ? "rtl" : "ltr"}>
                {/* Header */}
                <div className={`flex flex-col gap-1 mb-6`}>
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

                {/* Error Message */}
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg" role="alert" aria-live="polite">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  {/* Email Field */}
                  <div className="flex flex-col gap-1.5 w-full">
                    <label
                      htmlFor="email"
                      className="font-medium text-[var(--color-text-primary)]"
                      style={{ fontSize: "14px", lineHeight: "20px" }}
                    >
                      {t("form.email")}
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className="w-full min-h-[36px] px-3 py-[7.5px] bg-white border border-[var(--color-border)] rounded-lg outline-none focus:border-[var(--outline-focused)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                        fontSize: "14px"
                      }}
                      placeholder=""
                    />
                  </div>

                  {/* Password Field */}
                  <div className="flex flex-col gap-1.5 w-full">
                    <div className="flex items-center justify-between w-full">
                      <label
                        htmlFor="password"
                        className="font-medium text-[var(--color-text-primary)]"
                        style={{ fontSize: "14px", lineHeight: "20px" }}
                      >
                        {t("form.password")}
                      </label>
                      <Link
                        href={`/${locale}/forgot-password`}
                        className="font-medium text-[var(--color-text-primary)] hover:underline"
                        style={{ fontSize: "14px" }}
                      >
                        {t("form.forgotPassword")}
                      </Link>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        className="w-full min-h-[36px] px-3 py-[7.5px] pe-10 bg-white border border-[var(--color-border)] rounded-lg outline-none focus:border-[var(--outline-focused)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                          fontSize: "14px"
                        }}
                        placeholder=""
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--color-icon)] hover:text-[var(--color-text-secondary)] transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me Checkbox */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRememberMe(!rememberMe)}
                      disabled={loading}
                      className={`w-4 h-4 rounded border ${rememberMe ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'bg-white border-[var(--color-border)]'} flex items-center justify-center transition-colors shrink-0 disabled:opacity-50`}
                    >
                      {rememberMe && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                    <span
                      className="font-medium text-[var(--color-text-secondary)]"
                      style={{ fontSize: "14px", lineHeight: "20px" }}
                    >
                      {t("form.rememberMe")}
                    </span>
                  </div>

                  {/* Login Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-10 px-5 py-2 rounded-xl text-white font-medium text-sm text-center hover:opacity-90 transition-opacity disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{
                      background: isRTL
                        ? "linear-gradient(to left, var(--color-primary), var(--color-primary-dark))"
                        : "linear-gradient(to right, var(--color-primary), var(--color-primary-dark))",
                    }}
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {t("form.login")}
                  </button>

                </form>

                {/* Footer Link */}
                <div className="mt-6 text-center">
                  <span
                    className="text-[var(--color-text-primary)]"
                    style={{ fontSize: "14px", lineHeight: "20px" }}
                  >
                    {t("footer.noAccount")}{" "}
                  </span>
                  <Link
                    href={`/${locale}/signup${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
                    className="text-[var(--color-text-primary)] underline hover:text-[var(--on-surface-primary)]"
                    style={{ fontSize: "14px", lineHeight: "20px" }}
                  >
                    {t("footer.signUp")}
                  </Link>
                </div>
              </div>
            </div>

            {/* Image Side - Second in DOM (RIGHT in LTR, LEFT in RTL) */}
            <div className="hidden lg:flex flex-1 bg-[var(--color-surface-card)] items-center justify-center">
              <div className="relative w-full h-full min-h-[635px]">
                <Image
                  src="/signin_signup_image/signin_signup.svg"
                  alt="Sign in illustration"
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

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
