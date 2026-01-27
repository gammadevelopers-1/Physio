"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import AuthNavbar from "@/components/AuthNavbar";
import Footer from "@/components/Footer";

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.8055 10.0415C19.8055 9.40083 19.7499 8.80083 19.6499 8.21667H10.2055V11.8417H15.6055C15.3888 12.97 14.7277 13.9234 13.7444 14.5617V16.8192H16.8999C18.7055 15.1525 19.8055 12.7359 19.8055 10.0415Z" fill="#4285F4"/>
    <path d="M10.2055 19.0001C12.9055 19.0001 15.1722 18.1042 16.8999 16.8192L13.7444 14.5617C12.8999 15.1017 11.8222 15.4201 10.2055 15.4201C7.59444 15.4201 5.38333 13.7367 4.63889 11.4H1.38333V13.7267C3.10556 17.0851 6.38889 19.0001 10.2055 19.0001Z" fill="#34A853"/>
    <path d="M4.63889 11.4C4.22778 10.27 4.22778 9.03167 4.63889 7.90167V5.575H1.38333C-0.0166667 8.27833 -0.0166667 11.0233 1.38333 13.7267L4.63889 11.4Z" fill="#FBBC05"/>
    <path d="M10.2055 4.57998C11.9055 4.55498 13.5499 5.19665 14.7944 6.38665L16.9666 4.21498C15.0888 2.46498 12.6944 1.49331 10.2055 1.51831C6.38889 1.51831 3.10556 3.43331 1.38333 6.79165L4.63889 9.11831C5.38333 6.78165 7.59444 5.09831 10.2055 4.57998Z" fill="#EA4335"/>
  </svg>
);

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle sign up logic here
    console.log({ email, password, confirmPassword, acceptTerms });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-intense)]">
      <AuthNavbar />

      {/* Main Content */}
      <main className="flex-1 bg-[#EEF3F7] px-4 py-10 md:px-16 md:py-20">
        <div className="flex items-center justify-center w-full">
          {/* Auth Card Container */}
          <div
            className="bg-white rounded-[24px] overflow-hidden w-full max-w-[1312px] flex flex-col lg:flex-row"
            style={{
              boxShadow: "-2px 8px 2px 0px rgba(0,0,0,0), -1px 5px 2px 0px rgba(0,0,0,0.01), -1px 3px 2px 0px rgba(0,0,0,0.03), 0px 1px 1px 0px rgba(0,0,0,0.05), 0px 0px 1px 0px rgba(0,0,0,0.06)"
            }}
          >
            {/* Left Side - Form */}
            <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-[108px] lg:py-[67px]">
              <div className="w-full max-w-[400px] bg-white rounded-xl p-6">
                {/* Header */}
                <div className="flex flex-col gap-1 mb-6">
                  <h1
                    className="font-semibold text-[#171717]"
                    style={{ fontSize: "16px", lineHeight: "24px" }}
                  >
                    Sign up/Register
                  </h1>
                  <p
                    className="text-[#737373]"
                    style={{ fontSize: "14px", lineHeight: "20px" }}
                  >
                    Register new account.
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  {/* Email Field */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="email"
                      className="font-medium text-[#0a0a0a]"
                      style={{ fontSize: "14px", lineHeight: "20px" }}
                    >
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full min-h-[36px] px-3 py-[7.5px] bg-white border border-[#e5e5e5] rounded-lg outline-none focus:border-[var(--outline-focused)] transition-colors"
                      style={{
                        boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                        fontSize: "14px"
                      }}
                      placeholder=""
                    />
                  </div>

                  {/* Password Field */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="password"
                      className="font-medium text-[#0a0a0a]"
                      style={{ fontSize: "14px", lineHeight: "20px" }}
                    >
                      Password
                    </label>
                    <input
                      type="password"
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full min-h-[36px] px-3 py-[7.5px] bg-white border border-[#e5e5e5] rounded-lg outline-none focus:border-[var(--outline-focused)] transition-colors"
                      style={{
                        boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                        fontSize: "14px"
                      }}
                      placeholder=""
                    />
                  </div>

                  {/* Confirm Password Field */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="confirmPassword"
                      className="font-medium text-[#0a0a0a]"
                      style={{ fontSize: "14px", lineHeight: "20px" }}
                    >
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full min-h-[36px] px-3 py-[7.5px] bg-white border border-[#e5e5e5] rounded-lg outline-none focus:border-[var(--outline-focused)] transition-colors"
                      style={{
                        boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                        fontSize: "14px"
                      }}
                      placeholder=""
                    />
                  </div>

                  {/* Terms Checkbox */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAcceptTerms(!acceptTerms)}
                      className={`w-4 h-4 rounded border ${acceptTerms ? 'bg-[#a37f49] border-[#a37f49]' : 'bg-white border-[#d5d7da]'} flex items-center justify-center transition-colors shrink-0`}
                    >
                      {acceptTerms && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                    <span
                      className="font-medium text-[#414651]"
                      style={{ fontSize: "14px", lineHeight: "20px" }}
                    >
                      I accept{" "}
                      <Link href="/terms" className="underline text-[#06080b] hover:text-[var(--on-surface-primary)]">
                        Terms & Conditions
                      </Link>
                      {" "}and{" "}
                      <Link href="/privacy" className="underline text-[#06080b] hover:text-[var(--on-surface-primary)]">
                        Privacy Policy
                      </Link>
                      .
                    </span>
                  </div>

                  {/* Register Button */}
                  <button
                    type="submit"
                    className="w-full h-10 px-5 py-2 rounded-xl text-white font-medium text-sm text-center btn-gold hover:opacity-90 transition-opacity"
                  >
                    Register
                  </button>

                  {/* Sign in with Google */}
                  <button
                    type="button"
                    className="w-full h-10 px-4 py-2.5 bg-white border border-[#d5d7da] rounded-xl flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors"
                    style={{ boxShadow: "0px 1px 2px 0px rgba(10,13,18,0.05)" }}
                  >
                    <GoogleIcon />
                    <span
                      className="font-medium text-[#414651]"
                      style={{ fontSize: "14px" }}
                    >
                      Sign in with Google
                    </span>
                  </button>
                </form>

                {/* Footer Link */}
                <div className="mt-6 text-center">
                  <span
                    className="text-[#171717]"
                    style={{ fontSize: "14px", lineHeight: "20px" }}
                  >
                    Already have an account?{" "}
                  </span>
                  <Link
                    href="/signin"
                    className="text-[#171717] underline hover:text-[var(--on-surface-primary)]"
                    style={{ fontSize: "14px", lineHeight: "20px" }}
                  >
                    Log in
                  </Link>
                </div>
              </div>
            </div>

            {/* Right Side - Image */}
            <div className="hidden lg:flex flex-1 bg-[#e5edf4] items-center justify-center">
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
