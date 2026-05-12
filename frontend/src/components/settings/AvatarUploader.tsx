"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Upload, Trash2 } from "lucide-react";
import { profileApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface AvatarUploaderProps {
  /** Current avatar URL (null = show initials) */
  avatarUrl: string | null | undefined;
  /** First name + last name string used for initials/alt fallback */
  displayName: string;
  /** Optional secondary line shown next to the avatar (typically email) */
  secondaryLine?: string;
  /** Primary line shown next to the avatar (defaults to displayName) */
  primaryLine?: string;
  /** Size in px (default 96) */
  size?: number;
}

export default function AvatarUploader({
  avatarUrl,
  displayName,
  secondaryLine,
  primaryLine,
  size = 96,
}: AvatarUploaderProps) {
  const t = useTranslations("commonSettings");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { refreshUser } = useAuth();

  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) closeMenu();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen, closeMenu]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { url } = await profileApi.uploadAvatar(file);
      await profileApi.update({ avatar: url });
      await refreshUser();
      toast.success(t("profileSaved"));
    } catch {
      toast.error(t("avatarUploadError"));
    }
    e.target.value = "";
  };

  const handleRemove = async () => {
    try {
      await profileApi.update({ avatar: null });
      await refreshUser();
      toast.success(t("profileSaved"));
    } catch {
      toast.error(t("avatarUploadError"));
    }
  };

  const initials = (displayName.trim() || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-col sm:flex-row items-start gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        {avatarUrl ? (
          <div className="rounded-full overflow-hidden bg-[var(--color-border-subtle)]" style={{ width: size, height: size }}>
            <Image
              src={avatarUrl}
              alt={displayName}
              width={size}
              height={size}
              className="object-cover w-full h-full"
              unoptimized
            />
          </div>
        ) : (
          <div
            className="rounded-full bg-[var(--color-border)] flex items-center justify-center text-2xl font-bold text-[var(--color-text-secondary)]"
            style={{ width: size, height: size }}
          >
            {initials}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleUpload}
        />

        <div ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={t("changePhoto")}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            className={`absolute bottom-0 ${isRTL ? "left-0" : "right-0"} w-7 h-7 bg-[var(--color-primary)] rounded-full flex items-center justify-center border-2 border-white cursor-pointer hover:bg-[var(--color-primary-dark)] transition-colors`}
          >
            <Pencil className="w-3.5 h-3.5 text-white" />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className={`absolute top-full mt-1 ${isRTL ? "right-0" : "left-0"} bg-[var(--color-surface-card)] rounded-lg shadow-lg border border-[var(--color-border)] py-1 z-50 min-w-[160px]`}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => { inputRef.current?.click(); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[var(--color-text-secondary)]" />
                {t("uploadPhoto")}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { handleRemove(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  {t("removePhoto")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {(primaryLine || displayName || secondaryLine) && (
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] truncate">
            {primaryLine || displayName}
          </h3>
          {secondaryLine && (
            <p className="text-sm text-[var(--color-text-secondary)] truncate">{secondaryLine}</p>
          )}
        </div>
      )}
    </div>
  );
}
