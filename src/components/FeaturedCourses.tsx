import Image from "next/image";

interface CourseCardProps {
  title: string;
  type: string;
  date: string;
  hours: string;
  description: string;
  price: number;
  vectorImage: string;
}

const CourseCard = ({
  title,
  type,
  date,
  hours,
  description,
  price,
  vectorImage,
}: CourseCardProps) => {
  return (
    <div className="flex flex-1 flex-col gap-[16px] items-start min-w-0">
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
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M14.6667 5.33333L10.6667 8L14.6667 10.6667V5.33333Z"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9.33333 4H2.66667C1.93029 4 1.33333 4.59695 1.33333 5.33333V10.6667C1.33333 11.403 1.93029 12 2.66667 12H9.33333C10.0697 12 10.6667 11.403 10.6667 10.6667V5.33333C10.6667 4.59695 10.0697 4 9.33333 4Z"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-white text-[12px] leading-[16px]">
              {type}
            </span>
          </div>

          {/* Add to cart button - 8px padding, 12px radius */}
          <button className="flex items-center justify-center p-[8px] bg-[#f9fbfd] rounded-[12px]">
            <Image
              src="/icons/shopping-cart-03.svg"
              alt="Add to cart"
              width={16}
              height={16}
            />
          </button>
        </div>
      </div>

      {/* Meta tags - gap-16px */}
      <div className="flex items-center gap-[16px]">
        {/* Date tag */}
        <div className="flex items-center gap-[4px] bg-[#f4f4f5] rounded-[8px] px-[8px] py-[4px]">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M14 6.66667H2M10.6667 1.33334V4.00001M5.33333 1.33334V4.00001M5.2 14.6667H10.8C11.9201 14.6667 12.4802 14.6667 12.908 14.4487C13.2843 14.2569 13.5903 13.951 13.782 13.5746C14 13.1469 14 12.5868 14 11.4667V5.86667C14 4.74657 14 4.18652 13.782 3.75874C13.5903 3.38237 13.2843 3.07641 12.908 2.88466C12.4802 2.66667 11.9201 2.66667 10.8 2.66667H5.2C4.0799 2.66667 3.51984 2.66667 3.09202 2.88466C2.71569 3.07641 2.40973 3.38237 2.21799 3.75874C2 4.18652 2 4.74657 2 5.86667V11.4667C2 12.5868 2 13.1469 2.21799 13.5746C2.40973 13.951 2.71569 14.2569 3.09202 14.4487C3.51984 14.6667 4.0799 14.6667 5.2 14.6667Z"
              stroke="#4a4c4f"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[#4a4c4f] text-[14px] leading-[20px]">
            {date}
          </span>
        </div>

        {/* Hours tag */}
        <div className="flex items-center gap-[4px] bg-[#f4f4f5] rounded-[8px] px-[8px] py-[4px]">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M13.3333 8.55556C13.3333 11.5111 10.9444 13.9 7.98889 13.9C5.03333 13.9 2.64444 11.5111 2.64444 8.55556C2.64444 5.6 5.03333 3.21111 7.98889 3.21111C10.9444 3.21111 13.3333 5.6 13.3333 8.55556Z"
              stroke="#4a4c4f"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M8 6V8.66667L9.33333 10"
              stroke="#4a4c4f"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M10.6667 2.13333L13.3333 4"
              stroke="#4a4c4f"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
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
        <button className="flex items-center gap-[8px] h-[40px] px-[20px] py-[8px] bg-[#0b0f17] text-white rounded-[12px] text-[14px] font-medium">
          <span>View Details</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2.66675 8H13.3334M13.3334 8L9.33341 4M13.3334 8L9.33341 12"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
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
    },
  ];

  return (
    <section className="bg-white px-[64px] py-[96px]">
      <div className="flex flex-col gap-[40px] items-center justify-center w-full">
        {/* Section Title - centered, max-width 768px */}
        <div className="flex items-end justify-between w-full">
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

        {/* Courses Grid - gap-32px between cards, gap-64px vertical */}
        <div className="bg-white flex flex-col gap-[64px] items-start w-full">
          <div className="flex gap-[32px] items-start w-full">
            {courses.map((course, index) => (
              <CourseCard key={index} {...course} />
            ))}
          </div>
        </div>

        {/* View All Button - gold gradient */}
        <button 
          className="h-[40px] px-[20px] py-[8px] rounded-[12px] text-[14px] font-medium text-white min-w-[80px]"
          style={{
            background: "linear-gradient(to right, #a37f49, #6b4e24)",
          }}
        >
          View All Programs
        </button>
      </div>
    </section>
  );
};

export default FeaturedCourses;
