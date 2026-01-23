import Image from "next/image";

const CTASection = () => {
  return (
    <section className="relative bg-[var(--surface-container-high)] px-10 py-[120px] overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute w-[1440px] h-[1440px]">
          <Image
            src="/images/cta-bg.png"
            alt=""
            fill
            className="object-cover opacity-10"
          />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col gap-8 items-center justify-center w-full">
        <h2
          className="text-[var(--on-surface-default)] font-semibold text-center leading-none tracking-[-0.24px] w-[600px]"
          style={{
            fontSize: "var(--typeface-font-styles-heading-h1)",
          }}
        >
          Start Your Healthcare Learning Journey
        </h2>

        <p
          className="text-[var(--on-surface-default)] text-center leading-7 w-[590px]"
          style={{
            fontSize: "var(--typeface-font-styles-heading-subheading)",
          }}
        >
          Access accredited, NELC-aligned training programs designed for
          healthcare professionals and institutions.
        </p>

        <button className="h-10 px-5 py-2 btn-gold text-[var(--on-surface-inverse)] rounded-xl text-sm font-medium min-w-[80px]">
          Continue
        </button>
      </div>
    </section>
  );
};

export default CTASection;
