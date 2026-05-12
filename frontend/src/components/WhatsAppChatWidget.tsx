"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";

interface WhatsAppChatWidgetProps {
  enabled?: boolean | null;
  phoneNumber?: string | null;
  companyName?: string | null;
  greeting?: string | null;
  replyTime?: string | null;
  locale?: string;
}

const COPY: Record<string, { placeholder: string; send: string; online: string; defaultGreeting: string; defaultReply: string }> = {
  en: {
    placeholder: "Type your message...",
    send: "Send",
    online: "Online",
    defaultGreeting: "Hi! 👋 How can we help you today?",
    defaultReply: "Typically replies within an hour",
  },
  ar: {
    placeholder: "اكتب رسالتك...",
    send: "إرسال",
    online: "متصل",
    defaultGreeting: "مرحبًا! 👋 كيف يمكننا مساعدتك اليوم؟",
    defaultReply: "عادةً ما نرد خلال ساعة",
  },
};

const sanitizePhone = (raw: string) => raw.replace(/[^\d]/g, "");

const STORAGE_KEY = "physioguidance:whatsapp-position";
const DRAG_THRESHOLD = 5;
const VIEWPORT_PAD = 8;
const POPUP_GAP = 12;

const WhatsAppChatWidget = ({
  enabled,
  phoneNumber,
  companyName,
  greeting,
  replyTime,
  locale = "en",
}: WhatsAppChatWidgetProps) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    posX: number;
    posY: number;
  } | null>(null);
  const movedRef = useRef(false);

  const copy = COPY[locale] ?? COPY.en;
  const isRTL = locale === "ar";
  const cleanPhone = phoneNumber ? sanitizePhone(phoneNumber) : "";

  // Hide on authenticated dashboard routes — WhatsApp is for the public marketing site only.
  const pathname = usePathname();
  const isDashboardRoute = pathname?.includes("/dashboard");

  // Load saved position from localStorage on mount
  useEffect(() => {
    setHydrated(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
          setPosition(parsed);
        }
      }
    } catch {
      // ignore corrupted storage
    }
  }, []);

  // Clamp button position to viewport on resize
  useEffect(() => {
    if (!position) return;
    const onResize = () => {
      const size = window.innerWidth < 1024 ? 48 : 56;
      setPosition((p) => {
        if (!p) return p;
        return {
          x: Math.max(VIEWPORT_PAD, Math.min(p.x, window.innerWidth - size - VIEWPORT_PAD)),
          y: Math.max(VIEWPORT_PAD, Math.min(p.y, window.innerHeight - size - VIEWPORT_PAD)),
        };
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [position]);

  useEffect(() => {
    if (open && textareaRef.current) {
      const id = window.setTimeout(() => textareaRef.current?.focus(), 250);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;
    buttonRef.current.setPointerCapture(e.pointerId);
    movedRef.current = false;
    const rect = buttonRef.current.getBoundingClientRect();
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      posX: rect.left,
      posY: rect.top,
    };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.pointerX;
    const dy = e.clientY - dragStartRef.current.pointerY;
    if (!movedRef.current && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) {
      return;
    }
    movedRef.current = true;
    const size = window.innerWidth < 1024 ? 48 : 56;
    const newX = dragStartRef.current.posX + dx;
    const newY = dragStartRef.current.posY + dy;
    setPosition({
      x: Math.max(VIEWPORT_PAD, Math.min(newX, window.innerWidth - size - VIEWPORT_PAD)),
      y: Math.max(VIEWPORT_PAD, Math.min(newY, window.innerHeight - size - VIEWPORT_PAD)),
    });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (buttonRef.current?.hasPointerCapture(e.pointerId)) {
      buttonRef.current.releasePointerCapture(e.pointerId);
    }
    if (movedRef.current && position) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
      } catch {
        // ignore storage failure
      }
    }
    dragStartRef.current = null;
  }, [position]);

  const handleButtonClick = useCallback(() => {
    if (movedRef.current) {
      // suppress click immediately following a drag
      movedRef.current = false;
      return;
    }
    setOpen((v) => !v);
  }, []);

  if (!enabled || !cleanPhone || isDashboardRoute) return null;

  const handleSend = () => {
    const text = message.trim();
    const url = text
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/${cleanPhone}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setMessage("");
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const displayName = companyName?.trim() || "PhysioGuidance";
  const displayGreeting = greeting?.trim() || copy.defaultGreeting;
  const displayReply = replyTime?.trim() || copy.defaultReply;

  // Compute popup position when button has been dragged.
  // If button is in upper half of viewport, popup opens below; otherwise above.
  // Horizontal: same x as button, clamped so popup stays within viewport.
  const popupStyle: React.CSSProperties | undefined = (() => {
    if (!hydrated || !position || typeof window === "undefined") return undefined;
    const buttonSize = window.innerWidth < 1024 ? 48 : 56;
    const popupMaxWidth = Math.min(360, window.innerWidth - 24);
    const popupBelow = position.y < window.innerHeight / 2;
    const left = Math.max(
      VIEWPORT_PAD,
      Math.min(position.x, window.innerWidth - popupMaxWidth - VIEWPORT_PAD),
    );
    if (popupBelow) {
      return { left, top: position.y + buttonSize + POPUP_GAP, right: "auto", bottom: "auto" };
    }
    return {
      left,
      bottom: window.innerHeight - position.y + POPUP_GAP,
      right: "auto",
      top: "auto",
    };
  })();

  const buttonStyle: React.CSSProperties | undefined = (hydrated && position)
    ? { left: position.x, top: position.y, right: "auto", bottom: "auto" }
    : undefined;

  return (
    <>
      {/* Chat Popup */}
      {open && (
        <div
          className={`fixed z-[9998] w-[calc(100vw-3rem)] max-w-[360px] max-h-[calc(100vh-8rem)] flex flex-col rounded-2xl overflow-hidden shadow-2xl ${
            popupStyle ? "" : "bottom-24 end-6"
          }`}
          style={{ direction: isRTL ? "rtl" : "ltr", ...popupStyle }}
          role="dialog"
          aria-label="WhatsApp chat"
        >
          {/* Header */}
          <div className="bg-[#075E54] text-white px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[15px] truncate">{displayName}</div>
              <div className="text-[12px] text-white/80 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-[#4ade80]" />
                {copy.online}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="text-white/80 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div
            className="flex-1 px-4 py-5 overflow-y-auto"
            style={{
              backgroundColor: "#ECE5DD",
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><circle cx='20' cy='20' r='1' fill='%23d4cdc1' opacity='0.4'/></svg>\")",
              minHeight: "180px",
            }}
          >
            <div className="bg-white rounded-lg rounded-tl-none px-3 py-2 max-w-[85%] shadow-sm">
              <p className="text-[14px] text-[#303030] whitespace-pre-wrap break-words leading-relaxed">
                {displayGreeting}
              </p>
              <span className="block text-[10px] text-[#999] mt-1 text-end">
                {displayReply}
              </span>
            </div>
          </div>

          {/* Input */}
          <div className="bg-[#F0F2F5] px-3 py-2 flex items-end gap-2 border-t border-[#e0e0e0]">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={copy.placeholder}
              rows={1}
              className="flex-1 resize-none px-3 py-2 rounded-2xl bg-white border-none outline-none text-[14px] text-[#303030] placeholder:text-[#999] max-h-[120px] focus:ring-2 focus:ring-[#25D366]/40"
              style={{ minHeight: "40px" }}
            />
            <button
              type="button"
              onClick={handleSend}
              aria-label={copy.send}
              className="w-10 h-10 rounded-full bg-[#25D366] hover:bg-[#1ea952] transition-colors flex items-center justify-center shrink-0 shadow-sm"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" style={{ transform: isRTL ? "scaleX(-1)" : undefined }}>
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating Button — draggable, position persists in localStorage */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleButtonClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label={open ? "Close WhatsApp chat" : "Open WhatsApp chat"}
        style={buttonStyle}
        className={`fixed z-[9999] w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-[#25D366] hover:bg-[#1ea952] transition-colors flex items-center justify-center shadow-lg hover:shadow-xl touch-none cursor-grab active:cursor-grabbing select-none ${
          buttonStyle ? "" : "bottom-6 end-6"
        }`}
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white pointer-events-none">
            <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="w-6 h-6 lg:w-7 lg:h-7 fill-white pointer-events-none">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
        )}
      </button>
    </>
  );
};

export default WhatsAppChatWidget;
