"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Search, X, Loader2 } from "lucide-react";

interface GlobalSearchBarProps {
  initialQuery?: string;
  onSearch?: (query: string) => void;
  onChange?: (query: string) => void;
  autoFocus?: boolean;
  variant?: "default" | "compact" | "hero";
  className?: string;
  isLoading?: boolean;
  showInstantSearch?: boolean;
  debounceMs?: number;
  placeholder?: string;
  placeholderMobile?: string;
}

const GlobalSearchBar = ({
  initialQuery = "",
  onSearch,
  onChange,
  autoFocus = false,
  variant = "default",
  className = "",
  isLoading = false,
  showInstantSearch = false,
  debounceMs = 300,
  placeholder,
  placeholderMobile,
}: GlobalSearchBarProps) => {
  const [query, setQuery] = useState(initialQuery);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("searchPage");
  const isRTL = locale === "ar";

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Debounced onChange for instant search
  useEffect(() => {
    if (showInstantSearch && onChange) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        onChange(query);
      }, debounceMs);
    }
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, onChange, showInstantSearch, debounceMs]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedQuery = query.trim();
      if (trimmedQuery) {
        if (onSearch) {
          onSearch(trimmedQuery);
        } else {
          router.push(`/${locale}/search?q=${encodeURIComponent(trimmedQuery)}`);
        }
      }
    },
    [query, onSearch, router, locale]
  );

  const handleClear = useCallback(() => {
    setQuery("");
    if (inputRef.current) {
      inputRef.current.focus();
    }
    if (onSearch) {
      onSearch("");
    }
  }, [onSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClear();
      }
    },
    [handleClear]
  );

  const getVariantStyles = () => {
    switch (variant) {
      case "compact":
        return {
          container: "h-10",
          input: "text-sm",
          icon: "w-4 h-4",
        };
      case "hero":
        return {
          container: "h-14 lg:h-16",
          input: "text-base lg:text-lg",
          icon: "w-5 h-5 lg:w-6 lg:h-6",
        };
      default:
        return {
          container: "h-12",
          input: "text-base",
          icon: "w-5 h-5",
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <form onSubmit={handleSubmit} className={`w-full ${className}`} dir={isRTL ? "rtl" : "ltr"}>
      <div
        className={`relative flex items-center ${styles.container} w-full bg-[var(--color-surface-card)] rounded-xl border transition-all duration-200 ${
          isFocused
            ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20"
            : "border-[var(--color-border-subtle)]"
        }`}
      >
        {/* Search Icon Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center justify-center px-4 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors disabled:opacity-70"
          aria-label={t("searchButton")}
        >
          {isLoading ? (
            <Loader2 className={`${styles.icon} animate-spin`} strokeWidth={1.67} />
          ) : (
            <Search className={styles.icon} strokeWidth={1.67} />
          )}
        </button>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={
            variant === "compact"
              ? (placeholderMobile ?? t("placeholderMobile"))
              : (placeholder ?? t("placeholder"))
          }
          className={`flex-1 h-full bg-transparent ${styles.input} text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none`}
        />

        {/* Clear Button */}
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center justify-center px-4 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label={t("clearButton")}
          >
            <X className={styles.icon} strokeWidth={1.67} />
          </button>
        )}
      </div>
    </form>
  );
};

export default GlobalSearchBar;
