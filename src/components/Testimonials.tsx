const Testimonials = () => {
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
  ];

  return (
    <section className="bg-[var(--surface-intense)] px-16 py-24 overflow-hidden">
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
        <div className="bg-[var(--surface-container-low)] rounded-3xl p-8 w-full shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
          <div className="flex items-start justify-between w-full">
            {testimonials.map((testimonial, index) => (
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
                {index < testimonials.length - 1 && (
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
            <div className="w-6 h-2 bg-[var(--surface-container-primary)] rounded-full" />
            <div className="w-2 h-2 bg-[var(--surface-container-high)] rounded-full" />
            <div className="w-2 h-2 bg-[var(--surface-container-high)] rounded-full" />
          </div>

          {/* Arrows */}
          <div className="flex gap-4 items-start">
            <button className="p-3 bg-[#f9fbfd] border border-[var(--outline-subtle)] rounded-full">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="rotate-180"
              >
                <path
                  d="M2.66675 8H13.3334M13.3334 8L9.33341 4M13.3334 8L9.33341 12"
                  stroke="#0b0f17"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button className="p-3 bg-[#f9fbfd] border border-[var(--outline-subtle)] rounded-full">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M2.66675 8H13.3334M13.3334 8L9.33341 4M13.3334 8L9.33341 12"
                  stroke="#0b0f17"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
