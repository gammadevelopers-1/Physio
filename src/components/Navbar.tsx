"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Globe, Search, ShoppingCart, Menu, Home, FileText } from "lucide-react";

// Mobile Bottom Navigation Item
interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
}

const NavItem = ({ icon, label, isActive = false }: NavItemProps) => {
  return (
    <div className="flex flex-col gap-1 items-center px-[16.5px] py-[15px]">
      <div className={isActive ? "text-[#98773f]" : "text-[#4a4c4f]"}>
        {icon}
      </div>
      <span
        className={`text-xs leading-4 ${
          isActive ? "text-[#98773f]" : "text-[#4a4c4f]"
        }`}
      >
        {label}
      </span>
    </div>
  );
};

const Navbar = () => {
  const [isCoursesOpen, setIsCoursesOpen] = useState(false);
  const [isMobileNavVisible, setIsMobileNavVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show mobile navbar after scrolling past hero section
      setIsMobileNavVisible(window.scrollY > 500);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* Desktop Navbar - Hidden on mobile/tablet */}
      <nav
        className="hidden lg:block sticky top-0 z-50 w-full bg-[var(--surface-intense)] shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)]"
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

      {/* Mobile/Tablet Sticky Navbar - Shows on scroll, hidden on desktop */}
      {isMobileNavVisible && (
        <nav className="lg:hidden fixed top-0 left-0 right-0 z-50 w-full bg-white shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] px-4 py-3">
          <div className="flex items-center justify-between w-full">
            {/* Logo */}
            <Link href="/" className="relative h-8 w-8">
              <Image
                src="/images/logo.png"
                alt="PhysioGuidance Logo"
                width={32}
                height={32}
                className="object-contain"
              />
            </Link>

            {/* Right Actions */}
            <div className="flex items-center gap-4">
              {/* Language Selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#06080b]">عربي</span>
                <Globe className="w-5 h-5 text-[#06080b]" strokeWidth={1.5} />
              </div>

              {/* Menu Icon */}
              <button className="p-1">
                <Menu className="w-6 h-6 text-[#06080b]" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* Mobile/Tablet Bottom Navigation - Fixed at bottom, hidden on desktop */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#f9fbfd] shadow-[0px_-1px_2px_0px_rgba(10,13,18,0.05)] px-3 w-full">
        <div className="flex items-start justify-between gap-6">
          <NavItem
            icon={<Home className="w-6 h-6" strokeWidth={1.5} />}
            label="Home"
            isActive={true}
          />
          <NavItem
            icon={<Search className="w-6 h-6" strokeWidth={1.5} />}
            label="Search"
          />
          <NavItem
            icon={<FileText className="w-6 h-6" strokeWidth={1.5} />}
            label="Cart"
          />
          <NavItem
            icon={<Menu className="w-6 h-6" strokeWidth={1.5} />}
            label="More"
          />
        </div>
      </nav>
    </>
  );
};

export default Navbar;
