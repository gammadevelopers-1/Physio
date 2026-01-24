import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Image from "next/image";
import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[var(--surface-default)]">
      <Navbar />

      {/* About Hero Section */}
      <section className="bg-[var(--surface-intense)]">
        <div className="flex flex-col lg:flex-row min-h-[400px] lg:min-h-[600px]">
          {/* Left Content */}
          <div className="flex-1 bg-[var(--surface-intense)] flex items-center justify-center px-6 py-12 md:px-12 md:py-16 lg:px-16 lg:py-20 order-2 lg:order-1">
            <div className="max-w-[480px]">
              <h1
                className="text-[var(--on-surface-default)] mb-4 md:mb-6"
                style={{
                  fontSize: "var(--typeface-font-styles-display-base)",
                  fontWeight: 600,
                  lineHeight: "100%",
                  letterSpacing: "-1.2px"
                }}
              >
                About Us
              </h1>

              <p
                className="text-[var(--on-surface-default)] mb-6 md:mb-8"
                style={{
                  fontSize: "var(--typeface-font-styles-heading-subheading)",
                  fontWeight: 400,
                  lineHeight: "28px"
                }}
              >
                Our platform is a fully NELC-compliant digital learning ecosystem designed specifically for the health sector. We deliver high-quality, accredited training through a secure, bilingual (Arabic/English) platform that supports self-paced learning, live virtual sessions, and advanced learner analytics — ensuring excellence, accessibility, and regulatory alignment.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <Link
                href="/courses"
                className="flex items-center justify-center h-11 md:h-12 px-5 md:px-6 py-3 btn-gold text-[var(--on-surface-inverse)] rounded-xl font-medium transition-colors text-sm md:text-base"
              >
                Explore Training Programs
              </Link>

              <Link
                href="/get-started"
                className="flex items-center justify-center h-11 md:h-12 px-5 md:px-6 py-3 bg-[var(--surface-intense)] text-[var(--on-surface-default)] rounded-xl font-medium border border-[var(--outline-subtle)] transition-colors hover:bg-[var(--surface-container-low)] text-sm md:text-base"
              >
                Get Started
              </Link>
            </div>
            </div>
          </div>

          {/* Right Image */}
          <div className="flex-1 relative h-[434px] lg:h-auto lg:min-h-[600px] order-1 lg:order-2">
            {/* Mobile Image */}
            <Image
              src="/images/image_486_mobile.png"
              alt="Healthcare professionals in training"
              fill
              className="object-cover lg:hidden"
              priority
            />
            {/* Desktop Image */}
            <Image
              src="/images/image_485.png"
              alt="Healthcare professionals in training"
              fill
              className="object-cover object-center hidden lg:block"
              priority
            />
            {/* Gradient overlay for smooth blending - horizontal on desktop */}
            <div
              className="absolute inset-0 pointer-events-none hidden lg:block"
              style={{
                background: "linear-gradient(to right, #ffffff 0%, rgba(255,255,255,0.7) 15%, rgba(255,255,255,0) 45%)"
              }}
            />
            {/* Gradient overlay - vertical on mobile */}
            <div
              className="absolute inset-0 pointer-events-none lg:hidden"
              style={{
                background: "linear-gradient(to bottom, rgba(255,255,255,0) 60%, rgba(255,255,255,0.8) 85%, #ffffff 100%)"
              }}
            />
          </div>
        </div>
      </section>

      {/* Compliance & Standards Section */}
      <section className="bg-[var(--surface-intense)] px-6 py-16 md:px-12 md:py-20 lg:px-16 lg:py-24">
        <div className="flex flex-col items-center justify-center max-w-[800px] mx-auto text-center">
          <h2
            className="text-[var(--on-surface-default)] mb-6 md:mb-8"
            style={{
              fontSize: "var(--typeface-font-styles-heading-h1)",
              fontWeight: 600,
              lineHeight: "100%",
              letterSpacing: "-0.24px"
            }}
          >
            Compliance & Standards
          </h2>

          <div className="flex flex-col gap-2 mb-8 md:mb-10">
            <p
              className="text-[var(--on-surface-variant)]"
              style={{
                fontSize: "var(--typeface-font-styles-heading-subheading)",
                fontWeight: 400,
                lineHeight: "28px"
              }}
            >
              Fully aligned with NELC eLearning standards for the health sector
            </p>
            <p
              className="text-[var(--on-surface-variant)]"
              style={{
                fontSize: "var(--typeface-font-styles-heading-subheading)",
                fontWeight: 400,
                lineHeight: "28px"
              }}
            >
              Structured learning objectives, assessments, and certification workflows
            </p>
            <p
              className="text-[var(--on-surface-variant)]"
              style={{
                fontSize: "var(--typeface-font-styles-heading-subheading)",
                fontWeight: 400,
                lineHeight: "28px"
              }}
            >
              Comprehensive compliance documentation and audit readiness
            </p>
            <p
              className="text-[var(--on-surface-variant)]"
              style={{
                fontSize: "var(--typeface-font-styles-heading-subheading)",
                fontWeight: 400,
                lineHeight: "28px"
              }}
            >
              Secure data handling and learner privacy controls
            </p>
          </div>

          <Link
            href="/programs"
            className="flex items-center justify-center h-11 md:h-12 px-6 md:px-8 py-3 bg-transparent text-[var(--on-surface-default)] rounded-xl font-medium border border-[var(--outline-default)] text-sm md:text-base transition-all duration-300 hover:bg-[var(--outline-default)] hover:text-[var(--on-surface-inverse)] hover:scale-105 hover:shadow-lg"
          >
            View All Programs
          </Link>
        </div>
      </section>

      {/* Learning Experience Section */}
      <section className="bg-[var(--surface-intense)] px-6 py-16 md:px-12 md:py-20 lg:px-16 lg:py-24">
        <div className="flex flex-col items-center justify-center max-w-[1200px] mx-auto">
          <h2
            className="text-[var(--on-surface-default)] mb-3 md:mb-4 text-center"
            style={{
              fontSize: "var(--typeface-font-styles-heading-h1)",
              fontWeight: 600,
              lineHeight: "100%",
              letterSpacing: "-0.24px"
            }}
          >
            Learning Experience
          </h2>

          <p
            className="text-[var(--on-surface-variant)] mb-10 md:mb-14 text-center"
            style={{
              fontSize: "var(--typeface-font-styles-heading-subheading)",
              fontWeight: 400,
              lineHeight: "28px"
            }}
          >
            Flexible Learning for Modern Healthcare Professionals
          </p>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 w-full">
            {/* Card 1 - Self-paced courses */}
            <div className="relative pb-4">
              <div className="relative h-[220px] md:h-[250px] rounded-2xl overflow-hidden">
                <Image
                  src="/images/learning_exp1.png"
                  alt="Self-paced learning"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="relative -mt-12 mx-4 bg-[var(--surface-intense)] rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.08)] border border-[var(--outline-subtle)] p-5 md:p-6 text-center">
                <h3
                  className="text-[var(--on-surface-default)] font-semibold mb-3"
                  style={{ fontSize: "var(--typeface-font-styles-heading-h4)", fontWeight: 600 }}
                >
                  Self-paced accredited courses
                </h3>
                <Link
                  href="/courses"
                  className="inline-flex items-center gap-1 text-[var(--on-surface-secondary)] font-medium hover:opacity-80 transition-opacity px-5 py-2"
                  style={{ fontSize: "var(--typeface-font-styles-paragraph-text-s)" }}
                >
                  Read more
                  <span>→</span>
                </Link>
              </div>
            </div>

            {/* Card 2 - Live lectures */}
            <div className="relative pb-4">
              <div className="relative h-[220px] md:h-[250px] rounded-2xl overflow-hidden">
                <Image
                  src="/images/learning_exp2.png"
                  alt="Zoom-based live lectures"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="relative -mt-12 mx-4 bg-[var(--surface-intense)] rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.08)] border border-[var(--outline-subtle)] p-5 md:p-6 text-center">
                <h3
                  className="text-[var(--on-surface-default)] font-semibold mb-3"
                  style={{ fontSize: "var(--typeface-font-styles-heading-h4)", fontWeight: 600 }}
                >
                  Zoom-based live lectures and workshops
                </h3>
                <Link
                  href="/workshops"
                  className="inline-flex items-center gap-1 text-[var(--on-surface-secondary)] font-medium hover:opacity-80 transition-opacity px-5 py-2"
                  style={{ fontSize: "var(--typeface-font-styles-paragraph-text-s)" }}
                >
                  Read more
                  <span>→</span>
                </Link>
              </div>
            </div>

            {/* Card 3 - Digital certificates */}
            <div className="relative pb-4">
              <div className="relative h-[220px] md:h-[250px] rounded-2xl overflow-hidden">
                <Image
                  src="/images/learning_exp3.png"
                  alt="Digital certificates"
                  fill
                  className="object-cover object-top"
                />
              </div>
              <div className="relative -mt-12 mx-4 bg-[var(--surface-intense)] rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.08)] border border-[var(--outline-subtle)] p-5 md:p-6 text-center">
                <h3
                  className="text-[var(--on-surface-default)] font-semibold mb-3"
                  style={{ fontSize: "var(--typeface-font-styles-heading-h4)", fontWeight: 600 }}
                >
                  Digital certificates upon completion
                </h3>
                <Link
                  href="/certificates"
                  className="inline-flex items-center gap-1 text-[var(--on-surface-secondary)] font-medium hover:opacity-80 transition-opacity px-5 py-2"
                  style={{ fontSize: "var(--typeface-font-styles-paragraph-text-s)" }}
                >
                  Read more
                  <span>→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Capabilities Section */}
      <section className="bg-[var(--surface-default)] px-6 py-16 md:px-12 md:py-20 lg:px-16 lg:py-24">
        <div className="flex flex-col items-center justify-center max-w-[1200px] mx-auto">
          <h2
            className="text-[var(--on-surface-default)] mb-3 md:mb-4 text-center"
            style={{
              fontSize: "var(--typeface-font-styles-heading-h1)",
              fontWeight: 600,
              lineHeight: "100%",
              letterSpacing: "-0.24px"
            }}
          >
            Platform Capabilities
          </h2>

          <p
            className="text-[var(--on-surface-default)] mb-10 md:mb-14 text-center"
            style={{
              fontSize: "var(--typeface-font-styles-heading-subheading)",
              fontWeight: 400,
              lineHeight: "28px"
            }}
          >
            Powerful Tools for Learners and Administrators
          </p>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 w-full">
            {/* Feature 1 - Bilingual Interface */}
            <div className="bg-[var(--surface-intense)] rounded-2xl p-6 md:p-8 text-center border border-[var(--outline-subtle)]">
              <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--on-surface-default)]">
                  <path d="M5 8l6 6" />
                  <path d="M4 14l6-6 2-3" />
                  <path d="M2 5h12" />
                  <path d="M7 2h1" />
                  <path d="M22 22l-5-10-5 10" />
                  <path d="M14 18h6" />
                </svg>
              </div>
              <h3
                className="text-[var(--on-surface-default)] mb-2"
                style={{
                  fontSize: "var(--typeface-font-styles-heading-h5)",
                  fontWeight: 600,
                  lineHeight: "normal"
                }}
              >
                Bilingual Interface
              </h3>
              <p
                className="text-[var(--on-surface-variant)]"
                style={{
                  fontSize: "var(--typeface-font-styles-paragraph-text-s)",
                  fontWeight: 400,
                  lineHeight: "20px"
                }}
              >
                Seamless Arabic and English language support
              </p>
            </div>

            {/* Feature 2 - Advanced Dashboards */}
            <div className="bg-[var(--surface-intense)] rounded-2xl p-6 md:p-8 text-center border border-[var(--outline-subtle)]">
              <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--on-surface-default)]">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </div>
              <h3
                className="text-[var(--on-surface-default)] mb-2"
                style={{
                  fontSize: "var(--typeface-font-styles-heading-h5)",
                  fontWeight: 600,
                  lineHeight: "normal"
                }}
              >
                Advanced Dashboards
              </h3>
              <p
                className="text-[var(--on-surface-variant)]"
                style={{
                  fontSize: "var(--typeface-font-styles-paragraph-text-s)",
                  fontWeight: 400,
                  lineHeight: "20px"
                }}
              >
                Track learner progress, performance, and engagement
              </p>
            </div>

            {/* Feature 3 - Secure Payments */}
            <div className="bg-[var(--surface-intense)] rounded-2xl p-6 md:p-8 text-center border border-[var(--outline-subtle)]">
              <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--on-surface-default)]">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
              </div>
              <h3
                className="text-[var(--on-surface-default)] mb-2"
                style={{
                  fontSize: "var(--typeface-font-styles-heading-h5)",
                  fontWeight: 600,
                  lineHeight: "normal"
                }}
              >
                Secure Payments
              </h3>
              <p
                className="text-[var(--on-surface-variant)]"
                style={{
                  fontSize: "var(--typeface-font-styles-paragraph-text-s)",
                  fontWeight: 400,
                  lineHeight: "20px"
                }}
              >
                Encrypted transactions and controlled access
              </p>
            </div>

            {/* Feature 4 - Instructor Management */}
            <div className="bg-[var(--surface-intense)] rounded-2xl p-6 md:p-8 text-center border border-[var(--outline-subtle)]">
              <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--on-surface-default)]">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3
                className="text-[var(--on-surface-default)] mb-2"
                style={{
                  fontSize: "var(--typeface-font-styles-heading-h5)",
                  fontWeight: 600,
                  lineHeight: "normal"
                }}
              >
                Instructor Management
              </h3>
              <p
                className="text-[var(--on-surface-variant)]"
                style={{
                  fontSize: "var(--typeface-font-styles-paragraph-text-s)",
                  fontWeight: 400,
                  lineHeight: "20px"
                }}
              >
                Manage trainers, schedules, and course delivery
              </p>
            </div>

            {/* Feature 5 - Reporting & Analytics */}
            <div className="bg-[var(--surface-intense)] rounded-2xl p-6 md:p-8 text-center border border-[var(--outline-subtle)]">
              <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--on-surface-default)]">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <h3
                className="text-[var(--on-surface-default)] mb-2"
                style={{
                  fontSize: "var(--typeface-font-styles-heading-h5)",
                  fontWeight: 600,
                  lineHeight: "normal"
                }}
              >
                Reporting & Analytics
              </h3>
              <p
                className="text-[var(--on-surface-variant)]"
                style={{
                  fontSize: "var(--typeface-font-styles-paragraph-text-s)",
                  fontWeight: 400,
                  lineHeight: "20px"
                }}
              >
                Exportable reports aligned with NELC requirements
              </p>
            </div>

            {/* Feature 6 - Role-based Access */}
            <div className="bg-[var(--surface-intense)] rounded-2xl p-6 md:p-8 text-center border border-[var(--outline-subtle)]">
              <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--on-surface-default)]">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <h3
                className="text-[var(--on-surface-default)] mb-2"
                style={{
                  fontSize: "var(--typeface-font-styles-heading-h5)",
                  fontWeight: 600,
                  lineHeight: "normal"
                }}
              >
                Role-based Access
              </h3>
              <p
                className="text-[var(--on-surface-variant)]"
                style={{
                  fontSize: "var(--typeface-font-styles-paragraph-text-s)",
                  fontWeight: 400,
                  lineHeight: "20px"
                }}
              >
                Controlled permissions for learners, instructors, and admins
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
