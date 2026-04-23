"use client";

import { useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthNavbar from "@/components/AuthNavbar";
import Footer from "@/components/Footer";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/contexts";
import { ApiError } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, CheckCircle, Eye, EyeOff } from "lucide-react";


function SignUpForm() {
  const t = useTranslations("signupPage");
  const tToasts = useTranslations("toasts");
  const locale = useLocale();
  const router = useRouter();
  const isRTL = locale === "ar";
  const { register, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [scfhsNumber, setScfhsNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      const msg = tToasts("fillRequiredFields");
      setError(msg);
      toast.error(msg);
      return;
    }

    if (firstName.length < 2 || lastName.length < 2) {
      const msg = tToasts("firstLastNameMinLength");
      setError(msg);
      toast.error(msg);
      return;
    }

    if (password !== confirmPassword) {
      const msg = tToasts("passwordMismatch");
      setError(msg);
      toast.error(msg);
      return;
    }

    if (password.length < 8) {
      const msg = tToasts("passwordMinLength8");
      setError(msg);
      toast.error(msg);
      return;
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      const msg = tToasts("passwordComplexity");
      setError(msg);
      toast.error(msg);
      return;
    }

    if (!acceptTerms) {
      const msg = tToasts("acceptTerms");
      setError(msg);
      toast.error(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        email,
        password,
        firstName,
        lastName,
        ...(scfhsNumber.trim() && { scfhsNumber: scfhsNumber.trim() }),
      });
      setSuccess(true);
      toast.success(tToasts("accountCreated"));
      // Redirect to signin after 2 seconds, preserving redirect param
      setTimeout(() => {
        router.push(`/${locale}/signin${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`);
      }, 2000);
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

  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--surface-intense)]">
        <AuthNavbar />
        <main id="main-content" className="flex-1 bg-[var(--color-surface-page)] flex items-center justify-center px-4 py-10">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              {t("success.title")}
            </h1>
            <p className="text-gray-600 mb-4">
              {t("success.description")}
            </p>
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-intense)]">
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

                {/* Error Message */}
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg" role="alert" aria-live="polite">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  {/* Name Fields */}
                  <div className="flex gap-3">
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label
                        htmlFor="firstName"
                        className="font-medium text-[var(--color-text-primary)]"
                        style={{ fontSize: "14px", lineHeight: "20px" }}
                      >
                        {t("form.firstName")} *
                      </label>
                      <input
                        type="text"
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        disabled={loading}
                        className="w-full min-h-[36px] px-3 py-[7.5px] bg-white border border-[var(--color-border)] rounded-lg outline-none focus:border-[var(--outline-focused)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                          fontSize: "14px"
                        }}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label
                        htmlFor="lastName"
                        className="font-medium text-[var(--color-text-primary)]"
                        style={{ fontSize: "14px", lineHeight: "20px" }}
                      >
                        {t("form.lastName")} *
                      </label>
                      <input
                        type="text"
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        disabled={loading}
                        className="w-full min-h-[36px] px-3 py-[7.5px] bg-white border border-[var(--color-border)] rounded-lg outline-none focus:border-[var(--outline-focused)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                          fontSize: "14px"
                        }}
                        required
                      />
                    </div>
                  </div>

                  {/* SCFHS Registration Number (optional) */}
                  <div className="flex flex-col gap-1.5 w-full">
                    <label
                      htmlFor="scfhsNumber"
                      className="font-medium text-[var(--color-text-primary)]"
                      style={{ fontSize: "14px", lineHeight: "20px" }}
                    >
                      {t("form.scfhsNumber")} <span className="text-[var(--color-text-secondary)] font-normal text-xs">({t("form.optional")})</span>
                    </label>
                    <input
                      type="text"
                      id="scfhsNumber"
                      value={scfhsNumber}
                      onChange={(e) => setScfhsNumber(e.target.value)}
                      disabled={loading}
                      className="w-full min-h-[36px] px-3 py-[7.5px] bg-white border border-[var(--color-border)] rounded-lg outline-none focus:border-[var(--outline-focused)] transition-colors disabled:opacity-50"
                      style={{
                        boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                        fontSize: "14px"
                      }}
                      placeholder={t("form.scfhsPlaceholder")}
                    />
                    <p className="text-xs text-[var(--color-text-secondary)]">{t("form.scfhsHint")}</p>
                  </div>

                  {/* Email Field */}
                  <div className="flex flex-col gap-1.5 w-full">
                    <label
                      htmlFor="email"
                      className="font-medium text-[var(--color-text-primary)]"
                      style={{ fontSize: "14px", lineHeight: "20px" }}
                    >
                      {t("form.email")} *
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className="w-full min-h-[36px] px-3 py-[7.5px] bg-white border border-[var(--color-border)] rounded-lg outline-none focus:border-[var(--outline-focused)] transition-colors disabled:opacity-50"
                      style={{
                        boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                        fontSize: "14px"
                      }}
                      placeholder=""
                      required
                    />
                  </div>

                  {/* Password Field */}
                  <div className="flex flex-col gap-1.5 w-full">
                    <label
                      htmlFor="password"
                      className="font-medium text-[var(--color-text-primary)]"
                      style={{ fontSize: "14px", lineHeight: "20px" }}
                    >
                      {t("form.password")} *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        className="w-full min-h-[36px] px-3 py-[7.5px] pe-10 bg-white border border-[var(--color-border)] rounded-lg outline-none focus:border-[var(--outline-focused)] transition-colors disabled:opacity-50"
                        style={{
                          boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                          fontSize: "14px"
                        }}
                        placeholder=""
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      {t("form.passwordHint")}
                    </p>
                  </div>

                  {/* Confirm Password Field */}
                  <div className="flex flex-col gap-1.5 w-full">
                    <label
                      htmlFor="confirmPassword"
                      className="font-medium text-[var(--color-text-primary)]"
                      style={{ fontSize: "14px", lineHeight: "20px" }}
                    >
                      {t("form.confirmPassword")} *
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={loading}
                        className="w-full min-h-[36px] px-3 py-[7.5px] pe-10 bg-white border border-[var(--color-border)] rounded-lg outline-none focus:border-[var(--outline-focused)] transition-colors disabled:opacity-50"
                        style={{
                          boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                          fontSize: "14px"
                        }}
                        placeholder=""
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Terms Checkbox */}
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => setAcceptTerms(!acceptTerms)}
                      disabled={loading}
                      className={`w-4 h-4 mt-0.5 rounded border ${acceptTerms ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'bg-white border-[var(--color-border)]'} flex items-center justify-center transition-colors shrink-0 disabled:opacity-50`}
                    >
                      {acceptTerms && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                    <span
                      className="font-medium text-[var(--color-text-secondary)]"
                      style={{ fontSize: "14px", lineHeight: "20px" }}
                    >
                      {t("form.acceptTermsPrefix")}{" "}
                      <Link href={`/${locale}/terms`} className="underline text-[var(--color-text-primary)] hover:text-[var(--on-surface-primary)]">
                        {t("form.termsAndConditions")}
                      </Link>
                      {" "}{t("form.and")}{" "}
                      <Link href={`/${locale}/privacy`} className="underline text-[var(--color-text-primary)] hover:text-[var(--on-surface-primary)]">
                        {t("form.privacyPolicy")}
                      </Link>
                      .
                    </span>
                  </div>

                  {/* Register Button */}
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
                    {t("form.register")}
                  </button>

                </form>

                {/* Footer Link */}
                <div className="mt-6 text-center">
                  <span
                    className="text-[var(--color-text-primary)]"
                    style={{ fontSize: "14px", lineHeight: "20px" }}
                  >
                    {t("footer.hasAccount")}{" "}
                  </span>
                  <Link
                    href={`/${locale}/signin${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
                    className="text-[var(--color-text-primary)] underline hover:text-[var(--on-surface-primary)]"
                    style={{ fontSize: "14px", lineHeight: "20px" }}
                  >
                    {t("footer.logIn")}
                  </Link>
                </div>
              </div>
            </div>

            {/* Image Side - Second in DOM (RIGHT in LTR, LEFT in RTL) */}
            <div className="hidden lg:flex flex-1 bg-[var(--color-surface-card)] items-center justify-center">
              <div className="relative w-full h-full min-h-[635px]">
                <Image
                  src="/signin_signup_image/signin_signup.svg"
                  alt="Sign up illustration"
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

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
