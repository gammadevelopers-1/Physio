import Image from "next/image";

const ExpertInstructors = () => {
  const instructors = [
    { src: "/images/instructor-1.png", row: 1 },
    { src: "/images/instructor-2.png", row: 1 },
    { src: "/images/instructor-3.png", row: 1 },
    { src: "/images/instructor-4.png", row: 2 },
    { src: "/images/instructor-5.png", row: 2 },
    { src: "/images/instructor-6.png", row: 2 },
    { src: "/images/instructor-7.png", row: 2 },
  ];

  const row1 = instructors.filter((i) => i.row === 1);
  const row2 = instructors.filter((i) => i.row === 2);

  return (
    <section className="bg-[var(--surface-intense)] px-4 md:px-10 py-16 md:py-24 overflow-hidden">
      <div className="flex flex-col gap-5 md:gap-8 items-center justify-center w-full">
        {/* Title */}
        <h2
          className="text-[var(--on-surface-default)] font-semibold text-center leading-none tracking-[-0.15px] md:tracking-[-0.24px] w-full md:w-[600px]"
          style={{
            fontSize: "var(--typeface-font-styles-heading-h1)",
          }}
        >
          Led by Expert Healthcare Instructors
        </h2>

        {/* Description */}
        <p
          className="text-[var(--on-surface-default)] text-center leading-7 w-full md:w-[590px]"
          style={{
            fontSize: "var(--typeface-font-styles-heading-subheading)",
          }}
        >
          Learn from experienced clinicians, certified trainers, and
          subject-matter experts who deliver nationally aligned, evidence-based
          healthcare education.
        </p>

        {/* Desktop Instructor Avatars */}
        <div className="hidden md:flex flex-col gap-6 items-center justify-center">
          {/* Row 1 - 3 instructors */}
          <div className="flex gap-6 items-center justify-center">
            {row1.map((instructor, index) => (
              <div
                key={index}
                className="p-[5px] bg-[var(--surface-container-default)] rounded-full"
              >
                <div className="p-[2.5px] bg-[var(--surface-container-default)] rounded-full overflow-hidden">
                  <div className="relative w-[93px] h-[93px] rounded-full overflow-hidden">
                    <Image
                      src={instructor.src}
                      alt={`Instructor ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Row 2 - 4 instructors */}
          <div className="flex gap-6 items-center">
            {row2.map((instructor, index) => (
              <div
                key={index}
                className="p-[5px] bg-[var(--surface-container-default)] rounded-full"
              >
                <div className="p-[2.5px] bg-[var(--surface-container-high)] rounded-full overflow-hidden">
                  <div className="relative w-[93px] h-[93px] rounded-full overflow-hidden">
                    <Image
                      src={instructor.src}
                      alt={`Instructor ${index + 4}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Instructor Avatars - Smaller sized (~62px avatars) */}
        <div className="flex md:hidden flex-col gap-5 items-center justify-center">
          {/* Row 1 - 3 instructors */}
          <div className="flex gap-5 items-center justify-center">
            {row1.map((instructor, index) => (
              <div
                key={index}
                className="p-[3.31px] bg-[var(--surface-container-default)] rounded-full"
              >
                <div className="p-[1.655px] bg-[var(--surface-container-default)] rounded-full overflow-hidden">
                  <div className="relative w-[62px] h-[62px] rounded-full overflow-hidden">
                    <Image
                      src={instructor.src}
                      alt={`Instructor ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Row 2 - 4 instructors with flex wrap */}
          <div className="flex flex-wrap gap-4 items-center justify-center">
            {row2.map((instructor, index) => (
              <div
                key={index}
                className="p-[3.31px] bg-[var(--surface-container-default)] rounded-full"
              >
                <div className="p-[1.655px] bg-[var(--surface-container-high)] rounded-full overflow-hidden">
                  <div className="relative w-[62px] h-[62px] rounded-full overflow-hidden">
                    <Image
                      src={instructor.src}
                      alt={`Instructor ${index + 4}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ExpertInstructors;
