import Image from "next/image";
import { Marquee } from "@/components/ui/marquee";

const Partners = () => {
  // Desktop partner dimensions from Figma
  const desktopPartners = [
    {
      name: "National eLearning Center",
      src: "/partener images/National eLearning Center.png",
      width: 95,
      height: 39,
    },
    {
      name: "ISO 9001",
      src: "/partener images/International Organization for Standardization (ISO).png",
      width: 68,
      height: 66,
    },
    {
      name: "Governance Academy",
      src: "/partener images/Governance Academy.png",
      width: 175,
      height: 65,
    },
    {
      name: "IBTA MEA",
      src: "/partener images/International Business Training Association Middle East and Africa (IBTA MEA).png",
      width: 115,
      height: 40,
    },
    {
      name: "National eLearning Center",
      src: "/partener images/National eLearning Center.png",
      width: 95,
      height: 39,
    },
    {
      name: "SCFHS",
      src: "/partener images/Saudi Commission for Health Specialties (SCFHS).png",
      width: 90,
      height: 41,
    },
    {
      name: "ISO 9001",
      src: "/partener images/International Organization for Standardization (ISO).png",
      width: 68,
      height: 66,
    },
  ];

  // Mobile partner dimensions from Figma
  const mobilePartners = [
    {
      name: "National eLearning Center",
      src: "/partener images/National eLearning Center.png",
      width: 46,
      height: 19,
    },
    {
      name: "ISO 9001",
      src: "/partener images/International Organization for Standardization (ISO).png",
      width: 33,
      height: 32,
    },
    {
      name: "Governance Academy",
      src: "/partener images/Governance Academy.png",
      width: 85,
      height: 31,
    },
    {
      name: "IBTA MEA",
      src: "/partener images/International Business Training Association Middle East and Africa (IBTA MEA).png",
      width: 56,
      height: 19,
    },
    {
      name: "National eLearning Center",
      src: "/partener images/National eLearning Center.png",
      width: 46,
      height: 19,
    },
    {
      name: "SCFHS",
      src: "/partener images/Saudi Commission for Health Specialties (SCFHS).png",
      width: 44,
      height: 20,
    },
    {
      name: "ISO 9001",
      src: "/partener images/International Organization for Standardization (ISO).png",
      width: 33,
      height: 32,
    },
  ];

  return (
    <section className="bg-[var(--surface-container-default)] py-8 md:py-20 px-4 md:px-0 overflow-hidden">
      <div className="flex flex-col gap-6 md:gap-12 items-center">
        {/* Title */}
        <div className="flex justify-center md:px-16">
          <h2
            className="text-black md:text-[var(--on-surface-default)] font-semibold text-center leading-9 md:w-[560px]"
            style={{
              fontSize: "var(--typeface-font-styles-heading-h2)",
            }}
          >
            Our Trusted Partners
          </h2>
        </div>

        {/* Desktop Partner Logos Marquee */}
        <Marquee pauseOnHover speed={30} className="w-full hidden md:flex">
          {desktopPartners.map((partner, index) => (
            <div
              key={index}
              className="flex items-center justify-center"
              style={{ 
                height: 66,
                marginLeft: 48,
                marginRight: 48,
              }}
            >
              <Image
                src={partner.src}
                alt={partner.name}
                width={partner.width}
                height={partner.height}
                style={{ 
                  width: partner.width, 
                  height: partner.height,
                  objectFit: 'contain',
                }}
              />
            </div>
          ))}
        </Marquee>

        {/* Mobile Partner Logos Marquee */}
        <Marquee pauseOnHover speed={25} className="w-full md:hidden">
          {mobilePartners.map((partner, index) => (
            <div
              key={index}
              className="flex items-center justify-center"
              style={{
                height: 32,
                marginLeft: 23,
                marginRight: 23,
              }}
            >
              <Image
                src={partner.src}
                alt={partner.name}
                width={partner.width}
                height={partner.height}
                style={{
                  width: partner.width,
                  height: partner.height,
                  objectFit: "contain",
                }}
              />
            </div>
          ))}
        </Marquee>
      </div>
    </section>
  );
};

export default Partners;
