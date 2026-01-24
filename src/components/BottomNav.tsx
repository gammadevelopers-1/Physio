"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

const BottomNav = () => {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Home", icon: "/home-01.svg" },
    { href: "/search", label: "Search", icon: "/search-lg.svg" },
    { href: "/cart", label: "Cart", icon: "/file-02.svg" },
    { href: "/more", label: "More", icon: "/menu-01.svg" },
  ];

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--surface-default)] flex justify-between items-start px-3"
      style={{
        boxShadow: "0 -1px 2px 0 rgba(10, 13, 18, 0.05)",
      }}
    >
      {navItems.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center justify-center flex-1 py-3"
          >
            <div className="relative w-6 h-6">
              <Image
                src={item.icon}
                alt={item.label}
                width={24}
                height={24}
                className={isActive ? "filter-gold" : ""}
                style={{
                  filter: isActive
                    ? "invert(52%) sepia(53%) saturate(456%) hue-rotate(358deg) brightness(92%) contrast(89%)"
                    : "none",
                }}
              />
            </div>
            <span
              className={`mt-1 ${
                isActive
                  ? "text-[var(--surface-container-primary-2)]"
                  : "text-[var(--on-surface-variant)]"
              }`}
              style={{
                fontSize: "12px",
                fontWeight: 400,
                lineHeight: "16px",
              }}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomNav;
