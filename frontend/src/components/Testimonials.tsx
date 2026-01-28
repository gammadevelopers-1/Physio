"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { ArrowRight, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

const Testimonials = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const t = useTranslations("testimonials");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const testimonials = [
    {
      quote: t("items.item1.quote"),
      name: t("items.item1.name"),
      role: t("items.item1.role"),
    },
    {
      quote: t("items.item2.quote"),
      name: t("items.item2.name"),
      role: t("items.item2.role"),
    },
    {
      quote: t("items.item3.quote"),
      name: t("items.item3.name"),
      role: t("items.item3.role"),
    },
    {
      quote: t("items.item4.quote"),
      name: t("items.item4.name"),
      role: t("items.item4.role"),
    },
    {
      quote: t("items.item5.quote"),
      name: t("items.item5.name"),
      role: t("items.item5.role"),
    },
    {
      quote: t("items.item6.quote"),
      name: t("items.item6.name"),
      role: t("items.item6.role"),
    },
  ];

  // Desktop: 3 per page, Mobile: 1 per page
  const desktopTotalSlides = Math.ceil(testimonials.length / 3);
  const mobileTotalSlides = testimonials.length;

  const handlePrev = () => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : desktopTotalSlides - 1));
  };

  const handleNext = () => {
    setCurrentSlide((prev) => (prev < desktopTotalSlides - 1 ? prev + 1 : 0));
  };

  const handleMobilePrev = () => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : mobileTotalSlides - 1));
  };

  const handleMobileNext = () => {
    setCurrentSlide((prev) => (prev < mobileTotalSlides - 1 ? prev + 1 : 0));
  };

  const visibleTestimonials = testimonials.slice(
    currentSlide * 3,
    currentSlide * 3 + 3
  );

  return (
    <>
      {/* Desktop Testimonials - Only show on large screens (1280px+) */}
      <section className="hidden lg:block px-16 py-24 overflow-hidden">
        <div className="flex flex-col gap-8 items-center justify-center max-w-[1280px] mx-auto w-full">
          {/* Section Title */}
          <div className="flex flex-col gap-6 items-center justify-center max-w-[768px] text-center text-[var(--on-surface-default)]">
            <h2
              className="font-semibold leading-none tracking-[-0.24px] w-[560px]"
              style={{
                fontSize: "var(--typeface-font-styles-heading-h1)",
              }}
            >
              {t("title")}
            </h2>
            <p
              className="leading-7 w-[560px]"
              style={{
                fontSize: "var(--typeface-font-styles-heading-subheading)",
              }}
            >
              {t("description")}
            </p>
          </div>

          {/* Testimonials Card */}
          <div className="bg-[#EEF3F7] rounded-3xl p-8 w-full shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
            <div className="flex items-start justify-between w-full">
              {visibleTestimonials.map((testimonial, index) => (
                <div
                  key={index}
                  className="flex items-start"
                >
                  {/* Testimonial Content */}
                  <div
                    className={`flex flex-col gap-16 w-[350px] overflow-hidden ${isRTL ? "items-start text-right pl-12" : "items-start pr-12"}`}
                  >
                    <p
                      className="text-[var(--on-surface-default)] font-semibold"
                      style={{
                        fontSize: "var(--typeface-font-styles-heading-h5)",
                      }}
                    >
                      {testimonial.quote}
                    </p>

                    <div
                      className="flex flex-col text-[var(--on-surface-variant)] items-start"
                    >
                      <p
                        className="font-semibold"
                        style={{
                          fontSize: "var(--typeface-font-styles-heading-h5)",
                        }}
                      >
                        {testimonial.name}
                      </p>
                      <p
                        className="leading-6"
                        style={{
                          fontSize: "var(--typeface-font-styles-paragraph-text)",
                        }}
                      >
                        {testimonial.role}
                      </p>
                    </div>
                  </div>

                  {/* Divider - hide for last item */}
                  {index < visibleTestimonials.length - 1 && (
                    <div className="w-px h-[249px] bg-[#c8d5e1] self-stretch flex items-center justify-center">
                      <div className="w-px h-full bg-[#c8d5e1]" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between w-full">
            {/* Dots */}
            <div className="flex gap-2 items-center">
              {Array.from({ length: desktopTotalSlides }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    currentSlide === index
                      ? "bg-[var(--surface-container-primary)]"
                      : "bg-[#EEF3F7] "
                  }`}
                />
              ))}
            </div>

            {/* Arrows */}
            <div className="flex gap-4 items-start">
              <button
                onClick={handlePrev}
                className="p-3 bg-[#f9fbfd] border border-[var(--outline-subtle)] rounded-full hover:bg-gray-100 transition-colors"
              >
                {isRTL ? (
                  <ArrowRight className="w-4 h-4 text-[#0b0f17]" strokeWidth={1.5} />
                ) : (
                  <ArrowLeft className="w-4 h-4 text-[#0b0f17]" strokeWidth={1.5} />
                )}
              </button>
              <button
                onClick={handleNext}
                className="p-3 bg-[#f9fbfd] border border-[var(--outline-subtle)] rounded-full hover:bg-gray-100 transition-colors"
              >
                {isRTL ? (
                  <ArrowLeft className="w-4 h-4 text-[#0b0f17]" strokeWidth={1.5} />
                ) : (
                  <ArrowRight className="w-4 h-4 text-[#0b0f17]" strokeWidth={1.5} />
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile/Tablet Testimonials - Show on screens smaller than 1280px */}
      <section className="xl:hidden bg-white px-4 py-10 overflow-hidden relative">
        <div className="flex flex-col gap-5 items-center justify-center max-w-full w-full">
          {/* Section Title */}
          <div className="flex flex-col gap-6 items-center justify-center text-center text-black w-full">
            <h2
              className="font-semibold leading-none tracking-[-0.15px] w-full"
              style={{
                fontSize: "var(--typeface-font-styles-heading-h1)",
              }}
            >
              {t("title")}
            </h2>
            <p
              className="leading-7 w-full"
              style={{
                fontSize: "var(--typeface-font-styles-heading-subheading)",
              }}
            >
              {t("description")}
            </p>
          </div>

          {/* Testimonial Card - Single card on mobile/tablet */}
          <div className="bg-[#EEF3F7] rounded-3xl p-6 w-full shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
            <div
              className={`flex flex-col gap-16 overflow-hidden ${isRTL ? "items-start text-right" : "items-start"}`}
            >
              <p
                className="text-black font-semibold"
                style={{
                  fontSize: "var(--typeface-font-styles-heading-h5)",
                }}
              >
                {testimonials[currentSlide].quote}
              </p>

              <div
                className="flex flex-col text-black items-start"
              >
                <p
                  className="font-semibold"
                  style={{
                    fontSize: "var(--typeface-font-styles-heading-h5)",
                  }}
                >
                  {testimonials[currentSlide].name}
                </p>
                <p
                  className="leading-6"
                  style={{
                    fontSize: "var(--typeface-font-styles-paragraph-text)",
                  }}
                >
                  {testimonials[currentSlide].role}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between w-full">
            {/* Dots */}
            <div className="flex gap-2 items-center">
              {Array.from({ length: mobileTotalSlides }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    currentSlide === index
                      ? "bg-[var(--blue-brand-blue)]"
                      : "bg-[#EEF3F7]"
                  }`}
                />
              ))}
            </div>

            {/* Arrows */}
            <div className="flex gap-4 items-start">
              <button
                onClick={handleMobilePrev}
                className="p-3 rounded-full border border-[var(--outline-subtle)] bg-[#f9fbfd] text-[var(--on-surface-default)]"
              >
                {isRTL ? (
                  <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                ) : (
                  <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
                )}
              </button>
              <button
                onClick={handleMobileNext}
                className="p-3 rounded-full border border-[var(--outline-subtle)] bg-[#f9fbfd] text-[var(--on-surface-default)]"
              >
                {isRTL ? (
                  <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
                ) : (
                  <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                )}
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default Testimonials;
