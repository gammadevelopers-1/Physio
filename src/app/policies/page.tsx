"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const LearningPolicies = () => {
  const [activeSection, setActiveSection] = useState("general");

  const sections = [
    { id: "general", label: "1. General Provisions" },
    { id: "attendance", label: "2. Attendance Policy" },
    { id: "assessment", label: "3. Assessment & Grading" },
    { id: "integrity", label: "4. Academic Integrity" },
    { id: "intellectual", label: "5. Intellectual Property" },
    { id: "cancellation", label: "6. Cancellation & Refunds" },
    { id: "technical", label: "7. Technical Requirements" },
    { id: "privacy", label: "8. Privacy & Data Protection" },
  ];

  useEffect(() => {
    const handleScroll = () => {
      const sectionElements = sections.map((section) =>
        document.getElementById(section.id)
      );

      for (let i = sectionElements.length - 1; i >= 0; i--) {
        const element = sectionElements[i];
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 200) {
            setActiveSection(sections[i].id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const navbarHeight = 88;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - navbarHeight - 20;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  return (
    <main className="min-h-screen bg-[var(--surface-default)] pb-20 lg:pb-0">
      <Navbar />

      {/* Main Content Section */}
      <section className="bg-[#EEF3F7] px-4 md:px-16 py-12 md:py-24">
        {/* Header */}
        <div className="flex flex-col gap-1 mb-8 text-[var(--on-surface-default)]">
          <h1
            className="font-semibold tracking-[-0.24px]"
            style={{ fontSize: "var(--typeface-font-styles-heading-h1)" }}
          >
            Learning Policies
          </h1>
          <p
            className="leading-7"
            style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
          >
            Last Updated: January 2026
          </p>
        </div>

        {/* Content Container */}
        <div className="flex flex-col lg:flex-row gap-8 w-full">
          {/* Sidebar Navigation - Hidden on mobile */}
          <div className="hidden lg:block lg:w-[320px] xl:w-[395px] shrink-0">
            <div
              className="bg-white rounded-2xl p-8 sticky top-24 shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]"
            >
              <nav className="flex flex-col gap-6">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`text-left leading-7 transition-colors cursor-pointer ${
                      activeSection === section.id
                        ? "text-[var(--on-surface-default)] font-medium"
                        : "text-[var(--on-surface-default)] hover:text-[var(--on-surface-primary)]"
                    }`}
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    {section.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div
              className="bg-white rounded-2xl p-6 md:p-8 shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]"
            >
              <div className="flex flex-col gap-12">
                {/* Section 1: General Provisions */}
                <section id="general" className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    1. General Provisions
                  </h2>
                  <p
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    PhysioGuidance is committed to providing high-quality medical education in
                    compliance with the National eLearning Center (NELC) and the Saudi Commission for
                    Health Specialties (SCFHS). By enrolling in our courses, learners agree to adhere to the
                    policies outlined below. These policies are subject to updates in accordance with KSA
                    regulations.
                  </p>
                </section>

                {/* Section 2: Attendance Policy */}
                <section id="attendance" className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    2. Attendance Policy (CME Requirements)
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-4">
                      To ensure the integrity of Continuing Medical Education (CME) hours, strictly monitored
                      attendance is required:
                    </p>
                    <ul className="list-disc">
                      <li className="ml-8 mb-2">
                        <span className="leading-7">
                          <strong>Live Webinars:</strong> Learners must attend at least 80% of the live session duration to
                          qualify for a certificate. Attendance is tracked automatically via system logs.
                        </span>
                      </li>
                      <li className="ml-8 mb-2">
                        <span className="leading-7">
                          <strong>Recorded Courses:</strong> Learners must view 100% of the video content and complete all
                          interactive modules.
                        </span>
                      </li>
                      <li className="ml-8">
                        <span className="leading-7">
                          <strong>Failure to Attend:</strong> If the minimum attendance threshold is not met, the learner will not
                          be eligible for CME hours and must retake the course.
                        </span>
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 3: Assessment & Grading */}
                <section id="assessment" className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    3. Assessment & Grading
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-4">
                      <strong>Passing Score:</strong> A minimum score of 70% on the final assessment is required to generate
                      a completion certificate.
                    </p>
                    <p className="mb-4">
                      <strong>Retake Policy:</strong> Learners are granted three (3) attempts to pass the final exam. If a learner
                      fails all three attempts, they must re-enroll in the course to reset their progress.
                    </p>
                    <p>
                      <strong>Feedback:</strong> Automated feedback is provided immediately after quiz submission to
                      facilitate learning retention.
                    </p>
                  </div>
                </section>

                {/* Section 4: Academic Integrity */}
                <section id="integrity" className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    4. Academic Integrity
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-4">
                      PhysioGuidance enforces a zero-tolerance policy towards academic dishonesty.
                    </p>
                    <ul className="list-disc">
                      <li className="ml-8 mb-2">
                        <span className="leading-7">
                          <strong>Identity Verification:</strong> Learners must use their own SCFHS license number and legal
                          name. Impersonation is a violation of Saudi law.
                        </span>
                      </li>
                      <li className="ml-8">
                        <span className="leading-7">
                          <strong>Plagiarism & Cheating:</strong> Any attempt to manipulate assessment scores or share quiz
                          answers will result in immediate account suspension and the revocation of any issued
                          certificates.
                        </span>
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 5: Intellectual Property Rights */}
                <section id="intellectual" className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    5. Intellectual Property Rights
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-4">
                      All course materials, including videos, slides, PDFs, and assessments, are the exclusive
                      property of PhysioGuidance and its instructors.
                    </p>
                    <ul className="list-disc">
                      <li className="ml-8 mb-2">
                        <span className="leading-7">
                          <strong>Usage:</strong> Materials are for personal educational use only.
                        </span>
                      </li>
                      <li className="ml-8">
                        <span className="leading-7">
                          <strong>Distribution:</strong> Unauthorized recording, reproduction, or sharing of course content on
                          public platforms is strictly prohibited and subject to legal action under Saudi
                          Intellectual Property laws.
                        </span>
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 6: Cancellation & Refund Policy */}
                <section id="cancellation" className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    6. Cancellation & Refund Policy
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-4">
                      <strong>Course Cancellation:</strong> If PhysioGuidance cancels a live course, learners are entitled to a
                      100% refund or a credit for future courses.
                    </p>
                    <p className="mb-2">
                      <strong>Learner Withdrawal:</strong>
                    </p>
                    <ul className="list-disc">
                      <li className="ml-8 mb-2">
                        <span className="leading-7">
                          <strong>Self-Paced Courses:</strong> Refunds are available within 48 hours of purchase, provided the
                          learner has not accessed more than 10% of the content or attempted the final exam.
                        </span>
                      </li>
                      <li className="ml-8">
                        <span className="leading-7">
                          <strong>Live Courses:</strong> Refunds are available up to 3 days prior to the start date. No refunds
                          will be issued for &quot;no-shows.&quot;
                        </span>
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 7: Technical Requirements */}
                <section id="technical" className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    7. Technical Requirements
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-4">To ensure a seamless learning experience, learners must have:</p>
                    <ul className="list-disc">
                      <li className="ml-8 mb-2">
                        <span className="leading-7">
                          A stable internet connection (minimum 2 Mbps download speed).
                        </span>
                      </li>
                      <li className="ml-8 mb-2">
                        <span className="leading-7">
                          A compatible device (Desktop, Laptop, or Tablet) with an updated web browser
                          (Chrome, Edge, or Safari).
                        </span>
                      </li>
                      <li className="ml-8">
                        <span className="leading-7">
                          Speakers or headphones for audio content.
                        </span>
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 8: Privacy & Data Protection */}
                <section id="privacy" className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    8. Privacy & Data Protection
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-4">
                      We adhere to the National Data Governance Policies issued by SDAIA (Saudi Data & AI
                      Authority).
                    </p>
                    <ul className="list-disc">
                      <li className="ml-8 mb-2">
                        <span className="leading-7">
                          <strong>Data Usage:</strong> Your personal data (Name, License Number, Email) is shared strictly with
                          SCFHS (Mumaris Plus) for the purpose of recording CME hours.
                        </span>
                      </li>
                      <li className="ml-8">
                        <span className="leading-7">
                          <strong>Confidentiality:</strong> We do not sell or share your data with third-party advertisers.
                        </span>
                      </li>
                    </ul>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default LearningPolicies;
