"use client";

type IllustrationVariant =
  | "courses"
  | "certificates"
  | "sessions"
  | "tickets"
  | "calendar";

interface EmptyStateIllustrationProps {
  variant: IllustrationVariant;
  className?: string;
}

function CoursesIllustration() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Book */}
      <rect x="25" y="30" width="70" height="60" rx="4" fill="#EEF2FF" />
      <rect x="25" y="30" width="35" height="60" rx="4" fill="#E0E7FF" />
      <line x1="60" y1="30" x2="60" y2="90" stroke="#C7D2FE" strokeWidth="2" />
      {/* Lines on right page */}
      <rect x="66" y="42" width="22" height="3" rx="1.5" fill="#C7D2FE" />
      <rect x="66" y="50" width="18" height="3" rx="1.5" fill="#C7D2FE" />
      <rect x="66" y="58" width="20" height="3" rx="1.5" fill="#C7D2FE" />
      <rect x="66" y="66" width="14" height="3" rx="1.5" fill="#C7D2FE" />
      {/* Bookmark */}
      <path d="M80 30V44L84 40L88 44V30" fill="#818CF8" />
      {/* Graduation cap */}
      <path
        d="M50 20L60 14L70 20L60 26L50 20Z"
        fill="#6366F1"
        opacity="0.4"
      />
      <line
        x1="60"
        y1="20"
        x2="60"
        y2="30"
        stroke="#6366F1"
        strokeWidth="1.5"
        opacity="0.4"
      />
    </svg>
  );
}

function CertificatesIllustration() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Certificate paper */}
      <rect x="20" y="25" width="80" height="60" rx="4" fill="#FEF3C7" />
      <rect
        x="20"
        y="25"
        width="80"
        height="60"
        rx="4"
        stroke="#FCD34D"
        strokeWidth="2"
        fill="none"
      />
      {/* Header bar */}
      <rect x="35" y="33" width="50" height="4" rx="2" fill="#F59E0B" />
      {/* Content lines */}
      <rect x="30" y="45" width="60" height="3" rx="1.5" fill="#FDE68A" />
      <rect x="35" y="53" width="50" height="3" rx="1.5" fill="#FDE68A" />
      <rect x="40" y="61" width="40" height="3" rx="1.5" fill="#FDE68A" />
      {/* Seal/badge */}
      <circle cx="60" cy="78" r="10" fill="#F59E0B" opacity="0.3" />
      <circle cx="60" cy="78" r="6" fill="#F59E0B" opacity="0.5" />
      {/* Star on seal */}
      <path
        d="M60 73L61.5 76.5L65 77L62.5 79.5L63 83L60 81.5L57 83L57.5 79.5L55 77L58.5 76.5L60 73Z"
        fill="#F59E0B"
      />
      {/* Ribbon */}
      <path d="M55 88L60 95L54 92" stroke="#F59E0B" strokeWidth="1.5" />
      <path d="M65 88L60 95L66 92" stroke="#F59E0B" strokeWidth="1.5" />
    </svg>
  );
}

function SessionsIllustration() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Calendar body */}
      <rect x="22" y="30" width="76" height="65" rx="6" fill="#ECFDF5" />
      <rect x="22" y="30" width="76" height="16" rx="6" fill="#6EE7B7" />
      {/* Calendar rings */}
      <rect x="40" y="24" width="4" height="14" rx="2" fill="#34D399" />
      <rect x="76" y="24" width="4" height="14" rx="2" fill="#34D399" />
      {/* Date cells */}
      <rect x="30" y="52" width="14" height="14" rx="3" fill="#D1FAE5" />
      <rect x="53" y="52" width="14" height="14" rx="3" fill="#D1FAE5" />
      <rect x="76" y="52" width="14" height="14" rx="3" fill="#D1FAE5" />
      <rect x="30" y="72" width="14" height="14" rx="3" fill="#D1FAE5" />
      <rect x="53" y="72" width="14" height="14" rx="3" fill="#10B981" opacity="0.3" />
      <rect x="76" y="72" width="14" height="14" rx="3" fill="#D1FAE5" />
      {/* Highlighted date dot */}
      <circle cx="60" cy="79" r="3" fill="#10B981" />
    </svg>
  );
}

function TicketsIllustration() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Headset */}
      <path
        d="M40 65C40 50.088 49.4 38 60 38C70.6 38 80 50.088 80 65"
        stroke="#93C5FD"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      {/* Left ear */}
      <rect x="32" y="60" width="12" height="22" rx="6" fill="#60A5FA" />
      {/* Right ear */}
      <rect x="76" y="60" width="12" height="22" rx="6" fill="#60A5FA" />
      {/* Mic arm */}
      <path
        d="M76 76H68C66 76 64 78 64 80V85"
        stroke="#93C5FD"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Mic */}
      <circle cx="64" cy="88" r="4" fill="#3B82F6" />
      {/* Chat bubble */}
      <rect x="48" y="20" width="24" height="14" rx="4" fill="#DBEAFE" />
      <path d="M55 34L58 38L61 34" fill="#DBEAFE" />
      {/* Dots in bubble */}
      <circle cx="55" cy="27" r="1.5" fill="#60A5FA" />
      <circle cx="60" cy="27" r="1.5" fill="#60A5FA" />
      <circle cx="65" cy="27" r="1.5" fill="#60A5FA" />
    </svg>
  );
}

function CalendarIllustration() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Clock body */}
      <circle cx="60" cy="60" r="35" fill="#F3F4F6" />
      <circle
        cx="60"
        cy="60"
        r="35"
        stroke="#D1D5DB"
        strokeWidth="2"
        fill="none"
      />
      {/* Hour marks */}
      <rect x="59" y="28" width="2" height="8" rx="1" fill="#9CA3AF" />
      <rect x="59" y="84" width="2" height="8" rx="1" fill="#9CA3AF" />
      <rect x="28" y="59" width="8" height="2" rx="1" fill="#9CA3AF" />
      <rect x="84" y="59" width="8" height="2" rx="1" fill="#9CA3AF" />
      {/* Clock hands */}
      <line
        x1="60"
        y1="60"
        x2="60"
        y2="38"
        stroke="#6B7280"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1="60"
        y1="60"
        x2="76"
        y2="54"
        stroke="#9CA3AF"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Center dot */}
      <circle cx="60" cy="60" r="3" fill="#6B7280" />
    </svg>
  );
}

const ILLUSTRATIONS: Record<IllustrationVariant, () => React.ReactElement> = {
  courses: CoursesIllustration,
  certificates: CertificatesIllustration,
  sessions: SessionsIllustration,
  tickets: TicketsIllustration,
  calendar: CalendarIllustration,
};

export default function EmptyStateIllustration({
  variant,
  className = "",
}: EmptyStateIllustrationProps) {
  const Illustration = ILLUSTRATIONS[variant];
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Illustration />
    </div>
  );
}
