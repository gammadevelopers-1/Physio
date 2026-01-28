"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import Image from "next/image";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, ArrowRight } from "lucide-react";

export default function AboutPage() {
  const t = useTranslations("aboutPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  return (
    <main className="min-h-screen bg-[var(--surface-default)] pb-20 lg:pb-0">
      <Navbar />

      {/* About Hero Section */}
      <section className="bg-[var(--surface-intense)]">
        <div className={`flex flex-col lg:flex-row min-h-[400px] lg:min-h-[600px] ${isRTL ? "lg:flex-row-reverse" : ""}`}>
          {/* Left Content */}
          <div className={`flex-1 bg-[var(--surface-intense)] flex items-center justify-center px-4 py-8 md:px-12 md:py-16 lg:px-16 lg:py-20 order-2 ${isRTL ? "lg:order-2" : "lg:order-1"}`}>
            <div className={`max-w-[480px] w-full ${isRTL ? "text-right" : ""}`}>
              <h1 className="text-[var(--on-surface-default)] mb-4 md:mb-6 text-[36px] lg:text-[60px] font-semibold leading-[100%] tracking-[-0.72px] lg:tracking-[-1.2px]">
                {t("hero.title")}
              </h1>

              <p className="text-[var(--on-surface-default)] mb-6 md:mb-8 text-[18px] lg:text-[20px] font-normal leading-[28px]">
                {t("hero.description")}
              </p>

              {/* Action Buttons */}
              <div className={`flex flex-row items-center gap-[10px] ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
                <Link
                  href={`/${locale}/courses`}
                  className="flex items-center justify-center h-12 px-5 py-2 btn-gold text-[var(--on-surface-inverse)] rounded-xl font-medium transition-colors text-sm md:text-base"
                >
                  {t("hero.exploreButton")}
                </Link>
                <Link
                  href={`/${locale}/get-started`}
                  className="flex items-center justify-center h-12 px-5 py-2 bg-[var(--surface-intense)] text-[var(--on-surface-default)] rounded-xl font-medium border border-[var(--outline-subtle)] transition-colors hover:bg-[var(--surface-container-low)] text-sm md:text-base"
                >
                  {t("hero.getStartedButton")}
                </Link>
              </div>
            </div>
          </div>

          {/* Right Image */}
          <div className={`w-full lg:flex-1 relative h-[434px] lg:h-auto lg:min-h-[600px] order-1 ${isRTL ? "lg:order-1" : "lg:order-2"}`}>
            <Image
              src="/images/image_486_mobile.png"
              alt="Healthcare professionals in training"
              fill
              className="object-cover lg:hidden"
              priority
            />
            <Image
              src="/images/image_485.png"
              alt="Healthcare professionals in training"
              fill
              className="object-cover object-center hidden lg:block"
              priority
            />
            {/* Gradient overlay - horizontal on desktop */}
            <div
              className="absolute inset-0 pointer-events-none hidden lg:block"
              style={{
                background: isRTL
                  ? "linear-gradient(to left, #ffffff 0%, rgba(255,255,255,0.7) 15%, rgba(255,255,255,0) 45%)"
                  : "linear-gradient(to right, #ffffff 0%, rgba(255,255,255,0.7) 15%, rgba(255,255,255,0) 45%)"
              }}
            />
            {/* Gradient overlay - vertical on mobile */}
            <div
              className="absolute inset-0 pointer-events-none lg:hidden"
              style={{
                background: "linear-gradient(to bottom, rgba(255,255,255,0) 60%, rgba(255,255,255,0.8) 85%, #ffffff 100%)"
              }}
            />
          </div>
        </div>
      </section>

      {/* Compliance & Standards Section */}
      <section className="bg-[#EEF3F7] px-4 py-12 md:px-12 md:py-20 lg:px-16 lg:py-24">
        <div className={`flex flex-col items-center justify-center max-w-[800px] mx-auto text-center ${isRTL ? "text-right" : ""}`}>
          <h2 className="text-[var(--on-surface-default)] mb-6 md:mb-8 text-[30px] lg:text-[48px] font-semibold leading-[100%] tracking-[-0.15px] lg:tracking-[-0.24px] text-center w-full">
            {t("compliance.title")}
          </h2>

          <div className="flex flex-col mb-8 md:mb-10">
            <p className="text-[#000] lg:text-[var(--on-surface-variant)] text-[18px] lg:text-[20px] font-normal leading-[28px]">
              {t("compliance.items.item1")}
            </p>
            <p className="text-[#000] lg:text-[var(--on-surface-variant)] text-[18px] lg:text-[20px] font-normal leading-[28px]">
              {t("compliance.items.item2")}
            </p>
            <p className="text-[#000] lg:text-[var(--on-surface-variant)] text-[18px] lg:text-[20px] font-normal leading-[28px]">
              {t("compliance.items.item3")}
            </p>
            <p className="text-[#000] lg:text-[var(--on-surface-variant)] text-[18px] lg:text-[20px] font-normal leading-[28px]">
              {t("compliance.items.item4")}
            </p>
          </div>

          {/* Mobile Button - Full width gold */}
          <Link
            href={`/${locale}/programs`}
            className="w-full lg:w-auto lg:hidden flex items-center justify-center h-12 px-5 py-2 btn-gold rounded-xl font-medium transition-all duration-300 text-white"
          >
            {t("compliance.viewAllButton")}
          </Link>
          {/* Desktop Button - Outlined */}
          <Link
            href={`/${locale}/programs`}
            className="hidden lg:flex items-center justify-center h-12 px-8 py-3 bg-transparent btn-gold rounded-xl font-medium border transition-all duration-300 text-white"
          >
            {t("compliance.viewAllButton")}
          </Link>
        </div>
      </section>

      {/* Learning Experience Section */}
      <section className="bg-[var(--surface-intense)] px-4 py-12 md:px-12 md:py-20 lg:px-16 lg:py-24">
        <div className="flex flex-col items-center justify-center max-w-[1200px] mx-auto">
          <h2 className="text-[var(--on-surface-default)] mb-3 md:mb-4 text-center text-[30px] lg:text-[48px] font-semibold leading-[100%] tracking-[-0.15px] lg:tracking-[-0.24px]">
            {t("learningExperience.title")}
          </h2>

          <p className="text-[var(--on-surface-default)] lg:text-[var(--on-surface-variant)] mb-10 md:mb-14 text-center text-[18px] lg:text-[20px] font-normal leading-[28px]">
            {t("learningExperience.subtitle")}
          </p>

          {/* Cards Grid - Reversed order for RTL */}
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 w-full ${isRTL ? "lg:direction-rtl" : ""}`}>
            {/* Card 1 - Self-paced courses (rightmost in RTL) */}
            <div className={`relative pb-4 ${isRTL ? "lg:order-3" : "lg:order-1"}`}>
              <div className="relative h-[286px] lg:h-[250px] rounded-2xl overflow-hidden shadow-[-2px_8px_2px_0_rgba(0,0,0,0.00),-1px_5px_2px_0_rgba(0,0,0,0.01)] lg:shadow-none">
                <Image
                  src="/images/learning_exp_m1.png"
                  alt="Self-paced learning"
                  fill
                  className="object-cover lg:hidden"
                />
                <Image
                  src="/images/learning_exp1.png"
                  alt="Self-paced learning"
                  fill
                  className="object-cover hidden lg:block"
                />
              </div>
              <div className="relative -mt-12 mx-4 bg-[var(--surface-intense)] rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.08)] border border-[var(--outline-subtle)] p-4 text-center h-[140px] flex flex-col items-center justify-between">
                <h3 className="text-[var(--on-surface-default)] font-semibold text-[20px] leading-normal">
                  {t("learningExperience.cards.selfPaced.title")}
                </h3>
                <Link
                  href={`/${locale}/courses`}
                  className={`inline-flex items-center justify-center gap-2 text-[#a37f49] font-medium hover:opacity-80 transition-opacity h-10 px-5 py-2 rounded-xl text-[14px] ${isRTL ? "flex-row-reverse" : ""}`}
                >
                  {t("learningExperience.readMore")}
                  {isRTL ? (
                    <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                  ) : (
                    <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                  )}
                </Link>
              </div>
            </div>

            {/* Card 2 - Live lectures (middle) */}
            <div className={`relative pb-4 ${isRTL ? "lg:order-2" : "lg:order-2"}`}>
              <div className="relative h-[286px] lg:h-[250px] rounded-2xl overflow-hidden shadow-[-2px_8px_2px_0_rgba(0,0,0,0.00),-1px_5px_2px_0_rgba(0,0,0,0.01)] lg:shadow-none">
                <Image
                  src="/images/learning_exp_m2.png"
                  alt="Zoom-based live lectures"
                  fill
                  className="object-cover lg:hidden"
                />
                <Image
                  src="/images/learning_exp2.png"
                  alt="Zoom-based live lectures"
                  fill
                  className="object-cover hidden lg:block"
                />
              </div>
              <div className="relative -mt-12 mx-4 bg-[var(--surface-intense)] rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.08)] border border-[var(--outline-subtle)] p-4 text-center h-[140px] flex flex-col items-center justify-between">
                <h3 className="text-[var(--on-surface-default)] font-semibold text-[20px] leading-normal">
                  {t("learningExperience.cards.liveLectures.title")}
                </h3>
                <Link
                  href={`/${locale}/workshops`}
                  className={`inline-flex items-center justify-center gap-2 text-[#a37f49] font-medium hover:opacity-80 transition-opacity h-10 px-5 py-2 rounded-xl text-[14px] ${isRTL ? "flex-row-reverse" : ""}`}
                >
                  {t("learningExperience.readMore")}
                  {isRTL ? (
                    <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                  ) : (
                    <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                  )}
                </Link>
              </div>
            </div>

            {/* Card 3 - Digital certificates (leftmost in RTL) */}
            <div className={`relative pb-4 ${isRTL ? "lg:order-1" : "lg:order-3"}`}>
              <div className="relative h-[286px] lg:h-[250px] rounded-2xl overflow-hidden shadow-[-2px_8px_2px_0_rgba(0,0,0,0.00),-1px_5px_2px_0_rgba(0,0,0,0.01)] lg:shadow-none">
                <Image
                  src="/images/learning_exp_m3.png"
                  alt="Digital certificates"
                  fill
                  className="object-cover lg:hidden"
                />
                <Image
                  src="/images/learning_exp3.png"
                  alt="Digital certificates"
                  fill
                  className="object-cover object-top hidden lg:block"
                />
              </div>
              <div className="relative -mt-12 mx-4 bg-[var(--surface-intense)] rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.08)] border border-[var(--outline-subtle)] p-4 text-center h-[140px] flex flex-col items-center justify-between">
                <h3 className="text-[var(--on-surface-default)] font-semibold text-[20px] leading-normal">
                  {t("learningExperience.cards.certificates.title")}
                </h3>
                <Link
                  href={`/${locale}/certificates`}
                  className={`inline-flex items-center justify-center gap-2 text-[#a37f49] font-medium hover:opacity-80 transition-opacity h-10 px-5 py-2 rounded-xl text-[14px] ${isRTL ? "flex-row-reverse" : ""}`}
                >
                  {t("learningExperience.readMore")}
                  {isRTL ? (
                    <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                  ) : (
                    <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                  )}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Capabilities Section */}
      <section className="bg-[#EEF3F7] px-4 py-12 md:px-12 md:py-20 lg:px-16 lg:py-24">
        <div className="flex flex-col items-center justify-center max-w-[1200px] mx-auto">
          <h2 className="text-[var(--on-surface-default)] mb-3 md:mb-4 text-center text-[30px] lg:text-[48px] font-semibold leading-[100%] tracking-[-0.15px] lg:tracking-[-0.24px]">
            {t("platformCapabilities.title")}
          </h2>

          <p className="text-[var(--on-surface-default)] mb-10 md:mb-14 text-center text-[18px] lg:text-[20px] font-normal leading-[28px]">
            {t("platformCapabilities.subtitle")}
          </p>

          {/* Features Grid - First Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-8 w-full mb-5 lg:mb-8">
            {/* Feature 1 - Bilingual Interface (rightmost in RTL) */}
            <div
              className={`flex flex-col items-center bg-white lg:bg-[var(--surface-intense)] rounded-[16px] py-6 px-8 lg:p-8 text-center lg:border lg:border-[var(--outline-subtle)] ${isRTL ? "lg:order-3" : "lg:order-1"}`}
              style={{ boxShadow: "-2px 8px 2px 0 rgba(0,0,0,0.00), -1px 5px 2px 0 rgba(0,0,0,0.01)" }}
            >
              <div className="w-[38px] h-[38px] lg:w-12 lg:h-12 flex items-center justify-center mb-2 lg:mb-4">
                <Image
                  src="/colors.svg"
                  alt="Bilingual Interface"
                  width={38}
                  height={38}
                  className="w-[38px] h-[38px] lg:w-8 lg:h-8"
                />
              </div>
              <h3 className="text-[var(--on-surface-default)] text-[14px] lg:text-[18px] font-semibold mb-2">
                {t("platformCapabilities.features.bilingualInterface.title")}
              </h3>
              <p className="text-[#4A4C4F] text-[14px] font-normal leading-[20px] w-[251px] lg:w-auto">
                {t("platformCapabilities.features.bilingualInterface.description")}
              </p>
            </div>

            {/* Feature 2 - Advanced Dashboards (middle) */}
            <div
              className={`flex flex-col items-center bg-white lg:bg-[var(--surface-intense)] rounded-[16px] py-6 px-8 lg:p-8 text-center lg:border lg:border-[var(--outline-subtle)] ${isRTL ? "lg:order-2" : "lg:order-2"}`}
              style={{ boxShadow: "-2px 8px 2px 0 rgba(0,0,0,0.00), -1px 5px 2px 0 rgba(0,0,0,0.01)" }}
            >
              <div className="w-[38px] h-[38px] lg:w-12 lg:h-12 flex items-center justify-center mb-2 lg:mb-4">
                <Image
                  src="/presentation-chart-01.svg"
                  alt="Advanced Dashboards"
                  width={38}
                  height={38}
                  className="w-[38px] h-[38px] lg:w-8 lg:h-8"
                />
              </div>
              <h3 className="text-[var(--on-surface-default)] text-[14px] lg:text-[18px] font-semibold mb-2">
                {t("platformCapabilities.features.advancedDashboards.title")}
              </h3>
              <p className="text-[#4A4C4F] text-[14px] font-normal leading-[20px] w-[251px] lg:w-auto">
                {t("platformCapabilities.features.advancedDashboards.description")}
              </p>
            </div>

            {/* Feature 3 - Secure Payments (leftmost in RTL) */}
            <div
              className={`flex flex-col items-center bg-white lg:bg-[var(--surface-intense)] rounded-[16px] py-6 px-8 lg:p-8 text-center lg:border lg:border-[var(--outline-subtle)] ${isRTL ? "lg:order-1" : "lg:order-3"}`}
              style={{ boxShadow: "-2px 8px 2px 0 rgba(0,0,0,0.00), -1px 5px 2px 0 rgba(0,0,0,0.01)" }}
            >
              <div className="w-[38px] h-[38px] lg:w-12 lg:h-12 flex items-center justify-center mb-2 lg:mb-4">
                <Image
                  src="/credit-card-shield.svg"
                  alt="Secure Payments"
                  width={38}
                  height={38}
                  className="w-[38px] h-[38px] lg:w-8 lg:h-8"
                />
              </div>
              <h3 className="text-[var(--on-surface-default)] text-[14px] lg:text-[18px] font-semibold mb-2">
                {t("platformCapabilities.features.securePayments.title")}
              </h3>
              <p className="text-[#4A4C4F] text-[14px] font-normal leading-[20px] w-[251px] lg:w-auto">
                {t("platformCapabilities.features.securePayments.description")}
              </p>
            </div>
          </div>

          {/* Features Grid - Second Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-8 w-full">
            {/* Feature 4 - Instructor Management (rightmost in RTL) */}
            <div
              className={`flex flex-col items-center bg-white lg:bg-[var(--surface-intense)] rounded-[16px] py-6 px-8 lg:p-8 text-center lg:border lg:border-[var(--outline-subtle)] ${isRTL ? "lg:order-3" : "lg:order-1"}`}
              style={{ boxShadow: "-2px 8px 2px 0 rgba(0,0,0,0.00), -1px 5px 2px 0 rgba(0,0,0,0.01)" }}
            >
              <div className="w-[38px] h-[38px] lg:w-12 lg:h-12 flex items-center justify-center mb-2 lg:mb-4">
                <Image
                  src="/Icon.svg"
                  alt="Instructor Management"
                  width={38}
                  height={38}
                  className="w-[38px] h-[38px] lg:w-8 lg:h-8"
                />
              </div>
              <h3 className="text-[var(--on-surface-default)] text-[14px] lg:text-[18px] font-semibold mb-2">
                {t("platformCapabilities.features.instructorManagement.title")}
              </h3>
              <p className="text-[#4A4C4F] text-[14px] font-normal leading-[20px] w-[251px] lg:w-auto">
                {t("platformCapabilities.features.instructorManagement.description")}
              </p>
            </div>

            {/* Feature 5 - Reporting & Analytics (middle) */}
            <div
              className={`flex flex-col items-center bg-white lg:bg-[var(--surface-intense)] rounded-[16px] py-6 px-8 lg:p-8 text-center lg:border lg:border-[var(--outline-subtle)] ${isRTL ? "lg:order-2" : "lg:order-2"}`}
              style={{ boxShadow: "-2px 8px 2px 0 rgba(0,0,0,0.00), -1px 5px 2px 0 rgba(0,0,0,0.01)" }}
            >
              <div className="w-[38px] h-[38px] lg:w-12 lg:h-12 flex items-center justify-center mb-2 lg:mb-4">
                <Image
                  src="/clipboard-check.svg"
                  alt="Reporting & Analytics"
                  width={38}
                  height={38}
                  className="w-[38px] h-[38px] lg:w-8 lg:h-8"
                />
              </div>
              <h3 className="text-[var(--on-surface-default)] text-[14px] lg:text-[18px] font-semibold mb-2">
                {t("platformCapabilities.features.reportingAnalytics.title")}
              </h3>
              <p className="text-[#4A4C4F] text-[14px] font-normal leading-[20px] w-[251px] lg:w-auto">
                {t("platformCapabilities.features.reportingAnalytics.description")}
              </p>
            </div>

            {/* Feature 6 - Role-based Access (leftmost in RTL) */}
            <div
              className={`flex flex-col items-center bg-white lg:bg-[var(--surface-intense)] rounded-[16px] py-6 px-8 lg:p-8 text-center lg:border lg:border-[var(--outline-subtle)] ${isRTL ? "lg:order-1" : "lg:order-3"}`}
              style={{ boxShadow: "-2px 8px 2px 0 rgba(0,0,0,0.00), -1px 5px 2px 0 rgba(0,0,0,0.01)" }}
            >
              <div className="w-[38px] h-[38px] lg:w-12 lg:h-12 flex items-center justify-center mb-2 lg:mb-4">
                <Image
                  src="/colors.svg"
                  alt="Role-based Access"
                  width={38}
                  height={38}
                  className="w-[38px] h-[38px] lg:w-8 lg:h-8"
                />
              </div>
              <h3 className="text-[var(--on-surface-default)] text-[14px] lg:text-[18px] font-semibold mb-2">
                {t("platformCapabilities.features.roleBasedAccess.title")}
              </h3>
              <p className="text-[#4A4C4F] text-[14px] font-normal leading-[20px] w-[251px] lg:w-auto">
                {t("platformCapabilities.features.roleBasedAccess.description")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <BottomNav />
    </main>
  );
}
