"use client";

interface HighlightTextProps {
  text: string;
  highlight: string;
  className?: string;
  highlightClassName?: string;
}

const HighlightText = ({
  text,
  highlight,
  className = "",
  highlightClassName = "bg-yellow-200 text-[var(--on-surface-default)]",
}: HighlightTextProps) => {
  if (!highlight.trim()) {
    return <span className={className}>{text}</span>;
  }

  // Escape special regex characters
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const regex = new RegExp(`(${escapeRegex(highlight)})`, "gi");
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <mark key={index} className={`${highlightClassName} rounded px-0.5`}>
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </span>
  );
};

export default HighlightText;
