import Image from "next/image";

const BecomeTrainer = () => {
  return (
    <>
      {/* Desktop Version - Only show on large screens (1280px+) */}
      <section className="hidden xl:block bg-[#eef3f7] px-[64px] py-[96px] overflow-hidden">
        <div className="flex items-center justify-center">
          <div className="relative w-[1312px] h-[625px]">
            {/* Main White Container */}
            <div className="absolute left-[172px] top-0 w-[1140px] h-[625px] bg-white rounded-[24px] overflow-hidden shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
              
              {/* Wavy Pattern - Top Left (positioned at left: -136px, top: -151px from container) */}
              <div className="absolute left-[-136px] top-[-300px] w-[500px] h-[500px] -rotate-90 -scale-y-100">
                <Image
                  src="/images/wavy.svg"
                  alt=""
                  fill
                  className="object-contain"
                />
              </div>
              
              {/* Wavy Pattern - Bottom Right (positioned at left: 772px, top: -303px from container = right side, top area) */}
              <div className="absolute right-[-136px] bottom-[-303px] w-[500px] h-[500px] -rotate-90 -scale-y-100">
                <Image
                  src="/images/wavy.svg"
                  alt=""
                  fill
                  className="object-contain"
                />
              </div>

              {/* Content - centered in the white container */}
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col gap-[32px] items-start w-[600px]">
                  <div className="flex flex-col gap-[16px] text-[#06080b]">
                    <h2
                      className="font-semibold leading-none tracking-[-0.24px] w-[600px]"
                      style={{
                        fontSize: "48px",
                      }}
                    >
                      Become a Trainer
                    </h2>
                    <p className="leading-[28px] text-[20px] w-[590px]">
                      Join a network of accredited trainers delivering NELC-aligned
                      healthcare education nationwide.
                    </p>
                  </div>

                  <button 
                    className="h-[40px] px-[20px] py-[8px] text-white rounded-[12px] text-[14px] font-medium min-w-[80px]"
                    style={{
                      background: "linear-gradient(to right, #a37f49, #6b4e24)",
                    }}
                  >
                    Get Started
                  </button>
                </div>
              </div>
            </div>

            {/* Trainer Image - overlapping the left edge of white container */}
            <div className="absolute left-0 top-[80px] w-[384px] h-[384px] rounded-[24px] overflow-hidden shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)] z-10">
              <Image
                src="/images/trainer-image.png"
                alt="Become a Trainer"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Mobile/Tablet Version - Show on screens smaller than 1280px */}
      <section className="xl:hidden relative w-full h-auto min-h-[793px] overflow-hidden">
        {/* Chevron pattern at top - 252px height */}
        <div className="relative h-[252px] w-full bg-white overflow-hidden">
          {/* Chevron/Zigzag stripes pattern - outline style */}
          <svg
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="none"
            viewBox="0 0 390 252"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <pattern
              id="chevronPattern"
              patternUnits="userSpaceOnUse"
              width="40"
              height="20"
              patternTransform="rotate(90)"
            >
              <polyline
                points="0,10 20,0 40,10"
                fill="none"
                stroke="#d4d4d4"
                strokeWidth="1"
              />
              <polyline
                points="0,20 20,10 40,20"
                fill="none"
                stroke="#d4d4d4"
                strokeWidth="1"
              />
            </pattern>
            <rect width="100%" height="100%" fill="url(#chevronPattern)" />
          </svg>
        </div>

        {/* Content Container - 513px height */}
        <div className="bg-[#eef3f7] h-[513px] px-4 py-16 flex flex-col items-center justify-end">
          <div className="flex flex-col gap-8 items-start justify-center w-full">
            {/* Text Content */}
            <div className="flex flex-col gap-4 text-[#06080b] w-full">
              <h2
                className="font-semibold leading-none tracking-[-0.15px] w-full"
                style={{
                  fontSize: "var(--typeface-font-styles-heading-h1)",
                }}
              >
                Become a Trainer
              </h2>
              <p
                className="leading-7 w-full"
                style={{
                  fontSize: "var(--typeface-font-styles-heading-subheading)",
                }}
              >
                Join a network of accredited trainers delivering NELC-aligned
                healthcare education nationwide.
              </p>
            </div>

            {/* CTA Button - Full width on mobile */}
            <button className="h-12 px-5 py-2 text-white rounded-xl text-sm font-medium min-w-[80px] w-full btn-gold">
              Get Started
            </button>
          </div>
        </div>

        {/* Trainer Image - Centered, overlapping between gold and content sections */}
        <div className="absolute left-4 right-4 top-[calc(50%-140px)] -translate-y-1/2 h-[331px] rounded-3xl overflow-hidden shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
          <Image
            src="/images/trainer-image.png"
            alt="Become a Trainer"
            fill
            className="object-cover"
          />
        </div>
      </section>
    </>
  );
};

export default BecomeTrainer;
