import Image from "next/image";
import { Marquee } from "@/components/ui/marquee";

const Partners = () => {
  // Exact dimensions from Figma frame 8678-5253
  const partners = [
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

  return (
    <section className="bg-[var(--surface-container-default)] py-20 overflow-hidden">
      <div className="flex flex-col gap-12 items-center">
        {/* Title */}
        <div className="flex justify-center px-16">
          <h2
            className="text-[var(--on-surface-default)] font-semibold text-center leading-9 w-[560px]"
            style={{
              fontSize: "var(--typeface-font-styles-heading-h2)",
            }}
          >
            Our Trusted Partners
          </h2>
        </div>

        {/* Partner Logos Marquee - Exact Figma layout */}
        <Marquee pauseOnHover speed={30} className="w-full">
          {partners.map((partner, index) => (
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
      </div>
    </section>
  );
};

export default Partners;
