"use client";

interface SaudiRiyalIconProps {
  className?: string;
  size?: number;
  strokeWidth?: number;
}

const SaudiRiyalIcon = ({ className = "", size = 20, strokeWidth = 2 }: SaudiRiyalIconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M16 4 L16 14 C16 17 14 19 11 19 L8 19" />
    <path d="M8 8 L8 17" />
    <line x1="5" y1="11" x2="19" y2="9" />
    <line x1="5" y1="15" x2="19" y2="13" />
  </svg>
);

export default SaudiRiyalIcon;
