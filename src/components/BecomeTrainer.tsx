import Image from "next/image";

const BecomeTrainer = () => {
  return (
    <section className="bg-[var(--surface-container-default)] px-16 py-24 h-[817px] overflow-hidden">
      <div className="flex items-center justify-center">
        <div className="relative w-[1312px] h-[625px]">
          {/* Main Container */}
          <div className="absolute left-[-10px] top-[-10px] w-[1140px] h-[635px] bg-[var(--surface-container-lowest)] rounded-3xl overflow-hidden shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
            {/* Background Decorative Elements */}
            <div className="absolute left-[-136px] bottom-[-126px] w-[500px] h-[500px] rounded-[50px] bg-gradient-to-r from-[#a37f49] to-[#6b4e24] opacity-20" />
            <div className="absolute right-[-132px] top-[-203px] w-[500px] h-[500px] rounded-[50px] bg-gradient-to-r from-[#a37f49] to-[#6b4e24] opacity-20" />

            {/* Content */}
            <div className="flex flex-col gap-8 items-start justify-center h-full px-16 max-w-[600px]">
              <div className="flex flex-col gap-4 text-[var(--on-surface-default)]">
                <h2
                  className="font-semibold leading-none tracking-[-0.24px] w-[600px]"
                  style={{
                    fontSize: "var(--typeface-font-styles-heading-h1)",
                  }}
                >
                  Become a Trainer
                </h2>
                <p
                  className="leading-7 w-[590px]"
                  style={{
                    fontSize: "var(--typeface-font-styles-heading-subheading)",
                  }}
                >
                  Join a network of accredited trainers delivering NELC-aligned
                  healthcare education nationwide.
                </p>
              </div>

              <button className="h-10 px-5 py-2 btn-gold text-[var(--on-surface-inverse)] rounded-xl text-sm font-medium min-w-[80px]">
                Continue
              </button>
            </div>
          </div>

          {/* Trainer Image */}
          <div className="absolute right-0 top-20 w-[384px] h-[384px] rounded-3xl overflow-hidden shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
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
  );
};

export default BecomeTrainer;
