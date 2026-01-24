"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

const Testimonials = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const testimonials = [
    {
      quote:
        '"The training was well-structured and directly applicable to our clinical practice. The content was aligned with current standards, and the instructors demonstrated strong clinical experience."',
      name: "Dr. Ahmed Al-Qahtani",
      role: "Consultant, Public Hospital",
    },
    {
      quote:
        '"What stood out was the clarity of the material and the practical focus. The program helped reinforce critical protocols and provided accredited CME hours without compromising quality."',
      name: "Sara Al-Harthi",
      role: "Senior Nursing Specialist",
    },
    {
      quote:
        '"The platform offers a reliable learning environment that meets national training requirements. It is suitable for both individual professionals and institutional training initiatives."',
      name: "Faisal Al-Mutairi",
      role: "Healthcare Education Institute",
    },
    {
      quote:
        '"An exceptional training experience that exceeded our expectations. The curriculum is comprehensive and the instructors bring real-world expertise that enriches every session."',
      name: "Dr. Layla Al-Rashid",
      role: "Medical Director, Private Clinic",
    },
    {
      quote:
        '"The certification process was seamless and the course materials were of the highest quality. I highly recommend this platform for any healthcare professional seeking accredited training."',
      name: "Mohammed Al-Zahrani",
      role: "Clinical Pharmacist",
    },
    {
      quote:
        '"Outstanding support from the team and excellent course structure. The interactive modules made learning engaging and the practical assessments ensured we could apply knowledge immediately."',
      name: "Noura Al-Otaibi",
      role: "Head Nurse, Regional Hospital",
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
  
  const visibleTestimonials = testimonials.slice(currentSlide * 3, currentSlide * 3 + 3);

  return (
    <>
      {/* Desktop Testimonials - Only show on large screens (1280px+) */}
      <section className="hidden xl:block bg-[var(--surface-intense)] px-16 py-24 overflow-hidden">
        <div className="flex flex-col gap-8 items-center justify-center max-w-[1280px] mx-auto w-full">
          {/* Section Title */}
          <div className="flex flex-col gap-6 items-center justify-center max-w-[768px] text-center text-[var(--on-surface-default)]">
            <h2
              className="font-semibold leading-none tracking-[-0.24px] w-[560px]"
              style={{
                fontSize: "var(--typeface-font-styles-heading-h1)",
              }}
            >
              What Healthcare Professionals Say
            </h2>
            <p
              className="leading-7 w-[560px]"
              style={{
                fontSize: "var(--typeface-font-styles-heading-subheading)",
              }}
            >
              Feedback from healthcare professionals and institutions who have
              participated in our accredited training programs.
            </p>
          </div>

          {/* Testimonials Card */}
          <div className="bg-[var(--surface-container-default)] rounded-3xl p-8 w-full shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
            <div className="flex items-start justify-between w-full">
              {visibleTestimonials.map((testimonial, index) => (
                <div key={index} className="flex items-start">
                  {/* Testimonial Content */}
                  <div className="flex flex-col gap-16 items-start w-[350px] pr-12 overflow-hidden">
                    <p
                      className="text-[var(--on-surface-default)] font-semibold"
                      style={{
                        fontSize: "var(--typeface-font-styles-heading-h5)",
                      }}
                    >
                      {testimonial.quote}
                    </p>

                    <div className="flex flex-col items-start text-[var(--on-surface-variant)]">
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
                      : "bg-transparent border-2 border-[var(--surface-container-primary)]"
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
                <ArrowRight className="w-4 h-4 text-[#0b0f17] rotate-180" strokeWidth={1.5} />
              </button>
              <button 
                onClick={handleNext}
                className="p-3 bg-[#f9fbfd] border border-[var(--outline-subtle)] rounded-full hover:bg-gray-100 transition-colors"
              >
                <ArrowRight className="w-4 h-4 text-[#0b0f17]" strokeWidth={1.5} />
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
              What Healthcare Professionals Say
            </h2>
            <p
              className="leading-7 w-full"
              style={{
                fontSize: "var(--typeface-font-styles-heading-subheading)",
              }}
            >
              Feedback from healthcare professionals and institutions who have
              participated in our accredited training programs.
            </p>
          </div>

          {/* Testimonial Card - Single card on mobile/tablet */}
          <div className="bg-[var(--surface-container-default)] rounded-3xl p-6 w-full shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
            <div className="flex flex-col gap-16 items-start overflow-hidden">
              <p
                className="text-black font-semibold"
                style={{
                  fontSize: "var(--typeface-font-styles-heading-h5)",
                }}
              >
                {testimonials[currentSlide].quote}
              </p>

              <div className="flex flex-col items-start text-black">
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
                      : "bg-transparent border-2 border-[var(--blue-brand-blue)]"
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
                <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
              </button>
              <button
                onClick={handleMobileNext}
                className="p-3 rounded-full border border-[var(--outline-subtle)] bg-[#f9fbfd] text-[var(--on-surface-default)]"
              >
                <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default Testimonials;
