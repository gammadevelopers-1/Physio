import Image from "next/image";

const Hero = () => {
  return (
    <section className="relative w-full">
      {/* Video Section */}
      <div className="relative h-[600px] w-full overflow-hidden">
        {/* Video Element */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/videos/1767191494476407.mp4" type="video/mp4" />
        </video>

        {/* Partner logos on video - transparent, floating directly on video */}
        <div className="absolute bottom-8 right-16 flex items-center gap-6">
          <div className="relative h-16 w-24">
            <Image
              src="/images/partner-1.png"
              alt="BMC"
              fill
              className="object-contain"
              style={{ mixBlendMode: 'multiply' }}
            />
          </div>
          
          {/* Separator line */}
          <div className="h-12 w-px bg-white/40" />
          
          <div className="relative h-16 w-28">
            <Image
              src="/images/partner-2.png"
              alt="Prince Sultan"
              fill
              className="object-contain"
              style={{ mixBlendMode: 'multiply' }}
            />
          </div>
          
          {/* Separator line */}
          <div className="h-12 w-px bg-white/40" />
          
          <div className="relative h-16 w-20">
            <Image
              src="/images/partner-3.png"
              alt="Partner 3"
              fill
              className="object-contain"
              style={{ mixBlendMode: 'multiply' }}
            />
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="bg-[var(--surface-intense)] px-16 py-20 overflow-hidden">
        <div className="flex gap-20 items-start max-w-full">
          {/* Left Column - Title */}
          <div className="flex-1 min-w-0">
            <h1
              className="text-[var(--on-surface-default)] font-semibold tracking-[-1.2px] leading-[1.1]"
              style={{
                fontSize: "var(--typeface-font-styles-display-base)",
              }}
            >
              Health Training &<br />eLearning Courses
            </h1>
          </div>

          {/* Right Column - Description + CTAs */}
          <div className="flex-1 min-w-0 flex flex-col gap-8">
            <p
              className="text-[var(--on-surface-default)] leading-7"
              style={{
                fontSize: "var(--typeface-font-styles-heading-subheading)",
              }}
            >
              Delivering NELC-compliant training, accredited programs, and live
              learning experiences for the health sector — all in one secure
              platform.
            </p>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button className="h-10 px-5 py-2 btn-gold text-[var(--on-surface-inverse)] rounded-xl text-sm font-medium">
                Explore Training Programs
              </button>
              <button className="h-10 px-5 py-2 border border-[var(--outline-default)] rounded-xl text-sm font-medium bg-transparent">
                <span
                  className="bg-gradient-to-r from-[#ab842f] to-[#8e690a] bg-clip-text"
                  style={{ WebkitTextFillColor: "transparent" }}
                >
                  Get Started
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
