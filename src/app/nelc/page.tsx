"use client";

import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const NELCAgreementPage = () => {
  return (
    <main className="min-h-screen bg-white pb-20 lg:pb-0">
      <Navbar />

      {/* Hero Section */}
      <section className="bg-white px-4 md:px-16 py-16 md:py-24">
        <div className="max-w-[1312px] mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-16">
            {/* Left Content */}
            <div className="flex flex-col gap-12 w-full md:max-w-[663px]">
              {/* Title and Description */}
              <div className="flex flex-col gap-6">
                <h1
                  className="font-semibold text-[#06080B] tracking-[-0.15px] md:tracking-[-0.24px] leading-none text-[30px] md:text-[48px]"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Committed to National Quality Standards
                </h1>
                <p
                  className="text-[#06080B] leading-7 text-[18px] md:text-[20px]"
                >
                  PhysioGuidance is a fully licensed provider under the National
                  eLearning Center (NELC) of Saudi Arabia.
                </p>
              </div>

              {/* License Info Cards - Stack vertically on mobile */}
              <div className="flex flex-col md:flex-row gap-4 w-full">
                {/* License Number */}
                <div className="bg-[#F9FBFD] rounded-[10px] px-3 py-2 flex items-start gap-3 w-full md:flex-1">
                  <div className="w-1 self-stretch bg-[#C8D5E1] rounded" />
                  <div className="flex flex-col">
                    <span className="font-medium text-[#06080B] text-[14px] leading-5">
                      License Number
                    </span>
                    <span className="text-[#4A4C4F] text-[12px] leading-4">
                      Al Madinah Al Munawwarah
                    </span>
                  </div>
                </div>

                {/* License Type */}
                <div className="bg-[#F9FBFD] rounded-[10px] px-3 py-2 flex items-start gap-3 w-full md:flex-1">
                  <div className="w-1 self-stretch bg-[#C8D5E1] rounded" />
                  <div className="flex flex-col">
                    <span className="font-medium text-[#06080B] text-[14px] leading-5">
                      License Type
                    </span>
                    <span className="text-[#4A4C4F] text-[12px] leading-4">
                      eLearning Training Facility
                    </span>
                  </div>
                </div>

                {/* Status */}
                <div className="bg-[#F9FBFD] rounded-[10px] px-3 py-2 flex items-start gap-3 w-full md:flex-1">
                  <div className="w-1 self-stretch bg-[#C8D5E1] rounded" />
                  <div className="flex flex-col">
                    <span className="font-medium text-[#06080B] text-[14px] leading-5">
                      Status
                    </span>
                    <span className="text-[#4A4C4F] text-[12px] leading-4">
                      Active
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* NELC Logo - Centered on mobile, right on desktop */}
            <div className="flex-shrink-0 flex justify-center w-full md:w-auto">
              <Image
                src="/NELC_agreement/image 492 (1).svg"
                alt="National eLearning Center"
                width={437}
                height={172}
                className="object-contain w-[277px] md:w-[437px] h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Our Compliance Section */}
      <section className="bg-white px-4 md:px-16 py-16 md:py-24">
        <div className="max-w-[1312px] mx-auto">
          {/* Title and Subtitle */}
          <div className="flex flex-col items-center gap-4 mb-10 max-w-[768px] mx-auto">
            <h2
              className="font-semibold text-[#06080B] text-center tracking-[-0.15px] md:tracking-[-0.24px] leading-none text-[30px] md:text-[48px]"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Our Compliance
            </h2>
            <p
              className="text-[#06080B] text-center leading-7 text-[18px] md:text-[20px]"
            >
              We adhere strictly to the NELC&apos;s operational standards to ensure a
              premium educational experience
            </p>
          </div>

          {/* Compliance Cards - Stack vertically on mobile */}
          <div className="flex flex-col md:flex-row gap-8 md:gap-8 justify-center items-center">
            {/* Governance Card */}
            <div className="flex flex-col items-center relative w-full md:w-auto pb-6">
              <div className="h-[286px] w-full md:w-[368px] relative z-0 rounded-[16px] overflow-hidden shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
                <Image
                  src="/NELC_agreement/image 18.svg"
                  alt="Governance"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="bg-[#EEF3F7] rounded-[16px] p-4 min-h-[140px] md:h-[140px] w-[285px] md:w-[317px] -mt-24 relative z-10 flex flex-col gap-[10px] items-center text-center shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
                <h3
                  className="font-semibold text-[#06080B] text-[18px] md:text-[20px]"
                >
                  Governance
                </h3>
                <p className="text-[#06080B] text-[16px] leading-6">
                  Transparent policies for attendance, grading, and grievances.
                </p>
              </div>
            </div>

            {/* Technology Card */}
            <div className="flex flex-col items-center relative w-full md:w-auto pb-6">
              <div className="h-[286px] w-full md:w-[368px] relative z-0 rounded-[16px] overflow-hidden shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
                <Image
                  src="/NELC_agreement/image 19.svg"
                  alt="Technology"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="bg-[#EEF3F7] rounded-[16px] p-4 min-h-[140px] md:h-[140px] w-[285px] md:w-[317px] -mt-24 relative z-10 flex flex-col gap-[10px] items-center text-center shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
                <h3
                  className="font-semibold text-[#06080B] text-[18px] md:text-[20px]"
                >
                  Technology
                </h3>
                <p className="text-[#06080B] text-[16px] leading-6">
                  A secure, accessible platform that protects learner data and
                  intellectual property.
                </p>
              </div>
            </div>

            {/* Instruction Card */}
            <div className="flex flex-col items-center relative w-full md:w-auto pb-6">
              <div className="h-[286px] w-full md:w-[368px] relative z-0 rounded-[16px] overflow-hidden shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
                <Image
                  src="/NELC_agreement/image 20.svg"
                  alt="Instruction"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="bg-[#EEF3F7] rounded-[16px] p-4 min-h-[140px] md:h-[140px] w-[285px] md:w-[317px] -mt-24 relative z-10 flex flex-col gap-[10px] items-center text-center shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
                <h3
                  className="font-semibold text-[#06080B] text-[18px] md:text-[20px]"
                >
                  Instruction
                </h3>
                <p className="text-[#06080B] text-[16px] leading-6">
                  All courses are designed by subject matter experts and undergo
                  rigorous quality review before publication.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default NELCAgreementPage;
