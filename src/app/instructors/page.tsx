"use client";

import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

// Meet the experts - 3 instructors
const experts = [
  {
    name: "Dr. Abdullah Al-Harbi",
    title: "Consultant, Orthopedic Surgery",
    image: "/images/instructor-1.png",
  },
  {
    name: "Dr. Sarah Al-Jasser",
    title: "Consultant, Pediatric Rheumatology",
    image: "/images/instructor-2.png",
  },
  {
    name: "Dr. Nourah Al-Amri",
    title: "Consultant, Family Medicine & Community Health",
    image: "/images/instructor-3.png",
  },
];

// Minds Behind Physioguidance - 4 instructors
const minds = [
  {
    name: "Dr. Faisal Al-Otaibi",
    title: "Prince Sultan Military Medical City, Riyadh",
    image: "/images/instructor-4.png",
  },
  {
    name: "Dr. Mohammed Al-Ghamdi",
    title: "Assistant Professor & Consultant, Emergency Medicine",
    image: "/images/instructor-5.png",
  },
  {
    name: "Dr. Yasser Al-Qahtani",
    title: "Senior Registrar, Internal Medicine",
    image: "/images/instructor-6.png",
  },
  {
    name: "Dr. Omar Al-Shehri",
    title: "Consultant, Neurology",
    image: "/images/instructor-7.png",
  },
];

const InstructorCard = ({
  instructor,
}: {
  instructor: { name: string; title: string; image: string };
}) => {
  return (
    <div className="flex flex-col gap-5 items-center w-full md:w-[230px]">
      {/* Avatar with ring */}
      <div className="p-[5px] bg-[#EEF3F7] rounded-full">
        <div className="p-[2.5px] bg-[#E5EDF4] rounded-full overflow-hidden">
          <div className="relative w-[93px] h-[93px] rounded-full overflow-hidden">
            <Image
              src={instructor.image}
              alt={instructor.name}
              fill
              className="object-cover"
            />
          </div>
        </div>
      </div>
      {/* Name and Title */}
      <div className="flex flex-col gap-1 items-center text-center w-full">
        <h3
          className="font-semibold text-[#06080B] w-full"
          style={{ fontSize: "var(--typeface-font-styles-heading-h5)" }}
        >
          {instructor.name}
        </h3>
        <p
          className="text-[#06080B] leading-6 w-full"
          style={{ fontSize: "var(--typeface-font-styles-paragraph-text)" }}
        >
          {instructor.title}
        </p>
      </div>
    </div>
  );
};

const MobileInstructorCard = ({
  instructor,
}: {
  instructor: { name: string; title: string; image: string };
}) => {
  return (
    <div className="flex flex-col gap-4 items-center w-full">
      {/* Avatar with ring */}
      <div className="p-[3.31px] bg-[#EEF3F7] rounded-full">
        <div className="p-[1.65px] bg-[#E5EDF4] rounded-full overflow-hidden">
          <div className="relative w-[70px] h-[70px] rounded-full overflow-hidden">
            <Image
              src={instructor.image}
              alt={instructor.name}
              fill
              className="object-cover"
            />
          </div>
        </div>
      </div>
      {/* Name and Title */}
      <div className="flex flex-col gap-1 items-center text-center w-full px-4">
        <h3 className="font-semibold text-[#06080B] text-[16px]">
          {instructor.name}
        </h3>
        <p className="text-[#06080B] text-[14px] leading-5">
          {instructor.title}
        </p>
      </div>
    </div>
  );
};

const InstructorsPage = () => {
  return (
    <main className="min-h-screen bg-white pb-20 lg:pb-0">
      <Navbar />

      {/* Meet the Experts Section */}
      <section className="bg-white px-4 md:px-16 py-16 md:py-24">
        <div className="max-w-[1312px] mx-auto flex flex-col gap-12 items-center">
          {/* Title */}
          <h1
            className="font-semibold text-[#06080B] text-center tracking-[-0.24px] leading-none text-[32px] md:text-[48px]"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Meet the experts
          </h1>

          {/* Desktop - 3 instructors in a row */}
          <div className="hidden md:flex gap-8 items-start justify-center w-full">
            {experts.map((instructor, index) => (
              <InstructorCard key={index} instructor={instructor} />
            ))}
          </div>

          {/* Mobile - Single column */}
          <div className="flex md:hidden flex-col gap-8 items-center w-full">
            {experts.map((instructor, index) => (
              <MobileInstructorCard key={index} instructor={instructor} />
            ))}
          </div>
        </div>
      </section>

      {/* Minds Behind Physioguidance Section */}
      <section className="bg-white px-4 md:px-16 py-16 md:py-24">
        <div className="max-w-[1312px] mx-auto flex flex-col gap-12 items-center">
          {/* Title */}
          <h1
            className="font-semibold text-[#06080B] text-center tracking-[-0.24px] leading-none text-[32px] md:text-[48px]"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Minds Behind Physioguidance
          </h1>

          {/* Desktop - 4 instructors in a row */}
          <div className="hidden md:flex gap-8 items-start justify-center w-full">
            {minds.map((instructor, index) => (
              <InstructorCard key={index} instructor={instructor} />
            ))}
          </div>

          {/* Mobile - Single column */}
          <div className="flex md:hidden flex-col gap-8 items-center w-full">
            {minds.map((instructor, index) => (
              <MobileInstructorCard key={index} instructor={instructor} />
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default InstructorsPage;
