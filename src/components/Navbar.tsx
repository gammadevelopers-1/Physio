"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Globe, Search, ShoppingCart, Menu, X } from "lucide-react";
import BottomNav from "./BottomNav";

const Navbar = () => {
  const [isCoursesOpen, setIsCoursesOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav
      className="sticky top-0 z-50 w-full bg-[var(--surface-intense)] shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] px-4 py-3 md:px-16 md:py-5"
    >
      <div className="flex items-center justify-between w-full">
        {/* Left: Logo + Nav Links */}
        <div className="flex items-center gap-8">
          {/* Logo */}
          <Link href="/" className="relative h-10 w-10 md:h-12 md:w-12">
            <Image
              src="/images/logo.png"
              alt="PhysioGuidance Logo"
              width={48}
              height={48}
              className="object-contain"
            />
          </Link>

          {/* Nav Links - Hidden on mobile */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/"
              className="text-[var(--on-surface-variant)] text-[length:var(--typeface-font-styles-paragraph-text)] leading-6 hover:text-[var(--on-surface-default)] transition-colors"
            >
              Home
            </Link>

            <div className="relative">
              <button 
                onClick={() => setIsCoursesOpen(!isCoursesOpen)}
                className="flex items-center gap-1 cursor-pointer group"
              >
                <span className="text-[var(--on-surface-variant)] text-[length:var(--typeface-font-styles-paragraph-text)] leading-6 group-hover:text-[var(--on-surface-default)] transition-colors">
                  Courses
                </span>
                <ChevronDown 
                  className={`w-5 h-5 text-[var(--on-surface-variant)] transition-transform duration-200 ${isCoursesOpen ? 'rotate-180' : ''}`} 
                  strokeWidth={1.67} 
                />
              </button>
              
              {/* Dropdown Menu */}
              {isCoursesOpen && (
                <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border border-[var(--outline-subtle)] py-2 min-w-[180px] z-50">
                  <Link
                    href="/courses/accredited"
                    className="block px-4 py-2 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)] hover:text-[var(--on-surface-default)] transition-colors"
                    style={{ fontSize: "var(--typeface-font-styles-paragraph-text)" }}
                    onClick={() => setIsCoursesOpen(false)}
                  >
                    Accredited courses
                  </Link>
                  <Link
                    href="/courses/my-courses"
                    className="block px-4 py-2 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)] hover:text-[var(--on-surface-default)] transition-colors"
                    style={{ fontSize: "var(--typeface-font-styles-paragraph-text)" }}
                    onClick={() => setIsCoursesOpen(false)}
                  >
                    My courses
                  </Link>
                  <Link
                    href="/courses/archived"
                    className="block px-4 py-2 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)] hover:text-[var(--on-surface-default)] transition-colors"
                    style={{ fontSize: "var(--typeface-font-styles-paragraph-text)" }}
                    onClick={() => setIsCoursesOpen(false)}
                  >
                    Archived courses
                  </Link>
                </div>
              )}
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
          {/* Arabic Language Toggle - Always visible */}
          <button className="flex items-center gap-2 text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors">
            <span className="text-[length:var(--typeface-font-styles-paragraph-text)] leading-6">عربي</span>
            <Globe className="w-5 h-5" strokeWidth={1.67} />
          </button>

          {/* Separator - Hidden on mobile */}
          <div className="hidden md:block h-6 w-px bg-[var(--on-surface-variant)] opacity-30" />

          {/* Search Icon - Hidden on mobile */}
          <button className="hidden md:flex items-center justify-center text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors">
            <Search className="w-5 h-5" strokeWidth={1.67} />
          </button>

          {/* Cart Icon - Hidden on mobile */}
          <button className="hidden md:flex items-center justify-center text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors">
            <ShoppingCart className="w-5 h-5" strokeWidth={1.67} />
          </button>

          {/* Get Started Button - Hidden on mobile */}
          <button className="hidden md:flex items-center justify-center h-10 px-5 py-2 btn-gold text-[var(--on-surface-inverse)] rounded-xl text-sm font-medium">
            Get started
          </button>

          {/* Hamburger Menu - Visible only on mobile */}
          <button
            className="flex md:hidden items-center justify-center text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" strokeWidth={1.67} />
            ) : (
              <Menu className="w-6 h-6" strokeWidth={1.67} />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-[var(--surface-intense)] border-t border-[var(--outline-subtle)] shadow-lg">
          <div className="flex flex-col px-4 py-4">
            {/* Mobile Nav Links */}
            <Link
              href="/"
              className="py-3 text-[var(--on-surface-variant)] text-[length:var(--typeface-font-styles-paragraph-text)] leading-6 hover:text-[var(--on-surface-default)] transition-colors border-b border-[var(--outline-subtle)]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Home
            </Link>

            {/* Courses with dropdown */}
            <div className="border-b border-[var(--outline-subtle)]">
              <button
                onClick={() => setIsCoursesOpen(!isCoursesOpen)}
                className="flex items-center justify-between w-full py-3 text-[var(--on-surface-variant)] text-[length:var(--typeface-font-styles-paragraph-text)] leading-6 hover:text-[var(--on-surface-default)] transition-colors"
              >
                <span>Courses</span>
                <ChevronDown
                  className={`w-5 h-5 transition-transform duration-200 ${isCoursesOpen ? "rotate-180" : ""}`}
                  strokeWidth={1.67}
                />
              </button>
              {isCoursesOpen && (
                <div className="pl-4 pb-3 flex flex-col gap-2">
                  <Link
                    href="/courses/accredited"
                    className="py-2 text-[var(--on-surface-variant)] text-sm hover:text-[var(--on-surface-default)] transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Accredited courses
                  </Link>
                  <Link
                    href="/courses/my-courses"
                    className="py-2 text-[var(--on-surface-variant)] text-sm hover:text-[var(--on-surface-default)] transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    My courses
                  </Link>
                  <Link
                    href="/courses/archived"
                    className="py-2 text-[var(--on-surface-variant)] text-sm hover:text-[var(--on-surface-default)] transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Archived courses
                  </Link>
                </div>
              )}
            </div>

            <Link
              href="/become-trainer"
              className="py-3 text-[var(--on-surface-variant)] text-[length:var(--typeface-font-styles-paragraph-text)] leading-6 hover:text-[var(--on-surface-default)] transition-colors border-b border-[var(--outline-subtle)]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Become a Trainer
            </Link>

            <Link
              href="/archive"
              className="py-3 text-[var(--on-surface-variant)] text-[length:var(--typeface-font-styles-paragraph-text)] leading-6 hover:text-[var(--on-surface-default)] transition-colors border-b border-[var(--outline-subtle)]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Archive
            </Link>

            <Link
              href="/blogs"
              className="py-3 text-[var(--on-surface-variant)] text-[length:var(--typeface-font-styles-paragraph-text)] leading-6 hover:text-[var(--on-surface-default)] transition-colors border-b border-[var(--outline-subtle)]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Blogs
            </Link>

            <Link
              href="/about"
              className="py-3 text-[var(--on-surface-variant)] text-[length:var(--typeface-font-styles-paragraph-text)] leading-6 hover:text-[var(--on-surface-default)] transition-colors border-b border-[var(--outline-subtle)]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              About
            </Link>

            {/* Mobile Action Buttons */}
            <div className="flex items-center gap-4 pt-4">
              <button className="flex items-center justify-center text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors">
                <Search className="w-5 h-5" strokeWidth={1.67} />
              </button>
              <button className="flex items-center justify-center text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors">
                <ShoppingCart className="w-5 h-5" strokeWidth={1.67} />
              </button>
            </div>

            {/* Get Started Button */}
            <button className="mt-4 flex items-center justify-center h-11 px-5 py-2 btn-gold text-[var(--on-surface-inverse)] rounded-xl text-sm font-medium w-full">
              Get started
            </button>
          </div>
        </div>
      )}
  <BottomNav/>
    </nav>
  );
};

export default Navbar;
