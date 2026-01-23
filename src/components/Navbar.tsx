"use client";

import Image from "next/image";
import Link from "next/link";

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
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-[var(--on-surface-variant)]"
              >
                <path
                  d="M5 7.5L10 12.5L15 7.5"
                  stroke="currentColor"
                  strokeWidth="1.67"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
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
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z"
                stroke="currentColor"
                strokeWidth="1.67"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M1.66667 10H18.3333"
                stroke="currentColor"
                strokeWidth="1.67"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10 1.66667C12.0844 3.94863 13.269 6.91003 13.3333 10C13.269 13.09 12.0844 16.0514 10 18.3333C7.91558 16.0514 6.73098 13.09 6.66667 10C6.73098 6.91003 7.91558 3.94863 10 1.66667Z"
                stroke="currentColor"
                strokeWidth="1.67"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Separator */}
          <div className="h-6 w-px bg-[var(--on-surface-variant)] opacity-30" />

          {/* Search Icon */}
          <button className="flex items-center justify-center text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors">
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M17.5 17.5L13.875 13.875M15.8333 9.16667C15.8333 12.8486 12.8486 15.8333 9.16667 15.8333C5.48477 15.8333 2.5 12.8486 2.5 9.16667C2.5 5.48477 5.48477 2.5 9.16667 2.5C12.8486 2.5 15.8333 5.48477 15.8333 9.16667Z"
                stroke="currentColor"
                strokeWidth="1.67"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Cart Icon */}
          <button className="flex items-center justify-center text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors">
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1.66667 1.66667H3.33333L3.625 3.33333M4.16667 6.66667H17.5L14.1667 13.3333H5.83333M4.16667 6.66667L3.625 3.33333M4.16667 6.66667L5.83333 13.3333M3.625 3.33333H17.5M5.83333 16.6667C5.83333 17.1269 5.46024 17.5 5 17.5C4.53976 17.5 4.16667 17.1269 4.16667 16.6667C4.16667 16.2064 4.53976 15.8333 5 15.8333C5.46024 15.8333 5.83333 16.2064 5.83333 16.6667ZM15 16.6667C15 17.1269 14.6269 17.5 14.1667 17.5C13.7064 17.5 13.3333 17.1269 13.3333 16.6667C13.3333 16.2064 13.7064 15.8333 14.1667 15.8333C14.6269 15.8333 15 16.2064 15 16.6667Z"
                stroke="currentColor"
                strokeWidth="1.67"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
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
