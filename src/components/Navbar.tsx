"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Globe, Search, ShoppingCart } from "lucide-react";

const Navbar = () => {
  return (
    <nav
      className="sticky top-0 z-50 w-full bg-[var(--surface-intense)] shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)]"
      style={{ padding: "20px 64px" }}
    >
      <div className="flex items-center justify-between w-full">
        {/* Left: Logo + Nav Links */}
        <div className="flex items-center gap-8">
          {/* Logo */}
          <Link href="/" className="relative h-12 w-12">
            <Image
              src="/images/logo.png"
              alt="PhysioGuidance Logo"
              width={48}
              height={48}
              className="object-contain"
            />
          </Link>

          {/* Nav Links */}
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="text-[var(--on-surface-variant)] text-[length:var(--typeface-font-styles-paragraph-text)] leading-6 hover:text-[var(--on-surface-default)] transition-colors"
            >
              Home
            </Link>

            <div className="flex items-center gap-1 cursor-pointer group">
              <span className="text-[var(--on-surface-variant)] text-[length:var(--typeface-font-styles-paragraph-text)] leading-6 group-hover:text-[var(--on-surface-default)] transition-colors">
                Courses
              </span>
              <ChevronDown className="w-5 h-5 text-[var(--on-surface-variant)]" strokeWidth={1.67} />
            </div>

            <Link
              href="/become-trainer"
              className="text-[var(--on-surface-variant)] text-[length:var(--typeface-font-styles-paragraph-text)] leading-6 hover:text-[var(--on-surface-default)] transition-colors"
            >
              Become a Trainer
            </Link>

            <Link
              href="/archive"
              className="text-[var(--on-surface-variant)] text-[length:var(--typeface-font-styles-paragraph-text)] leading-6 hover:text-[var(--on-surface-default)] transition-colors"
            >
              Archive
            </Link>

            <Link
              href="/blogs"
              className="text-[var(--on-surface-variant)] text-[length:var(--typeface-font-styles-paragraph-text)] leading-6 hover:text-[var(--on-surface-default)] transition-colors"
            >
              Blogs
            </Link>

            <Link
              href="/about"
              className="text-[var(--on-surface-variant)] text-[length:var(--typeface-font-styles-paragraph-text)] leading-6 hover:text-[var(--on-surface-default)] transition-colors"
            >
              About
            </Link>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
          {/* Arabic Language Toggle */}
          <button className="flex items-center gap-2 text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors">
            <span className="text-[length:var(--typeface-font-styles-paragraph-text)] leading-6">عربي</span>
            <Globe className="w-5 h-5" strokeWidth={1.67} />
          </button>

          {/* Separator */}
          <div className="h-6 w-px bg-[var(--on-surface-variant)] opacity-30" />

          {/* Search Icon */}
          <button className="flex items-center justify-center text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors">
            <Search className="w-5 h-5" strokeWidth={1.67} />
          </button>

          {/* Cart Icon */}
          <button className="flex items-center justify-center text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors">
            <ShoppingCart className="w-5 h-5" strokeWidth={1.67} />
          </button>

          {/* Get Started Button */}
          <button className="flex items-center justify-center h-10 px-5 py-2 btn-gold text-[var(--on-surface-inverse)] rounded-xl text-sm font-medium">
            Get started
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
