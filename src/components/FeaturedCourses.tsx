import Image from "next/image";

interface CourseCardProps {
  title: string;
  type: string;
  date: string;
  hours: string;
  description: string;
  price: number;
  imageIndex: number;
}

const CourseCard = ({
  title,
  type,
  date,
  hours,
  description,
  price,
}: CourseCardProps) => {
  return (
    <div className="flex flex-1 flex-col gap-4 min-w-0">
      {/* Card Header with gradient background */}
      <div className="relative bg-[var(--surface-container-default)] rounded-2xl p-4 h-[183px] flex flex-col justify-between overflow-hidden">
        {/* Title */}
        <p
          className="text-[var(--on-surface-default)] font-semibold w-[161px] z-10"
          style={{
            fontSize: "var(--typeface-font-styles-heading-h5)",
          }}
        >
          {title}
        </p>

        {/* Course vector decoration */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[146px] h-[217px]">
          <Image
            src="/images/course-vector.svg"
            alt=""
            fill
            className="object-contain"
          />
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between w-full z-10">
          {/* Type badge */}
          <div className="flex items-center gap-2 bg-[var(--surface-container-primary)] rounded-full px-3 py-1">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M14.6667 6V10C14.6667 11.4001 14.6667 12.1002 14.394 12.635C14.1545 13.1054 13.7721 13.4878 13.3016 13.7274C12.7669 14 12.0668 14 10.6667 14H5.33333C3.93319 14 3.23312 14 2.69836 13.7274C2.22794 13.4878 1.84555 13.1054 1.60598 12.635C1.33333 12.1002 1.33333 11.4001 1.33333 10V6M14.6667 6V5.33333C14.6667 4.22909 14.6667 3.67697 14.449 3.24429C14.2569 2.86099 13.9386 2.54267 13.5553 2.35057C13.1226 2.13287 12.5705 2.13287 11.4663 2.13287H4.53373C3.42949 2.13287 2.87737 2.13287 2.44469 2.35057C2.06139 2.54267 1.74307 2.86099 1.55097 3.24429C1.33333 3.67697 1.33333 4.22909 1.33333 5.33333V6M14.6667 6H1.33333"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="text-[var(--on-surface-inverse)] leading-4"
              style={{
                fontSize: "var(--typeface-font-styles-paragraph-text-xs)",
              }}
            >
              {type}
            </span>
          </div>

          {/* Add button */}
          <button className="flex items-center justify-center p-2 bg-[var(--blue-blue-50)] rounded-xl">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 3.33334V12.6667M3.33333 8H12.6667"
                stroke="#0b0f17"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Meta tags */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 bg-[#f4f4f5] rounded-lg px-2 py-1">
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
          <span
            className="text-[var(--on-surface-variant)] leading-5"
            style={{
              fontSize: "var(--typeface-font-styles-paragraph-text-s)",
            }}
          >
            {date}
          </span>
        </div>

        <div className="flex items-center gap-1 bg-[#f4f4f5] rounded-lg px-2 py-1">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M8 5.33334V8.00001L9.33333 9.33334M14.6667 8.00001C14.6667 11.6819 11.6819 14.6667 8 14.6667C4.3181 14.6667 1.33333 11.6819 1.33333 8.00001C1.33333 4.31811 4.3181 1.33334 8 1.33334C11.6819 1.33334 14.6667 4.31811 14.6667 8.00001Z"
              stroke="#4a4c4f"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className="text-[var(--on-surface-variant)] leading-5"
            style={{
              fontSize: "var(--typeface-font-styles-paragraph-text-s)",
            }}
          >
            {hours}
          </span>
        </div>
      </div>

      {/* Description */}
      <p
        className="text-[var(--on-surface-default)] leading-6 line-clamp-2"
        style={{
          fontSize: "var(--typeface-font-styles-paragraph-text)",
        }}
      >
        {description}
      </p>

      {/* Price and CTA */}
      <div className="flex items-center justify-between w-full">
        {/* Price */}
        <div className="flex items-center gap-1">
          <Image
            src="/icons/sar-icon.svg"
            alt="SAR"
            width={16}
            height={18}
            className="scale-y-[-1]"
          />
          <span
            className="text-[var(--on-surface-default)] font-semibold"
            style={{
              fontSize: "var(--typeface-font-styles-heading-h5)",
            }}
          >
            {price}
          </span>
        </div>

        {/* Continue button */}
        <button className="flex items-center gap-2 h-10 px-5 py-2 bg-[var(--surface-container-primary)] text-[var(--on-surface-inverse)] rounded-xl text-sm font-medium">
          <span>Continue</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2.66675 8H13.3334M13.3334 8L9.33341 4M13.3334 8L9.33341 12"
              stroke="currentColor"
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
      imageIndex: 1,
    },
    {
      title: "Infection Control (Core / Flagship)",
      type: "Live Online",
      date: "11 Jan 2026",
      hours: "8 CME Hours",
      description:
        "A comprehensive, evidence-based overview of infection prevention strategies for modern healthcare settings.",
      price: 575,
      imageIndex: 2,
    },
    {
      title: "Infection Control (Core / Flagship)",
      type: "Live Online",
      date: "11 Jan 2026",
      hours: "8 CME Hours",
      description:
        "A comprehensive, evidence-based overview of infection prevention strategies for modern healthcare settings.",
      price: 575,
      imageIndex: 3,
    },
    {
      title: "Infection Control (Core / Flagship)",
      type: "Live Online",
      date: "11 Jan 2026",
      hours: "8 CME Hours",
      description:
        "A comprehensive, evidence-based overview of infection prevention strategies for modern healthcare settings.",
      price: 575,
      imageIndex: 4,
    },
  ];

  return (
    <section className="bg-[var(--surface-intense)] px-16 py-24 overflow-hidden">
      <div className="flex flex-col gap-10 items-center justify-center w-full">
        {/* Section Title */}
        <div className="flex items-end justify-between w-full">
          <div className="flex-1 flex flex-col items-center justify-center max-w-[768px]">
            <div className="flex flex-col gap-4 items-center text-center text-[var(--on-surface-default)]">
              <h2
                className="font-semibold leading-none tracking-[-0.24px] w-full"
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
          </div>
        </div>

        {/* Courses Grid */}
        <div className="bg-white flex flex-col gap-16 items-start w-full">
          <div className="flex gap-8 items-start w-full">
            {courses.map((course, index) => (
              <CourseCard key={index} {...course} />
            ))}
          </div>
        </div>

        {/* View All Button */}
        <button className="h-10 px-5 py-2 btn-gold text-[var(--on-surface-inverse)] rounded-xl text-sm font-medium min-w-[80px]">
          Continue
        </button>
      </div>
    </section>
  );
};

export default FeaturedCourses;
