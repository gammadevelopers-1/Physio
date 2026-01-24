"use client";

import Image from "next/image";

const WhatsAppButton = () => {
  const handleWhatsAppClick = () => {
    // Replace with actual WhatsApp number
    window.open("https://wa.me/966920035022", "_blank");
  };

  return (
    <button
      onClick={handleWhatsAppClick}
      className="fixed bottom-6 right-6 z-50 w-[48px] h-[48px] flex items-center justify-center rounded-full bg-[#25D366] hover:bg-[#20BD5A] transition-colors cursor-pointer"
      style={{
        boxShadow:
          "0px 2px 4px rgba(0, 0, 0, 0.1), 0px 7px 7px rgba(0, 0, 0, 0.09)",
      }}
      aria-label="Contact us on WhatsApp"
    >
      <Image
        src="/icons/whatsapp.svg"
        alt="WhatsApp"
        width={24}
        height={24}
        className="invert"
      />
    </button>
  );
};

export default WhatsAppButton;
