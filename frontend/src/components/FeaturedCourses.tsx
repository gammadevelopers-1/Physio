import Image from "next/image";
import Link from "next/link";
import { Video, ShoppingCart, Plus, Calendar, Clock, ArrowRight } from "lucide-react";

interface CourseCardProps {
  title: string;
  type: string;
  date: string;
  hours: string;
  description: string;
  price: number;
  vectorImage: string;
  slug: string;
}

// Desktop Course Card
const CourseCard = ({
  title,
  type,
  date,
  hours,
  description,
  price,
  vectorImage,
  slug,
}: CourseCardProps) => {
  return (
    <Link href={`/courses/${slug}`} className="flex flex-1 flex-col gap-[16px] items-start min-w-0 group">
      {/* Card Header - exact 182.84px height from Figma */}
      <div className="relative bg-[#eef3f7] rounded-[16px] p-[16px] h-[182.84px] flex flex-col justify-between overflow-hidden w-full">
        {/* Title - 161px width */}
        <p
          className="text-[#06080b] font-semibold w-[161px] z-10 leading-normal"
          style={{
            fontSize: "18px",
          }}
        >
          {title}
        </p>

        {/* Course vector decoration - positioned exactly as Figma */}
        <div className="absolute right-0 top-1/2 -translate-y-[calc(50%-0.92px)] w-[146px] h-[217px]">
          <Image
            src={vectorImage}
            alt=""
            fill
            className="object-contain"
          />
        </div>

        {/* Bottom row - flex between */}
        <div className="flex items-center justify-between w-full z-10">
          {/* Type badge - pill style */}
          <div className="flex items-center gap-[8px] bg-[#0b0f17] rounded-full px-[12px] py-[4px]">
            {/* Video recorder icon */}
            <Video className="w-4 h-4 text-white" strokeWidth={1.5} />
            <span className="text-white text-[12px] leading-[16px]">
              {type}
            </span>
          </div>

          {/* Add to cart button - 8px padding, 12px radius */}
          <button className="flex items-center justify-center p-[8px] bg-[#f9fbfd] rounded-[12px]">
            <ShoppingCart className="w-4 h-4 text-[#0b0f17]" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Meta tags - gap-16px */}
      <div className="flex items-center gap-[16px]">
        {/* Date tag */}
        <div className="flex items-center gap-[4px] bg-[#f4f4f5] rounded-[8px] px-[8px] py-[4px]">
          <Calendar className="w-4 h-4 text-[#4a4c4f]" strokeWidth={1.5} />
          <span className="text-[#4a4c4f] text-[14px] leading-[20px]">
            {date}
          </span>
        </div>

        {/* Hours tag */}
        <div className="flex items-center gap-[4px] bg-[#f4f4f5] rounded-[8px] px-[8px] py-[4px]">
          <Clock className="w-4 h-4 text-[#4a4c4f]" strokeWidth={1.5} />
          <span className="text-[#4a4c4f] text-[14px] leading-[20px]">
            {hours}
          </span>
        </div>
      </div>

      {/* Description - 16px font, 24px line height */}
      <p className="text-[#06080b] text-[16px] leading-[24px] w-full line-clamp-2">
        {description}
      </p>

      {/* Price and CTA */}
      <div className="flex items-center justify-between w-full">
        {/* Price with SAR Riyal icon */}
        <div className="flex items-center gap-[4px]">
          <Image
            src="/icons/rayal-icon.svg"
            alt="SAR"
            width={17}
            height={18}
          />
          <span className="text-[#06080b] font-semibold text-[18px] leading-normal">
            {price}
          </span>
        </div>

        {/* View Details button - 40px height, 20px padding horizontal, 12px radius */}
        <span className="flex items-center gap-[8px] h-[40px] px-[20px] py-[8px] bg-[#0b0f17] text-white rounded-[12px] text-[14px] font-medium group-hover:bg-[#1a1f2e] transition-colors">
          <span>View Details</span>
          <ArrowRight className="w-4 h-4 text-white" strokeWidth={1.5} />
        </span>
      </div>
    </Link>
  );
};

// Mobile Course Card
const MobileCourseCard = ({
  title,
  type,
  date,
  hours,
  description,
  price,
  vectorImage,
  slug,
}: CourseCardProps) => {
  return (
    <Link href={`/courses/${slug}`} className="flex flex-col gap-4 items-start w-full group">
      {/* Card Header - 182.84px height from Figma */}
      <div className="relative bg-[#eef3f7] rounded-2xl p-4 h-[182.84px] flex flex-col justify-between overflow-hidden w-full">
        {/* Title - 161px width */}
        <p
          className="text-[#06080b] font-semibold w-[161px] z-10 leading-normal"
          style={{
            fontSize: "var(--typeface-font-styles-heading-h5)",
          }}
        >
          {title}
        </p>

        {/* Course vector decoration - positioned exactly as Figma */}
        <div className="absolute right-0 top-1/2 -translate-y-[calc(50%-0.92px)] w-[146px] h-[217px]">
          <Image src={vectorImage} alt="" fill className="object-contain" />
        </div>

        {/* Bottom row - flex between */}
        <div className="flex items-center justify-between w-full z-10">
          {/* Type badge - pill style */}
          <div className="flex items-center gap-2 bg-[#0b0f17] rounded-full px-3 py-1">
            <Video className="w-4 h-4 text-white" strokeWidth={1.5} />
            <span className="text-white text-xs leading-4">{type}</span>
          </div>

          {/* Add to cart button - 8px padding, 12px radius */}
          <button className="flex items-center justify-center p-2 bg-[#f9fbfd] rounded-xl">
            <ShoppingCart className="w-4 h-4 text-[#0b0f17]" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Meta tags */}
      <div className="flex items-center gap-4">
        {/* Date tag */}
        <div className="flex items-center gap-1 bg-[#f4f4f5] rounded-lg px-2 py-1">
          <Calendar className="w-4 h-4 text-[#4a4c4f]" strokeWidth={1.5} />
          <span className="text-[#4a4c4f] text-sm leading-5">{date}</span>
        </div>

        {/* Hours tag */}
        <div className="flex items-center gap-1 bg-[#f4f4f5] rounded-lg px-2 py-1">
          <Clock className="w-4 h-4 text-[#4a4c4f]" strokeWidth={1.5} />
          <span className="text-[#4a4c4f] text-sm leading-5">{hours}</span>
        </div>
      </div>

      {/* Description */}
      <p className="text-[#06080b] text-base leading-6 w-full">
        {description}
      </p>

      {/* Price and CTA */}
      <div className="flex items-center justify-between w-full">
        {/* Price with SAR Riyal icon */}
        <div className="flex items-center gap-1">
          <Image src="/icons/rayal-icon.svg" alt="SAR" width={16} height={18} />
          <span
            className="text-[#06080b] font-semibold leading-normal"
            style={{
              fontSize: "var(--typeface-font-styles-heading-h5)",
            }}
          >
            {price}
          </span>
        </div>

        {/* View Details button */}
        <span className="flex items-center gap-2 h-10 px-5 py-2 bg-[#0b0f17] text-white rounded-xl text-sm font-medium group-hover:bg-[#1a1f2e] transition-colors">
          <span>View Details</span>
          <ArrowRight className="w-4 h-4 text-white" strokeWidth={1.5} />
        </span>
      </div>
    </Link>
  );
};

const FeaturedCourses = () => {
  const courses = [
    {
      title: "Infection Control (Core / Flagship)",
      type: "Live Online",
      date: "11 Jan 2026",
      hours: "8 CME Hours",
      description:
        "A comprehensive, evidence-based overview of infection prevention strategies for modern healthcare settings.",
      price: 575,
      vectorImage: "/featured images/Vector 2.svg",
      slug: "infection-control-flagship",
    },
    {
      title: "Life Support / Emergency Care",
      type: "Live Online",
      date: "18 Jan 2026",
      hours: "6 CME Hours",
      description:
        "Essential life-saving skills for early response, resuscitation, and emergency management.",
      price: 375,
      vectorImage: "/featured images/Vector 2 (1).svg",
      slug: "life-support-emergency-care",
    },
    {
      title: "Patient Safety & Quality",
      type: "Live Online",
      date: "11 Jan 2026",
      hours: "8 CME Hours",
      description:
        "Learn structured approaches to reduce medical errors, improve outcomes, and enhance care quality.",
      price: 460,
      vectorImage: "/featured images/Vector 2 (2).svg",
      slug: "patient-safety-quality",
    },
    {
      title: "Public Health & Preparedness",
      type: "Live Online",
      date: "11 Jan 2026",
      hours: "8 CME Hours",
      description:
        "Principles of surveillance, risk assessment, and coordinated response to health emergencies.",
      price: 575,
      vectorImage: "/featured images/Vector 2 (3).svg",
      slug: "public-health-preparedness",
    },
  ];

  return (
    <section className="bg-white px-4 xl:px-[64px] py-16 xl:py-[96px] overflow-hidden">
      <div className="flex flex-col gap-5 xl:gap-[40px] items-center justify-center w-full max-w-[1440px] mx-auto">
        {/* Section Title - Desktop (1280px+) */}
        <div className="hidden xl:flex items-end justify-between w-full">
          <div className="flex-1 flex flex-col items-center justify-center max-w-[768px] mx-auto">
            <div className="flex flex-col gap-[16px] items-center text-center text-black w-full">
              <h2
                className="font-semibold leading-none tracking-[-0.24px] w-full"
                style={{
                  fontSize: "48px",
                }}
              >
                Featured Programs
              </h2>
              <p
                className="leading-[28px] w-full text-[20px]"
              >
                Accredited, evidence-based healthcare training programs.
              </p>
            </div>
          </div>
        </div>

        {/* Section Title - Mobile/Tablet */}
        <div className="flex xl:hidden flex-col gap-4 items-center text-center text-black w-full">
          <h2
            className="font-semibold leading-none tracking-[-0.15px] w-full"
            style={{
              fontSize: "var(--typeface-font-styles-heading-h1)",
            }}
          >
            Featured Programs
          </h2>
          <p
            className="leading-7 w-full"
            style={{
              fontSize: "var(--typeface-font-styles-heading-subheading)",
            }}
          >
            Accredited, evidence-based healthcare training programs.
          </p>
        </div>

        {/* Desktop Courses Grid - 4 columns (1280px+) */}
        <div className="hidden xl:flex bg-white flex-col gap-[64px] items-start w-full">
          <div className="flex gap-[32px] items-start w-full">
            {courses.map((course, index) => (
              <CourseCard key={index} {...course} />
            ))}
          </div>
        </div>

        {/* Mobile/Tablet Course Cards - Stacked vertically */}
        <div className="flex xl:hidden flex-col gap-8 items-start w-full">
          {courses.map((course, index) => (
            <MobileCourseCard key={index} {...course} />
          ))}
        </div>

        {/* View All Button */}
        <Link
          href="/courses"
          className="h-[40px] px-[20px] py-[8px] rounded-[12px] text-[14px] font-medium text-white min-w-[80px] btn-gold inline-flex items-center justify-center"
        >
          View All Programs
        </Link>
      </div>
    </section>
  );
};

export default FeaturedCourses;
