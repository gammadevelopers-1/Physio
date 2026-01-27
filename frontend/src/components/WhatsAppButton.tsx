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
      className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-50 w-[48px] h-[48px] flex items-center justify-center rounded-full bg-[#25D366] hover:bg-[#20BD5A] transition-colors cursor-pointer shadow-[0px_2px_4px_rgba(0,0,0,0.1),0px_7px_7px_rgba(0,0,0,0.09),0px_16px_10px_rgba(0,0,0,0.05),0px_29px_11px_rgba(0,0,0,0.01),0px_45px_12px_rgba(0,0,0,0)]"
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
