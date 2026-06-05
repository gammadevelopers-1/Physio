/**
 * Strapi Content Seeder
 *
 * This script populates Strapi with initial content from the frontend translation files.
 *
 * Usage:
 *   1. Make sure Strapi is running (npm run develop)
 *   2. Create an API token in Strapi Admin > Settings > API Tokens (with full access)
 *   3. Set the STRAPI_API_TOKEN environment variable or edit this script
 *   4. Run: node scripts/seed-content.js
 */

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || '8f41457b95b507a18e639cb788fc73a6655affac446cf5b6d3cf99d37b32a5db5c43346a196278e43c26661c939fdd752276beefcae02c07caf77405602f6ef6650a56b53b636c49552d68700ec8c75459d65fd2a6a471d09dd88f1e8e4914501c2f426fa2e706761fc1f8a7fed043c9ea5a750ad6a0972df4bf9764c86d78e9';

// English translations (copy from frontend/messages/en.json)
const enContent = {
  hero: {
    title: "Health Training &",
    titleLine2: "eLearning Courses",
    titleMobile: "Health Training & eLearning Courses",
    description: "Delivering NELC-compliant training, accredited programs, and live learning experiences for the health sector — all in one secure platform.",
    exploreButton: "Explore Training Programs",
    getStartedButton: "Get Started"
  },
  partners: {
    title: "Our Trusted Partners"
  },
  featuredCourses: {
    title: "Featured Programs",
    description: "Accredited, evidence-based healthcare training programs.",
    viewAllButton: "View All Programs",
    viewDetails: "View Details",
    liveOnline: "Live Online",
    cmeHours: "CME Hours"
  },
  becomeTrainer: {
    title: "Become a Trainer",
    description: "Join a network of accredited trainers delivering NELC-aligned healthcare education nationwide.",
    getStartedButton: "Get Started"
  },
  expertInstructors: {
    title: "Led by Expert Healthcare Instructors",
    description: "Learn from experienced clinicians, certified trainers, and subject-matter experts who deliver nationally aligned, evidence-based healthcare education."
  },
  testimonials: {
    title: "What Healthcare Professionals Say",
    description: "Feedback from healthcare professionals and institutions who have participated in our accredited training programs."
  },
  cta: {
    title: "Start Your Healthcare Learning Journey",
    description: "Access accredited, NELC-aligned training programs designed for healthcare professionals and institutions.",
    continueButton: "Get Started"
  },
  aboutPage: {
    heroTitle: "About Us",
    heroDescription: "Our platform is a fully NELC-compliant digital learning ecosystem designed specifically for the health sector. We deliver high-quality, accredited training through a secure, bilingual (Arabic/English) platform that supports self-paced learning, live virtual sessions, and advanced learner analytics — ensuring excellence, accessibility, and regulatory alignment.",
    heroExploreButtonLabel: "Explore Training Programs",
    heroGetStartedButtonLabel: "Get Started",
    complianceTitle: "Compliance & Standards",
    complianceItem1: "Fully aligned with NELC eLearning standards for the health sector",
    complianceItem2: "Structured learning objectives, assessments, and certification workflows",
    complianceItem3: "Comprehensive compliance documentation and audit readiness",
    complianceItem4: "Secure data handling and learner privacy controls",
    complianceButtonLabel: "View All Programs",
    learningTitle: "Learning Experience",
    learningSubtitle: "Flexible Learning for Modern Healthcare Professionals",
    learningCard1Title: "Self-paced accredited courses",
    learningCard2Title: "Zoom-based live lectures and workshops",
    learningCard3Title: "Digital certificates upon completion",
    learningReadMoreLabel: "Read more",
    capabilitiesTitle: "Platform Capabilities",
    capabilitiesSubtitle: "Powerful Tools for Learners and Administrators",
    feature1Title: "Bilingual Interface",
    feature1Description: "Seamless Arabic and English language support",
    feature2Title: "Advanced Dashboards",
    feature2Description: "Track learner progress, performance, and engagement",
    feature3Title: "Secure Payments",
    feature3Description: "Encrypted transactions and controlled access",
    feature4Title: "Instructor Management",
    feature4Description: "Manage trainers, schedules, and course delivery",
    feature5Title: "Reporting & Analytics",
    feature5Description: "Exportable reports aligned with NELC requirements",
    feature6Title: "Role-based Access",
    feature6Description: "Controlled permissions for learners, instructors, and admins"
  },
  becomeTrainerPage: {
    pageTitle: "Become a trainer",
    profileSectionTitle: "Profile",
    profilePhotoLabel: "Photo",
    profileAttachCVLabel: "Attach CV",
    profileFullNameLabel: "Full Name",
    profileFullNameArabicPlaceholder: "Arabic (As appears in the certificates)",
    profileFullNameEnglishPlaceholder: "English (As appears in the certificates)",
    profileEmailLabel: "Email address",
    profileMobileLabel: "Mobile Number",
    profileGenderLabel: "Gender",
    profileNationalityLabel: "Nationality",
    profileNationalIdLabel: "National/Iqama ID",
    profileProfessionLabel: "Profession",
    profileSpecialityLabel: "Speciality",
    profileQualificationLabel: "Qualification",
    profileRankLabel: "Rank",
    profileScfhsQuestion: "Do you have a classification number from scfhs?",
    profileTwitterLabel: "Twitter",
    profileLinkedInLabel: "LinkedIn",
    resumeSectionTitle: "Resume",
    resumeDescription: "Select how you'd like to submit your Resume: either create one directly within the app or upload an existing Resume file.",
    resumeUploadLabel: "Upload your resume",
    resumeCreateLabel: "Create your resume",
    resumeEducationLabel: "Education",
    resumeProfessionalSkillsLabel: "Professional Skills",
    resumeScientificResearchesLabel: "Scientific Researches",
    resumeTrainingExperienceLabel: "Training Experience",
    resumeClickToUploadLabel: "Click to upload",
    resumeOrDragDropLabel: "or drag and drop",
    resumePdfMaxSizeLabel: "PDF (max. 10MB)",
    bankAccountSectionTitle: "Bank Account",
    bankAccountHolderLabel: "Account Holder Name",
    bankNameLabel: "Bank Name",
    bankIbanLabel: "IBAN",
    cancelButtonLabel: "Cancel",
    saveButtonLabel: "Save",
    yesButtonLabel: "Yes",
    noButtonLabel: "No"
  },
  privacyPolicyPage: {
    title: "Learning Policies",
    lastUpdated: "Last Updated: January 2026",
    sections: [
      {
        sectionId: "general-terms",
        sidebarLabel: "1. General Terms",
        title: "1. General Terms",
        content: "PhysioGuidance is committed to providing high-quality medical education in compliance with the National eLearning Center (NELC) and the Saudi Commission for Health Specialties (SCFHS). By enrolling in our courses, learners agree to abide by the policies outlined below. These policies are subject to updates in accordance with the regulations of the Kingdom of Saudi Arabia."
      },
      {
        sectionId: "attendance-policy",
        sidebarLabel: "2. Attendance Policy",
        title: "2. Attendance Policy (CME Requirements)",
        content: "To ensure the integrity of Continuing Medical Education (CME) hours, attendance monitoring is strictly enforced:\n\n- Live Online Courses: Learners must attend at least 80% of the live session duration to qualify for a certificate. Attendance is tracked automatically via system logs.\n- Recorded Training Courses: Learners must view 100% of the video content and complete all interactive modules.\n- Failure to Attend: If the minimum attendance is not met, the learner will not be eligible for CME hours and must retake the course."
      },
      {
        sectionId: "assessment",
        sidebarLabel: "3. Assessment & Grades",
        title: "3. Assessment & Grades",
        content: "Passing Grade: A minimum score of 70% on the final assessment is required to generate a completion certificate.\n\nRetake Policy: Learners are granted three (3) attempts to pass the final exam. If the learner fails all three attempts, they must re-enroll in the course to reset their progress.\n\nFeedback: Formative feedback is provided immediately after exam submission to facilitate learning retention."
      },
      {
        sectionId: "academic-integrity",
        sidebarLabel: "4. Academic Integrity",
        title: "4. Academic Integrity",
        content: "PhysioGuidance enforces a zero-tolerance policy towards academic dishonesty.\n\n- Identity Verification: Learners must use their SCFHS license number and legal name. Impersonation is a violation of Saudi law.\n- Plagiarism & Cheating: Any attempt to manipulate assessment results or share exam answers will result in immediate account suspension and cancellation of any certificates issued."
      },
      {
        sectionId: "intellectual-property",
        sidebarLabel: "5. Intellectual Property",
        title: "5. Intellectual Property Rights",
        content: "All course materials, including videos, slides, PDFs, and assessments, are the exclusive property of PhysioGuidance and its instructors.\n\n- Usage: Materials are intended for personal educational use only.\n- Distribution: Unauthorized recording, reproduction, or sharing of course content on public platforms is strictly prohibited and subject to legal action under Saudi intellectual property laws."
      },
      {
        sectionId: "refund-policy",
        sidebarLabel: "6. Cancellation & Refunds",
        title: "6. Cancellation & Refund Policy",
        content: "Course Cancellation: If PhysioGuidance cancels a live training course, learners are entitled to a 100% refund or credit for future courses.\n\nLearner Withdrawal:\n\n- Self-paced Training Courses: Refunds are available within 48 hours of purchase, provided the learner has not accessed more than 10% of the content or attempted the final exam.\n- Live Training Courses: Refunds are available up to 3 days before the start date. No refunds will be issued for \"no-shows\"."
      },
      {
        sectionId: "technical-requirements",
        sidebarLabel: "7. Technical Requirements",
        title: "7. Technical Requirements",
        content: "To ensure a smooth learning experience, learners must have:\n\n- A stable internet connection (download speed of at least 2 Mbps).\n- A compatible device (desktop, laptop, or tablet) with an updated web browser (Chrome, Safari, or Edge).\n- Speakers or headphones for audio content."
      },
      {
        sectionId: "privacy-data",
        sidebarLabel: "8. Privacy & Data Protection",
        title: "8. Privacy & Data Protection",
        content: "We adhere to the national data management policies issued by SDAIA (Saudi Data & AI Authority).\n\n- Data Usage: Your personal data (name, license number, and email) is shared strictly with SCFHS (Mumaris Plus) for the purpose of recording CME hours.\n- Confidentiality: We do not sell or share your data with third-party advertisers."
      }
    ]
  },
  termsPage: {
    title: "Terms & Conditions",
    lastUpdated: "Last Updated: January 2026",
    sections: [
      {
        sectionId: "introduction",
        sidebarLabel: "1. Introduction",
        title: "1. Introduction",
        content: "Welcome to PhysioGuidance. By accessing our website, enrolling in courses, or using our services, you agree to be bound by these Terms & Conditions. If you do not agree with any part of these terms, you must discontinue use of our platform immediately. These terms constitute a legally binding agreement between you and PhysioGuidance, headquartered in Saudi Arabia."
      },
      {
        sectionId: "medical-disclaimer",
        sidebarLabel: "2. Medical Disclaimer",
        title: "2. Medical Disclaimer",
        content: "PhysioGuidance provides educational content for professional development and exam preparation only.\n\n- Not Medical Advice: The information provided in our courses is not intended to be a substitute for professional medical advice, diagnosis, or treatment.\n- Professional Judgment: Healthcare practitioners are responsible for exercising their own clinical judgment when applying learned concepts to patient care. PhysioGuidance is not liable for any medical errors or adverse patient outcomes resulting from the application of our training."
      },
      {
        sectionId: "user-accounts",
        sidebarLabel: "3. User Accounts & Security",
        title: "3. User Accounts & Security",
        content: "Account Responsibility: You are responsible for maintaining the confidentiality of your login credentials. You are strictly prohibited from sharing your account with others.\n\nOne User, One Account: Accounts are non-transferable. Buying a course gives you the license to view it; you cannot \"share\" the license with colleagues.\n\nUnauthorized Access: You must notify us immediately of any unauthorized use of your account."
      },
      {
        sectionId: "payments",
        sidebarLabel: "4. Payments & VAT",
        title: "4. Payments & VAT",
        content: "Currency: All transactions are processed in Saudi Riyals (SAR).\n\nVAT: In accordance with the regulations of the Zakat, Tax and Customs Authority (ZATCA), a Value Added Tax (VAT) of 15% is applicable to all purchases unless otherwise stated.\n\nPayment Methods: We accept payments via Mada, Visa, MasterCard, Apple Pay, and STC Pay. Access to course material is granted only after successful payment confirmation."
      },
      {
        sectionId: "intellectual-property",
        sidebarLabel: "5. Intellectual Property",
        title: "5. Intellectual Property Rights",
        content: "The PhysioGuidance platform, including its logo, source code, text, graphics, and course videos, is the property of PhysioGuidance and is protected by Saudi Intellectual Property Authority (SIPA) laws.\n\n- Restrictions: You may not modify, publish, transmit, participate in the transfer or sale of, reproduce, create derivative works from, or in any way exploit any of the content, in whole or in part."
      },
      {
        sectionId: "limitation",
        sidebarLabel: "6. Limitation of Liability",
        title: "6. Limitation of Liability",
        content: "To the fullest extent permitted by Saudi law:\n\n- PhysioGuidance shall not be liable for any indirect, incidental, special, or consequential damages arising out of the use or inability to use our services.\n- We do not guarantee that the platform will be error-free or uninterrupted. We reserve the right to perform scheduled maintenance.\n- We are not responsible for the acceptance or rejection of CME hours by international bodies outside of the SCFHS, though we strive to maintain full accreditation."
      },
      {
        sectionId: "termination",
        sidebarLabel: "7. Termination of Use",
        title: "7. Termination of Use",
        content: "PhysioGuidance reserves the right to suspend or terminate your account at our sole discretion, without notice, for conduct that we believe violates these Terms & Conditions or is harmful to other users, us, or third parties, or for any other reason."
      },
      {
        sectionId: "governing-law",
        sidebarLabel: "8. Governing Law",
        title: "8. Governing Law",
        content: "These Terms shall be governed by and construed in accordance with the laws of the Kingdom of Saudi Arabia. Any disputes arising under or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts located in Riyadh, Saudi Arabia."
      },
      {
        sectionId: "contact",
        sidebarLabel: "9. Contact Information",
        title: "9. Contact Information",
        content: "We reserve the right to modify these terms at any time. Changes will be effective immediately upon posting to the website. Your continued use of the Service following the posting of changes constitutes your acceptance of those changes."
      }
    ]
  },
  learningPoliciesPage: {
    title: "Learning Policies",
    lastUpdated: "Last Updated: January 2026",
    sections: [
      {
        sectionId: "general",
        sidebarLabel: "1. General Provisions",
        title: "1. General Provisions",
        content: "PhysioGuidance is committed to providing high-quality medical education in compliance with the National eLearning Center (NELC) and the Saudi Commission for Health Specialties (SCFHS). By enrolling in our courses, learners agree to adhere to the policies outlined below. These policies are subject to updates in accordance with KSA regulations."
      },
      {
        sectionId: "attendance",
        sidebarLabel: "2. Attendance Policy",
        title: "2. Attendance Policy (CME Requirements)",
        content: "To ensure the integrity of Continuing Medical Education (CME) hours, strictly monitored attendance is required:\n\n- Live Webinars: Learners must attend at least 80% of the live session duration to qualify for a certificate. Attendance is tracked automatically via system logs.\n- Recorded Courses: Learners must view 100% of the video content and complete all interactive modules.\n- Failure to Attend: If the minimum attendance threshold is not met, the learner will not be eligible for CME hours and must retake the course."
      },
      {
        sectionId: "assessment",
        sidebarLabel: "3. Assessment & Grading",
        title: "3. Assessment & Grading",
        content: "Passing Score: A minimum score of 70% on the final assessment is required to generate a completion certificate.\n\nRetake Policy: Learners are granted three (3) attempts to pass the final exam. If a learner fails all three attempts, they must re-enroll in the course to reset their progress.\n\nFeedback: Automated feedback is provided immediately after quiz submission to facilitate learning retention."
      },
      {
        sectionId: "integrity",
        sidebarLabel: "4. Academic Integrity",
        title: "4. Academic Integrity",
        content: "PhysioGuidance enforces a zero-tolerance policy towards academic dishonesty.\n\n- Identity Verification: Learners must use their own SCFHS license number and legal name. Impersonation is a violation of Saudi law.\n- Plagiarism & Cheating: Any attempt to manipulate assessment scores or share quiz answers will result in immediate account suspension and the revocation of any issued certificates."
      },
      {
        sectionId: "intellectual",
        sidebarLabel: "5. Intellectual Property",
        title: "5. Intellectual Property Rights",
        content: "All course materials, including videos, slides, PDFs, and assessments, are the exclusive property of PhysioGuidance and its instructors.\n\n- Usage: Materials are for personal educational use only.\n- Distribution: Unauthorized recording, reproduction, or sharing of course content on public platforms is strictly prohibited and subject to legal action under Saudi Intellectual Property laws."
      },
      {
        sectionId: "cancellation",
        sidebarLabel: "6. Cancellation & Refunds",
        title: "6. Cancellation & Refund Policy",
        content: "Course Cancellation: If PhysioGuidance cancels a live course, learners are entitled to a 100% refund or a credit for future courses.\n\nLearner Withdrawal:\n\n- Self-Paced Courses: Refunds are available within 48 hours of purchase, provided the learner has not accessed more than 10% of the content or attempted the final exam.\n- Live Courses: Refunds are available up to 3 days prior to the start date. No refunds will be issued for \"no-shows.\""
      },
      {
        sectionId: "technical",
        sidebarLabel: "7. Technical Requirements",
        title: "7. Technical Requirements",
        content: "To ensure a seamless learning experience, learners must have:\n\n- A stable internet connection (minimum 2 Mbps download speed).\n- A compatible device (Desktop, Laptop, or Tablet) with an updated web browser (Chrome, Edge, or Safari).\n- Speakers or headphones for audio content."
      },
      {
        sectionId: "privacy",
        sidebarLabel: "8. Privacy & Data Protection",
        title: "8. Privacy & Data Protection",
        content: "We adhere to the National Data Governance Policies issued by SDAIA (Saudi Data & AI Authority).\n\n- Data Usage: Your personal data (Name, License Number, Email) is shared strictly with SCFHS (Mumaris Plus) for the purpose of recording CME hours.\n- Confidentiality: We do not sell or share your data with third-party advertisers."
      }
    ]
  },
  footer: {
    companyDescription: "Nationally aligned healthcare eLearning & training platform",
    platform: "Platform",
    organization: "Organization",
    support: "Support",
    copyright: "2025, PhysioGuidance"
  },
  courses: [
    {
      title: "Infection Control (Core / Flagship)",
      description: "A comprehensive, evidence-based overview of infection prevention strategies for modern healthcare settings.",
      date: "2026-01-11",
      hours: 8,
      price: 575,
      slug: "infection-control-flagship",
      courseType: "Live Online"
    },
    {
      title: "Life Support / Emergency Care",
      description: "Essential life-saving skills for early response, resuscitation, and emergency management.",
      date: "2026-01-18",
      hours: 6,
      price: 375,
      slug: "life-support-emergency-care",
      courseType: "Live Online"
    },
    {
      title: "Patient Safety & Quality",
      description: "Learn structured approaches to reduce medical errors, improve outcomes, and enhance care quality.",
      date: "2026-01-11",
      hours: 8,
      price: 460,
      slug: "patient-safety-quality",
      courseType: "Live Online"
    },
    {
      title: "Public Health & Preparedness",
      description: "Principles of surveillance, risk assessment, and coordinated response to health emergencies.",
      date: "2026-01-11",
      hours: 8,
      price: 575,
      slug: "public-health-preparedness",
      courseType: "Live Online"
    }
  ],
  testimonialItems: [
    {
      quote: "The training was well-structured and directly applicable to our clinical practice. The content was aligned with current standards, and the instructors demonstrated strong clinical experience.",
      authorName: "Dr. Ahmed Al-Qahtani",
      authorRole: "Consultant, Public Hospital"
    },
    {
      quote: "What stood out was the clarity of the material and the practical focus. The program helped reinforce critical protocols and provided accredited CME hours without compromising quality.",
      authorName: "Sara Al-Harthi",
      authorRole: "Senior Nursing Specialist"
    },
    {
      quote: "The platform offers a reliable learning environment that meets national training requirements. It is suitable for both individual professionals and institutional training initiatives.",
      authorName: "Faisal Al-Mutairi",
      authorRole: "Healthcare Education Institute"
    },
    {
      quote: "An exceptional training experience that exceeded our expectations. The curriculum is comprehensive and the instructors bring real-world expertise that enriches every session.",
      authorName: "Dr. Layla Al-Rashid",
      authorRole: "Medical Director, Private Clinic"
    },
    {
      quote: "The certification process was seamless and the course materials were of the highest quality. I highly recommend this platform for any healthcare professional seeking accredited training.",
      authorName: "Mohammed Al-Zahrani",
      authorRole: "Clinical Pharmacist"
    },
    {
      quote: "Outstanding support from the team and excellent course structure. The interactive modules made learning engaging and the practical assessments ensured we could apply knowledge immediately.",
      authorName: "Noura Al-Otaibi",
      authorRole: "Head Nurse, Regional Hospital"
    }
  ],
  contactPage: {
    title: "Contact Us",
    subtitle: "We are always ready to answer your questions and inquiries.",
    formFullNameLabel: "Full Name",
    formEmailLabel: "Email address",
    formIssueTypeLabel: "Select issue type",
    formSelectOptionLabel: "Select an option",
    formPhoneLabel: "Phone number",
    formSubjectLabel: "Subject",
    formDescriptionLabel: "Description",
    formCharactersLeftLabel: "characters left",
    formSubmitLabel: "Submit",
    issueTypeTechnicalSupport: "Technical Support",
    issueTypeBillingIssue: "Billing Issue",
    issueTypeCourseInquiry: "Course Inquiry",
    issueTypePartnership: "Partnership",
    issueTypeOther: "Other",
    generalInquiryLabel: "General Inquiry",
    generalInquiryEmail: "inquiry@physioguidance.org",
    technicalSupportLabel: "Technical Support",
    technicalSupportPhone: "+966 920035022",
    address: "Xyz, Saudi Arabia",
    getDirectionsLabel: "Get Directions",
    loadingMapText: "Loading map...",
    mapLatitude: 24.4539,
    mapLongitude: 39.6142,
    mapPopupText: "PhysioGuidance - Saudi Arabia"
  },
  feedbackPage: {
    title: "We Value Your Opinion",
    description: "Help us improve medical education in the Kingdom. Your feedback goes directly to our Quality Assurance team.",
    formFullNameLabel: "Full Name",
    formEmailLabel: "Email address",
    formSubjectLabel: "Subject",
    formDescriptionLabel: "Description",
    formCharactersLeftPrefix: "",
    formCharactersLeftSuffix: "characters left",
    formSubmitLabel: "Submit"
  },
  certificationsPage: {
    breadcrumb: "Certifications and CME",
    heroTitle: "Certified Continuing Medical Education (CME)",
    heroDescription: "Fully accredited by the Saudi Commission for Health Specialties (SCFHS) and the National eLearning Center (NELC). Earn recognized hours to renew your professional license.",
    heroButtonLabel: "Browse Accredited Courses",
    nelcTitle: "NELC Licensed",
    nelcDescription: "PhysioGuidance is officially licensed by the National eLearning Center of Saudi Arabia, ensuring the highest standards of digital education quality and compliance.",
    nelcLicenseLabel: "License No:",
    nelcLicenseNumber: "123456789",
    scfhsTitle: "SCFHS Approved",
    scfhsDescription: "Our medical courses are accredited by the Saudi Commission for Health Specialties. All completion certificates are valid for professional classification and registration renewal via Mumaris Plus.",
    scfhsAccreditationLabel: "Accreditation No:",
    scfhsAccreditationNumber: "123456789",
    verificationTitle: "Verify Certificate",
    verificationSubtitle: "Enter your certificate ID to verify",
    verificationPlaceholder: "PG-2025-X82910",
    verificationButtonLabel: "Verify",
    claimCMETitle: "How to Claim Your CME Hours",
    step1Title: "Complete the Course",
    step1Description: "Watch all required modules and attend 80% of live webinar sessions (if applicable).",
    step2Title: "Pass the Assessment",
    step2Description: "Achieve a passing score of 70% or higher on the final evaluation quiz.",
    step3Title: "Upload CME Hours",
    step3Description: "Download your certificate instantly and upload the unique ID directly to your Mumaris Plus dashboard."
  },
  nelcPage: {
    heroTitle: "Committed to National Quality Standards",
    heroDescription: "PhysioGuidance is a fully licensed provider under the National eLearning Center (NELC) of Saudi Arabia.",
    licenseNumberLabel: "License Number",
    licenseNumberValue: "Al Madinah Al Munawwarah",
    licenseTypeLabel: "License Type",
    licenseTypeValue: "eLearning Training Facility",
    statusLabel: "Status",
    statusValue: "Active",
    complianceTitle: "Our Compliance",
    complianceDescription: "We adhere strictly to the NELC's operational standards to ensure a premium educational experience",
    governanceTitle: "Governance",
    governanceDescription: "Transparent policies for attendance, grading, and grievances.",
    technologyTitle: "Technology",
    technologyDescription: "A secure, accessible platform that protects learner data and intellectual property.",
    instructionTitle: "Instruction",
    instructionDescription: "All courses are designed by subject matter experts and undergo rigorous quality review before publication."
  },
  partnersPage: {
    title: "Collaborating with Leaders in Healthcare"
  },
  instructorsPage: {
    meetExpertsTitle: "Meet the experts",
    mindsBehindTitle: "Minds Behind Physioguidance"
  },
  faqPage: {
    title: "FAQs",
    subtitle: "Still have any questions?",
    getInTouchLabel: "Get in touch",
    items: [
      {
        question: "Is PhysioGuidance accredited by SCFHS?",
        answer: "Yes, we are a fully accredited provider. All our CME courses are recognized by the Saudi Commission for Health Specialties."
      },
      {
        question: "How do I upload my CME hours to Mumaris Plus?",
        answer: "We handle this for you! Once you pass the course, our system automatically reports your hours to Mumaris Plus within 48 hours. Please ensure your SCFHS license number is correct in your profile."
      },
      {
        question: "My name is spelled wrong on my certificate. How do I fix it?",
        answer: "Your certificate uses the name exactly as it appears in your profile. You can edit your profile settings before generating the certificate. If it's already generated, please contact support."
      },
      {
        question: "Is PhysioGuidance accredited by SCFHS?",
        answer: "Yes, we are a fully accredited provider. All our CME courses are recognized by the Saudi Commission for Health Specialties."
      }
    ]
  },
  supportPage: {
    title: "How can we help?",
    subtitle: "Search our knowledge base or submit a ticket — we typically respond within minutes during business hours.",
    categoriesTitle: "Browse by Category",
    categoriesSubtitle: "Pick the area you need help with.",
    faqTitle: "Frequently Asked Questions",
    faqViewAllLabel: "View all FAQs",
    submitTicketTitle: "Submit a Ticket",
    submitTicketSubtitle: "Tell us what's going on and we'll get back to you.",
    signInRequiredLabel: "Sign in required",
    signInRequiredDescription: "Sign in to submit a ticket about your account, courses, certificates, or billing.",
    signInLabel: "Sign In",
    categories: [
      { backendValue: "technical", label: "Technical Issue", description: "Video playback, audio glitches, or session join problems.", iconName: "Video", colorClass: "bg-red-50 text-red-600" },
      { backendValue: "login", label: "Login or Access", description: "Forgot password, locked account, or two-factor reset.", iconName: "KeyRound", colorClass: "bg-amber-50 text-amber-600" },
      { backendValue: "billing", label: "Billing or Payment", description: "Receipts, refunds, failed payments, or VAT questions.", iconName: "CreditCard", colorClass: "bg-emerald-50 text-emerald-600" },
      { backendValue: "certificate", label: "Certificates", description: "Download, name corrections, or Mumaris Plus reporting.", iconName: "Award", colorClass: "bg-purple-50 text-purple-600" },
      { backendValue: "content", label: "Course Content", description: "Quiz issues, missing materials, or learning-content questions.", iconName: "BookOpen", colorClass: "bg-blue-50 text-blue-600" },
      { backendValue: "other", label: "Other Technical", description: "Anything else that doesn't fit the categories above.", iconName: "Wrench", colorClass: "bg-orange-50 text-orange-600" },
      { backendValue: "other", label: "General Inquiry", description: "Partnerships, careers, or anything else.", iconName: "HelpCircle", colorClass: "bg-gray-100 text-gray-600" }
    ],
    items: [
      { question: "How quickly will I get a response?", answer: "During business hours (Sun-Thu, 9 AM - 6 PM Saudi time) most tickets get a first reply within 30 minutes. Outside business hours we respond first thing the next business day." },
      { question: "Can I submit a ticket without signing in?", answer: "Yes — for login or access issues only, you can submit a guest ticket. For everything else you'll need to sign in so we can look up your account." },
      { question: "How do I track an open ticket?", answer: "If you're signed in, head to Dashboard → Support to see all your tickets. Guest tickets come with a tracking link in your confirmation email." },
      { question: "What if I need to add information after I submit?", answer: "You can reply to your ticket from the support dashboard at any time. Each new reply pings the assigned agent." },
      { question: "Are my conversations private?", answer: "Yes. Only you, the assigned agent, and senior support staff can see your ticket. Internal notes between agents are never shared with you." }
    ]
  }
};

// Arabic translations
const arContent = {
  hero: {
    title: "\u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0627\u0644\u0635\u062d\u064a",
    titleLine2: "\u0648\u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a",
    titleMobile: "\u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0627\u0644\u0635\u062d\u064a \u0648\u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a",
    description: "\u0646\u0642\u062f\u0645 \u062a\u062f\u0631\u064a\u0628\u064b\u0627 \u0645\u062a\u0648\u0627\u0641\u0642\u064b\u0627 \u0645\u0639 \u0627\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u0648\u0637\u0646\u064a \u0644\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a \u0648\u0628\u0631\u0627\u0645\u062c \u0645\u0639\u062a\u0645\u062f\u0629 \u0648\u062a\u062c\u0627\u0631\u0628 \u062a\u0639\u0644\u0645 \u0645\u0628\u0627\u0634\u0631\u0629 \u0644\u0644\u0642\u0637\u0627\u0639 \u0627\u0644\u0635\u062d\u064a - \u0643\u0644 \u0630\u0644\u0643 \u0641\u064a \u0645\u0646\u0635\u0629 \u0648\u0627\u062d\u062f\u0629 \u0622\u0645\u0646\u0629.",
    exploreButton: "\u0627\u0633\u062a\u0643\u0634\u0641 \u0627\u0644\u0628\u0631\u0627\u0645\u062c \u0627\u0644\u062a\u062f\u0631\u064a\u0628\u064a\u0629",
    getStartedButton: "\u0627\u0628\u062f\u0623 \u0627\u0644\u0622\u0646"
  },
  partners: {
    title: "\u0634\u0631\u0643\u0627\u0624\u0646\u0627 \u0627\u0644\u0645\u0648\u062b\u0648\u0642\u0648\u0646"
  },
  featuredCourses: {
    title: "\u0627\u0644\u0628\u0631\u0627\u0645\u062c \u0627\u0644\u0645\u0645\u064a\u0632\u0629",
    description: "\u0628\u0631\u0627\u0645\u062c \u062a\u062f\u0631\u064a\u0628 \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629 \u0627\u0644\u0645\u0639\u062a\u0645\u062f\u0629 \u0648\u0627\u0644\u0645\u0628\u0646\u064a\u0629 \u0639\u0644\u0649 \u0627\u0644\u0623\u062f\u0644\u0629.",
    viewAllButton: "\u0639\u0631\u0636 \u062c\u0645\u064a\u0639 \u0627\u0644\u0628\u0631\u0627\u0645\u062c"
  },
  becomeTrainer: {
    title: "\u0643\u0646 \u0645\u062f\u0631\u0628\u064b\u0627",
    description: "\u0627\u0646\u0636\u0645 \u0625\u0644\u0649 \u0634\u0628\u0643\u0629 \u0645\u0646 \u0627\u0644\u0645\u062f\u0631\u0628\u064a\u0646 \u0627\u0644\u0645\u0639\u062a\u0645\u062f\u064a\u0646 \u0627\u0644\u0630\u064a\u0646 \u064a\u0642\u062f\u0645\u0648\u0646 \u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629 \u0627\u0644\u0645\u062a\u0648\u0627\u0641\u0642 \u0645\u0639 \u0627\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u0648\u0637\u0646\u064a \u0639\u0644\u0649 \u0645\u0633\u062a\u0648\u0649 \u0627\u0644\u0645\u0645\u0644\u0643\u0629.",
    getStartedButton: "\u0627\u0628\u062f\u0623 \u0627\u0644\u0622\u0646"
  },
  expertInstructors: {
    title: "\u0628\u0642\u064a\u0627\u062f\u0629 \u062e\u0628\u0631\u0627\u0621 \u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0627\u0644\u0635\u062d\u064a",
    description: "\u062a\u0639\u0644\u0645 \u0645\u0646 \u0623\u0637\u0628\u0627\u0621 \u0630\u0648\u064a \u062e\u0628\u0631\u0629 \u0648\u0645\u062f\u0631\u0628\u064a\u0646 \u0645\u0639\u062a\u0645\u062f\u064a\u0646 \u0648\u062e\u0628\u0631\u0627\u0621 \u0645\u062a\u062e\u0635\u0635\u064a\u0646 \u064a\u0642\u062f\u0645\u0648\u0646 \u062a\u0639\u0644\u064a\u0645\u064b\u0627 \u0635\u062d\u064a\u064b\u0627 \u0642\u0627\u0626\u0645\u064b\u0627 \u0639\u0644\u0649 \u0627\u0644\u0623\u062f\u0644\u0629 \u0648\u0645\u062a\u0648\u0627\u0641\u0642\u064b\u0627 \u0648\u0637\u0646\u064a\u064b\u0627."
  },
  testimonials: {
    title: "\u0622\u0631\u0627\u0621 \u0627\u0644\u0645\u062a\u062e\u0635\u0635\u064a\u0646 \u0641\u064a \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629",
    description: "\u062a\u0639\u0644\u064a\u0642\u0627\u062a \u0645\u0646 \u0645\u062a\u062e\u0635\u0635\u064a \u0648\u0645\u0624\u0633\u0633\u0627\u062a \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629 \u0627\u0644\u0630\u064a\u0646 \u0634\u0627\u0631\u0643\u0648\u0627 \u0641\u064a \u0628\u0631\u0627\u0645\u062c\u0646\u0627 \u0627\u0644\u062a\u062f\u0631\u064a\u0628\u064a\u0629 \u0627\u0644\u0645\u0639\u062a\u0645\u062f\u0629."
  },
  cta: {
    title: "\u0627\u0628\u062f\u0623 \u0631\u062d\u0644\u062a\u0643 \u0627\u0644\u062a\u0639\u0644\u064a\u0645\u064a\u0629 \u0641\u064a \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629",
    description: "\u0627\u062d\u0635\u0644 \u0639\u0644\u0649 \u0628\u0631\u0627\u0645\u062c \u062a\u062f\u0631\u064a\u0628\u064a\u0629 \u0645\u0639\u062a\u0645\u062f\u0629 \u0648\u0645\u062a\u0648\u0627\u0641\u0642\u0629 \u0645\u0639 \u0627\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u0648\u0637\u0646\u064a \u0644\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a \u0645\u0635\u0645\u0645\u0629 \u0644\u0645\u062a\u062e\u0635\u0635\u064a \u0648\u0645\u0624\u0633\u0633\u0627\u062a \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629.",
    continueButton: "\u0627\u0628\u062f\u0623 \u0627\u0644\u0622\u0646"
  },
  aboutPage: {
    heroTitle: "\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0639\u0646\u0627",
    heroDescription: "\u0645\u0646\u0635\u062a\u0646\u0627 \u0647\u064a \u0646\u0638\u0627\u0645 \u062a\u0639\u0644\u0645 \u0631\u0642\u0645\u064a \u0645\u062a\u0648\u0627\u0641\u0642 \u062a\u0645\u0627\u0645\u064b\u0627 \u0645\u0639 NELC \u0645\u0635\u0645\u0645 \u062e\u0635\u064a\u0635\u064b\u0627 \u0644\u0644\u0642\u0637\u0627\u0639 \u0627\u0644\u0635\u062d\u064a. \u0646\u0642\u062f\u0645 \u062a\u062f\u0631\u064a\u0628\u064b\u0627 \u0639\u0627\u0644\u064a \u0627\u0644\u062c\u0648\u062f\u0629 \u0648\u0645\u0639\u062a\u0645\u062f\u064b\u0627 \u0645\u0646 \u062e\u0644\u0627\u0644 \u0645\u0646\u0635\u0629 \u0622\u0645\u0646\u0629 \u062b\u0646\u0627\u0626\u064a\u0629 \u0627\u0644\u0644\u063a\u0629 (\u0639\u0631\u0628\u064a/\u0625\u0646\u062c\u0644\u064a\u0632\u064a) \u062a\u062f\u0639\u0645 \u0627\u0644\u062a\u0639\u0644\u0645 \u0627\u0644\u0630\u0627\u062a\u064a \u0648\u0627\u0644\u062c\u0644\u0633\u0627\u062a \u0627\u0644\u0627\u0641\u062a\u0631\u0627\u0636\u064a\u0629 \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629 \u0648\u062a\u062d\u0644\u064a\u0644\u0627\u062a \u0627\u0644\u0645\u062a\u0639\u0644\u0645\u064a\u0646 \u0627\u0644\u0645\u062a\u0642\u062f\u0645\u0629 \u2014 \u0644\u0636\u0645\u0627\u0646 \u0627\u0644\u062a\u0645\u064a\u0632 \u0648\u0627\u0644\u0648\u0635\u0648\u0644 \u0648\u0627\u0644\u0627\u0645\u062a\u062b\u0627\u0644 \u0627\u0644\u062a\u0646\u0638\u064a\u0645\u064a.",
    heroExploreButtonLabel: "\u0627\u0633\u062a\u0643\u0634\u0641 \u0628\u0631\u0627\u0645\u062c \u0627\u0644\u062a\u062f\u0631\u064a\u0628",
    heroGetStartedButtonLabel: "\u0627\u0628\u062f\u0623 \u0627\u0644\u0622\u0646",
    complianceTitle: "\u0627\u0644\u0627\u0645\u062a\u062b\u0627\u0644 \u0648\u0627\u0644\u0645\u0639\u0627\u064a\u064a\u0631",
    complianceItem1: "\u0645\u062a\u0648\u0627\u0641\u0642 \u062a\u0645\u0627\u0645\u064b\u0627 \u0645\u0639 \u0645\u0639\u0627\u064a\u064a\u0631 NELC \u0644\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a \u0644\u0642\u0637\u0627\u0639 \u0627\u0644\u0635\u062d\u0629",
    complianceItem2: "\u0623\u0647\u062f\u0627\u0641 \u0627\u0644\u062a\u0639\u0644\u0645 \u0627\u0644\u0645\u0646\u0638\u0645\u0629 \u0648\u0627\u0644\u062a\u0642\u064a\u064a\u0645\u0627\u062a \u0648\u0633\u064a\u0631 \u0639\u0645\u0644 \u0627\u0644\u0634\u0647\u0627\u062f\u0627\u062a",
    complianceItem3: "\u0648\u062b\u0627\u0626\u0642 \u0627\u0644\u0627\u0645\u062a\u062b\u0627\u0644 \u0627\u0644\u0634\u0627\u0645\u0644\u0629 \u0648\u0627\u0644\u0627\u0633\u062a\u0639\u062f\u0627\u062f \u0644\u0644\u062a\u062f\u0642\u064a\u0642",
    complianceItem4: "\u0627\u0644\u062a\u0639\u0627\u0645\u0644 \u0627\u0644\u0622\u0645\u0646 \u0645\u0639 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0648\u0636\u0648\u0627\u0628\u0637 \u062e\u0635\u0648\u0635\u064a\u0629 \u0627\u0644\u0645\u062a\u0639\u0644\u0645",
    complianceButtonLabel: "\u0639\u0631\u0636 \u062c\u0645\u064a\u0639 \u0627\u0644\u0628\u0631\u0627\u0645\u062c",
    learningTitle: "\u062a\u062c\u0631\u0628\u0629 \u0627\u0644\u062a\u0639\u0644\u0645",
    learningSubtitle: "\u0627\u0644\u062a\u0639\u0644\u0645 \u0627\u0644\u0645\u0631\u0646 \u0644\u0645\u062a\u062e\u0635\u0635\u064a \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629 \u0627\u0644\u062d\u062f\u064a\u062b\u0629",
    learningCard1Title: "\u062f\u0648\u0631\u0627\u062a \u0645\u0639\u062a\u0645\u062f\u0629 \u0630\u0627\u062a\u064a\u0629 \u0627\u0644\u0633\u0631\u0639\u0629",
    learningCard2Title: "\u0645\u062d\u0627\u0636\u0631\u0627\u062a \u0648\u0648\u0631\u0634 \u0639\u0645\u0644 \u062d\u064a\u0629 \u062a\u0639\u062a\u0645\u062f \u0639\u0644\u0649 \u0628\u0631\u0646\u0627\u0645\u062c Zoom",
    learningCard3Title: "\u0627\u0644\u0634\u0647\u0627\u062f\u0627\u062a \u0627\u0644\u0631\u0642\u0645\u064a\u0629 \u0639\u0646\u062f \u0627\u0644\u0627\u0646\u062a\u0647\u0627\u0621",
    learningReadMoreLabel: "\u0627\u0642\u0631\u0623 \u0627\u0644\u0645\u0632\u064a\u062f",
    capabilitiesTitle: "\u0642\u062f\u0631\u0627\u062a \u0627\u0644\u0645\u0646\u0635\u0629",
    capabilitiesSubtitle: "\u0623\u062f\u0648\u0627\u062a \u0642\u0648\u064a\u0629 \u0644\u0644\u0645\u062a\u0639\u0644\u0645\u064a\u0646 \u0648\u0627\u0644\u0625\u062f\u0627\u0631\u064a\u064a\u0646",
    feature1Title: "\u0648\u0627\u062c\u0647\u0629 \u062b\u0646\u0627\u0626\u064a\u0629 \u0627\u0644\u0644\u063a\u0629",
    feature1Description: "\u062f\u0639\u0645 \u0633\u0644\u0633 \u0644\u0644\u063a\u062a\u064a\u0646 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0648\u0627\u0644\u0625\u0646\u062c\u0644\u064a\u0632\u064a\u0629",
    feature2Title: "\u0644\u0648\u062d\u0627\u062a \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u0645\u062a\u0642\u062f\u0645\u0629",
    feature2Description: "\u062a\u062a\u0628\u0639 \u062a\u0642\u062f\u0645 \u0627\u0644\u0645\u062a\u0639\u0644\u0645 \u0648\u0623\u062f\u0627\u0626\u0647 \u0648\u0645\u0634\u0627\u0631\u0643\u062a\u0647",
    feature3Title: "\u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0627\u062a \u0627\u0644\u0622\u0645\u0646\u0629",
    feature3Description: "\u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0627\u062a \u0627\u0644\u0645\u0634\u0641\u0631\u0629 \u0648\u0627\u0644\u062a\u062d\u0643\u0645 \u0641\u064a \u0627\u0644\u0648\u0635\u0648\u0644",
    feature4Title: "\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0639\u0644\u0645\u064a\u0646",
    feature4Description: "\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u062f\u0631\u0628\u064a\u0646 \u0648\u0627\u0644\u062c\u062f\u0627\u0648\u0644 \u0627\u0644\u0632\u0645\u0646\u064a\u0629 \u0648\u062a\u0642\u062f\u064a\u0645 \u0627\u0644\u062f\u0648\u0631\u0629",
    feature5Title: "\u0627\u0644\u062a\u0642\u0627\u0631\u064a\u0631 \u0648\u0627\u0644\u062a\u062d\u0644\u064a\u0644\u0627\u062a",
    feature5Description: "\u062a\u0642\u0627\u0631\u064a\u0631 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u062a\u0635\u062f\u064a\u0631 \u062a\u062a\u0645\u0627\u0634\u0649 \u0645\u0639 \u0645\u062a\u0637\u0644\u0628\u0627\u062a NELC",
    feature6Title: "\u0627\u0644\u0648\u0635\u0648\u0644 \u0627\u0644\u0642\u0627\u0626\u0645 \u0639\u0644\u0649 \u0627\u0644\u062f\u0648\u0631",
    feature6Description: "\u0623\u0630\u0648\u0646\u0627\u062a \u062e\u0627\u0636\u0639\u0629 \u0644\u0644\u0631\u0642\u0627\u0628\u0629 \u0644\u0644\u0645\u062a\u0639\u0644\u0645\u064a\u0646 \u0648\u0627\u0644\u0645\u062f\u0631\u0633\u064a\u0646 \u0648\u0627\u0644\u0645\u0633\u0624\u0648\u0644\u064a\u0646"
  },
  becomeTrainerPage: {
    pageTitle: "\u0643\u0646 \u0645\u062f\u0631\u0628\u064b\u0627",
    profileSectionTitle: "\u062d\u0633\u0627\u0628\u0643 \u062a\u0639\u0631\u064a\u0641\u064a",
    profilePhotoLabel: "\u0627\u0644\u0635\u0648\u0631\u0629",
    profileAttachCVLabel: "\u0625\u0631\u0641\u0627\u0642 \u0627\u0644\u0633\u064a\u0631\u0629 \u0627\u0644\u0630\u0627\u062a\u064a\u0629",
    profileFullNameLabel: "\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0643\u0627\u0645\u0644",
    profileFullNameArabicPlaceholder: "\u0628\u0627\u0644\u0639\u0631\u0628\u064a\u0629 (\u0643\u0645\u0627 \u064a\u0638\u0647\u0631 \u0641\u064a \u0627\u0644\u0634\u0647\u0627\u062f\u0627\u062a)",
    profileFullNameEnglishPlaceholder: "\u0628\u0627\u0644\u0625\u0646\u062c\u0644\u064a\u0632\u064a\u0629 (\u0643\u0645\u0627 \u064a\u0638\u0647\u0631 \u0641\u064a \u0627\u0644\u0634\u0647\u0627\u062f\u0627\u062a)",
    profileEmailLabel: "\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a",
    profileMobileLabel: "\u0631\u0642\u0645 \u0627\u0644\u062c\u0648\u0627\u0644",
    profileGenderLabel: "\u0627\u0644\u062c\u0646\u0633",
    profileNationalityLabel: "\u0627\u0644\u062c\u0646\u0633\u064a\u0629",
    profileNationalIdLabel: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0648\u064a\u0629/\u0627\u0644\u0625\u0642\u0627\u0645\u0629",
    profileProfessionLabel: "\u0627\u0644\u0645\u0647\u0646\u0629",
    profileSpecialityLabel: "\u0627\u0644\u062a\u062e\u0635\u0635",
    profileQualificationLabel: "\u0627\u0644\u0645\u0624\u0647\u0644 \u0627\u0644\u0639\u0644\u0645\u064a",
    profileRankLabel: "\u0627\u0644\u0631\u062a\u0628\u0629",
    profileScfhsQuestion: "\u0647\u0644 \u0644\u062f\u064a\u0643 \u0631\u0642\u0645 \u062a\u0635\u0646\u064a\u0641 \u0645\u0646 \u0627\u0644\u0647\u064a\u0626\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0644\u0644\u062a\u062e\u0635\u0635\u0627\u062a \u0627\u0644\u0635\u062d\u064a\u0629\u061f",
    profileTwitterLabel: "\u062a\u0648\u064a\u062a\u0631",
    profileLinkedInLabel: "\u0644\u064a\u0646\u0643\u062f \u0625\u0646",
    resumeSectionTitle: "\u0627\u0644\u0633\u064a\u0631\u0629 \u0627\u0644\u0630\u0627\u062a\u064a\u0629",
    resumeDescription: "\u062d\u062f\u062f \u0627\u0644\u0637\u0631\u064a\u0642\u0629 \u0627\u0644\u062a\u064a \u062a\u0641\u0636\u0644\u0647\u0627 \u0644\u062a\u0642\u062f\u064a\u0645 \u0633\u064a\u0631\u062a\u0643 \u0627\u0644\u0630\u0627\u062a\u064a\u0629: \u0625\u0645\u0627 \u0625\u0646\u0634\u0627\u0621 \u0648\u0627\u062d\u062f\u0629 \u0645\u0628\u0627\u0634\u0631\u0629 \u062f\u0627\u062e\u0644 \u0627\u0644\u062a\u0637\u0628\u064a\u0642 \u0623\u0648 \u062a\u062d\u0645\u064a\u0644 \u0645\u0644\u0641 \u0633\u064a\u0631\u0629 \u0630\u0627\u062a\u064a\u0629 \u0645\u0648\u062c\u0648\u062f.",
    resumeUploadLabel: "\u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0633\u064a\u0631\u0629 \u0627\u0644\u0630\u0627\u062a\u064a\u0629",
    resumeCreateLabel: "\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0633\u064a\u0631\u0629 \u0627\u0644\u0630\u0627\u062a\u064a\u0629",
    resumeEducationLabel: "\u0627\u0644\u062a\u0639\u0644\u064a\u0645",
    resumeProfessionalSkillsLabel: "\u0627\u0644\u0645\u0647\u0627\u0631\u0627\u062a \u0627\u0644\u0645\u0647\u0646\u064a\u0629",
    resumeScientificResearchesLabel: "\u0627\u0644\u0623\u0628\u062d\u0627\u062b \u0627\u0644\u0639\u0644\u0645\u064a\u0629",
    resumeTrainingExperienceLabel: "\u0627\u0644\u062e\u0628\u0631\u0629 \u0627\u0644\u062a\u062f\u0631\u064a\u0628\u064a\u0629",
    resumeClickToUploadLabel: "\u0627\u0646\u0642\u0631 \u0644\u0644\u062a\u062d\u0645\u064a\u0644",
    resumeOrDragDropLabel: "\u0623\u0648 \u0627\u0633\u062d\u0628 \u0648\u0623\u0641\u0644\u062a",
    resumePdfMaxSizeLabel: "PDF (\u0627\u0644\u062d\u062f \u0627\u0644\u0623\u0642\u0635\u0649 10 \u0645\u064a\u062c\u0627\u0628\u0627\u064a\u062a)",
    bankAccountSectionTitle: "\u0627\u0644\u062d\u0633\u0627\u0628 \u0627\u0644\u0628\u0646\u0643\u064a",
    bankAccountHolderLabel: "\u0627\u0633\u0645 \u0635\u0627\u062d\u0628 \u0627\u0644\u062d\u0633\u0627\u0628",
    bankNameLabel: "\u0627\u0633\u0645 \u0627\u0644\u0628\u0646\u0643",
    bankIbanLabel: "\u0631\u0642\u0645 \u0627\u0644\u0622\u064a\u0628\u0627\u0646",
    cancelButtonLabel: "\u0625\u0644\u063a\u0627\u0621",
    saveButtonLabel: "\u062d\u0641\u0638",
    yesButtonLabel: "\u0646\u0639\u0645",
    noButtonLabel: "\u0644\u0627"
  },
  privacyPolicyPage: {
    title: "\u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u062e\u0635\u0648\u0635\u064a\u0629",
    lastUpdated: "\u0622\u062e\u0631 \u062a\u062d\u062f\u064a\u062b: \u064a\u0646\u0627\u064a\u0631 2026",
    sections: [
      {
        sectionId: "general-terms",
        sidebarLabel: "1. \u0627\u0644\u0634\u0631\u0648\u0637 \u0627\u0644\u0639\u0627\u0645\u0629",
        title: "1. \u0627\u0644\u0634\u0631\u0648\u0637 \u0627\u0644\u0639\u0627\u0645\u0629",
        content: "\u062a\u0644\u062a\u0632\u0645 \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633 \u0628\u062a\u0642\u062f\u064a\u0645 \u062a\u0639\u0644\u064a\u0645 \u0637\u0628\u064a \u0639\u0627\u0644\u064a \u0627\u0644\u062c\u0648\u062f\u0629 \u0645\u062a\u0648\u0627\u0641\u0642 \u0645\u0639 \u0627\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u0648\u0637\u0646\u064a \u0644\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a (NELC) \u0648\u0627\u0644\u0647\u064a\u0626\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0644\u0644\u062a\u062e\u0635\u0635\u0627\u062a \u0627\u0644\u0635\u062d\u064a\u0629 (SCFHS). \u0628\u0627\u0644\u062a\u0633\u062c\u064a\u0644 \u0641\u064a \u062f\u0648\u0631\u0627\u062a\u0646\u0627\u060c \u064a\u0648\u0627\u0641\u0642 \u0627\u0644\u0645\u062a\u0639\u0644\u0645\u0648\u0646 \u0639\u0644\u0649 \u0627\u0644\u0627\u0644\u062a\u0632\u0627\u0645 \u0628\u0627\u0644\u0633\u064a\u0627\u0633\u0627\u062a \u0627\u0644\u0645\u0648\u0636\u062d\u0629 \u0623\u062f\u0646\u0627\u0647. \u062a\u062e\u0636\u0639 \u0647\u0630\u0647 \u0627\u0644\u0633\u064a\u0627\u0633\u0627\u062a \u0644\u0644\u062a\u062d\u062f\u064a\u062b\u0627\u062a \u0648\u0641\u0642\u064b\u0627 \u0644\u0623\u0646\u0638\u0645\u0629 \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629."
      },
      {
        sectionId: "attendance-policy",
        sidebarLabel: "2. \u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u062d\u0636\u0648\u0631",
        title: "2. \u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u062d\u0636\u0648\u0631 (\u0645\u062a\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631)",
        content: "\u0644\u0636\u0645\u0627\u0646 \u0646\u0632\u0627\u0647\u0629 \u0633\u0627\u0639\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631 (CME)\u060c \u064a\u062a\u0645 \u062a\u0637\u0628\u064a\u0642 \u0645\u0631\u0627\u0642\u0628\u0629 \u0627\u0644\u062d\u0636\u0648\u0631 \u0628\u0634\u0643\u0644 \u0635\u0627\u0631\u0645:\n\n- \u0627\u0644\u062f\u0648\u0631\u0627\u062a \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629 \u0639\u0628\u0631 \u0627\u0644\u0625\u0646\u062a\u0631\u0646\u062a: \u064a\u062c\u0628 \u0639\u0644\u0649 \u0627\u0644\u0645\u062a\u0639\u0644\u0645\u064a\u0646 \u062d\u0636\u0648\u0631 80% \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644 \u0645\u0646 \u0645\u062f\u0629 \u0627\u0644\u062c\u0644\u0633\u0629 \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629 \u0644\u0644\u062a\u0623\u0647\u0644 \u0644\u0644\u0634\u0647\u0627\u062f\u0629. \u064a\u062a\u0645 \u062a\u062a\u0628\u0639 \u0627\u0644\u062d\u0636\u0648\u0631 \u062a\u0644\u0642\u0627\u0626\u064a\u064b\u0627 \u0639\u0628\u0631 \u0633\u062c\u0644\u0627\u062a \u0627\u0644\u0646\u0638\u0627\u0645.\n- \u0627\u0644\u062f\u0648\u0631\u0627\u062a \u0627\u0644\u062a\u062f\u0631\u064a\u0628\u064a\u0629 \u0627\u0644\u0645\u0633\u062c\u0644\u0629: \u064a\u062c\u0628 \u0639\u0644\u0649 \u0627\u0644\u0645\u062a\u0639\u0644\u0645\u064a\u0646 \u0645\u0634\u0627\u0647\u062f\u0629 100% \u0645\u0646 \u0645\u062d\u062a\u0648\u0649 \u0627\u0644\u0641\u064a\u062f\u064a\u0648 \u0648\u0625\u0643\u0645\u0627\u0644 \u062c\u0645\u064a\u0639 \u0627\u0644\u0648\u062d\u062f\u0627\u062a \u0627\u0644\u062a\u0641\u0627\u0639\u0644\u064a\u0629.\n- \u0639\u062f\u0645 \u0627\u0644\u062d\u0636\u0648\u0631: \u0625\u0630\u0627 \u0644\u0645 \u064a\u062a\u0645 \u0627\u0633\u062a\u064a\u0641\u0627\u0621 \u0627\u0644\u062d\u062f \u0627\u0644\u0623\u062f\u0646\u0649 \u0644\u0644\u062d\u0636\u0648\u0631\u060c \u0644\u0646 \u064a\u0643\u0648\u0646 \u0627\u0644\u0645\u062a\u0639\u0644\u0645 \u0645\u0624\u0647\u0644\u064b\u0627 \u0644\u0633\u0627\u0639\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631 \u0648\u064a\u062c\u0628 \u0639\u0644\u064a\u0647 \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062f\u0648\u0631\u0629."
      },
      {
        sectionId: "assessment",
        sidebarLabel: "3. \u0627\u0644\u062a\u0642\u064a\u064a\u0645 \u0648\u0627\u0644\u062f\u0631\u062c\u0627\u062a",
        title: "3. \u0627\u0644\u062a\u0642\u064a\u064a\u0645 \u0648\u0627\u0644\u062f\u0631\u062c\u0627\u062a",
        content: "\u062f\u0631\u062c\u0629 \u0627\u0644\u0646\u062c\u0627\u062d: \u064a\u0644\u0632\u0645 \u0627\u0644\u062d\u0635\u0648\u0644 \u0639\u0644\u0649 70% \u0643\u062d\u062f \u0623\u062f\u0646\u0649 \u0641\u064a \u0627\u0644\u062a\u0642\u064a\u064a\u0645 \u0627\u0644\u0646\u0647\u0627\u0626\u064a \u0644\u0625\u0635\u062f\u0627\u0631 \u0634\u0647\u0627\u062f\u0629 \u0627\u0644\u0625\u062a\u0645\u0627\u0645.\n\n\u0633\u064a\u0627\u0633\u0629 \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631: \u064a\u064f\u0645\u0646\u062d \u0627\u0644\u0645\u062a\u0639\u0644\u0645\u0648\u0646 \u062b\u0644\u0627\u062b (3) \u0645\u062d\u0627\u0648\u0644\u0627\u062a \u0644\u0627\u062c\u062a\u064a\u0627\u0632 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631 \u0627\u0644\u0646\u0647\u0627\u0626\u064a. \u0625\u0630\u0627 \u0641\u0634\u0644 \u0627\u0644\u0645\u062a\u0639\u0644\u0645 \u0641\u064a \u062c\u0645\u064a\u0639 \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0627\u062a \u0627\u0644\u062b\u0644\u0627\u062b\u060c \u064a\u062c\u0628 \u0639\u0644\u064a\u0647 \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062a\u0633\u062c\u064a\u0644 \u0641\u064a \u0627\u0644\u062f\u0648\u0631\u0629.\n\n\u0627\u0644\u062a\u063a\u0630\u064a\u0629 \u0627\u0644\u0631\u0627\u062c\u0639\u0629: \u064a\u062a\u0645 \u062a\u0642\u062f\u064a\u0645 \u0627\u0644\u062a\u063a\u0630\u064a\u0629 \u0627\u0644\u0631\u0627\u062c\u0639\u0629 \u0641\u0648\u0631\u064b\u0627 \u0628\u0639\u062f \u062a\u0642\u062f\u064a\u0645 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631 \u0644\u062a\u0639\u0632\u064a\u0632 \u0627\u0644\u0627\u0633\u062a\u064a\u0639\u0627\u0628."
      },
      {
        sectionId: "academic-integrity",
        sidebarLabel: "4. \u0627\u0644\u0646\u0632\u0627\u0647\u0629 \u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a\u0629",
        title: "4. \u0627\u0644\u0646\u0632\u0627\u0647\u0629 \u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a\u0629",
        content: "\u062a\u0637\u0628\u0642 \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633 \u0633\u064a\u0627\u0633\u0629 \u0639\u062f\u0645 \u0627\u0644\u062a\u0633\u0627\u0645\u062d \u0627\u0644\u0645\u0637\u0644\u0642 \u062a\u062c\u0627\u0647 \u0627\u0644\u063a\u0634 \u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a.\n\n- \u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0647\u0648\u064a\u0629: \u064a\u062c\u0628 \u0639\u0644\u0649 \u0627\u0644\u0645\u062a\u0639\u0644\u0645\u064a\u0646 \u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0631\u0642\u0645 \u062a\u0631\u062e\u064a\u0635 \u0627\u0644\u0647\u064a\u0626\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0644\u0644\u062a\u062e\u0635\u0635\u0627\u062a \u0627\u0644\u0635\u062d\u064a\u0629 \u0648\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064a. \u0627\u0646\u062a\u062d\u0627\u0644 \u0627\u0644\u0634\u062e\u0635\u064a\u0629 \u064a\u0639\u062f \u0645\u062e\u0627\u0644\u0641\u0629 \u0644\u0644\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u0633\u0639\u0648\u062f\u064a.\n- \u0627\u0644\u0627\u0646\u062a\u062d\u0627\u0644 \u0648\u0627\u0644\u063a\u0634: \u0623\u064a \u0645\u062d\u0627\u0648\u0644\u0629 \u0644\u0644\u062a\u0644\u0627\u0639\u0628 \u0628\u0646\u062a\u0627\u0626\u062c \u0627\u0644\u062a\u0642\u064a\u064a\u0645 \u0623\u0648 \u0645\u0634\u0627\u0631\u0643\u0629 \u0625\u062c\u0627\u0628\u0627\u062a \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631 \u0633\u062a\u0624\u062f\u064a \u0625\u0644\u0649 \u062a\u0639\u0644\u064a\u0642 \u0627\u0644\u062d\u0633\u0627\u0628 \u0641\u0648\u0631\u064b\u0627 \u0648\u0625\u0644\u063a\u0627\u0621 \u0623\u064a \u0634\u0647\u0627\u062f\u0627\u062a \u0635\u0627\u062f\u0631\u0629."
      },
      {
        sectionId: "intellectual-property",
        sidebarLabel: "5. \u0627\u0644\u0645\u0644\u0643\u064a\u0629 \u0627\u0644\u0641\u0643\u0631\u064a\u0629",
        title: "5. \u062d\u0642\u0648\u0642 \u0627\u0644\u0645\u0644\u0643\u064a\u0629 \u0627\u0644\u0641\u0643\u0631\u064a\u0629",
        content: "\u062c\u0645\u064a\u0639 \u0645\u0648\u0627\u062f \u0627\u0644\u062f\u0648\u0631\u0629\u060c \u0628\u0645\u0627 \u0641\u064a \u0630\u0644\u0643 \u0627\u0644\u0641\u064a\u062f\u064a\u0648\u0647\u0627\u062a \u0648\u0627\u0644\u0634\u0631\u0627\u0626\u062d \u0648\u0645\u0644\u0641\u0627\u062a PDF \u0648\u0627\u0644\u062a\u0642\u064a\u064a\u0645\u0627\u062a\u060c \u0647\u064a \u0645\u0644\u0643 \u062d\u0635\u0631\u064a \u0644\u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633 \u0648\u0645\u062f\u0631\u0628\u064a\u0647\u0627.\n\n- \u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645: \u0627\u0644\u0645\u0648\u0627\u062f \u0645\u062e\u0635\u0635\u0629 \u0644\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0627\u0644\u062a\u0639\u0644\u064a\u0645\u064a \u0627\u0644\u0634\u062e\u0635\u064a \u0641\u0642\u0637.\n- \u0627\u0644\u062a\u0648\u0632\u064a\u0639: \u064a\u064f\u062d\u0638\u0631 \u062a\u0645\u0627\u0645\u064b\u0627 \u0627\u0644\u062a\u0633\u062c\u064a\u0644 \u0623\u0648 \u0627\u0644\u0627\u0633\u062a\u0646\u0633\u0627\u062e \u0623\u0648 \u0645\u0634\u0627\u0631\u0643\u0629 \u0645\u062d\u062a\u0648\u0649 \u0627\u0644\u062f\u0648\u0631\u0629 \u063a\u064a\u0631 \u0627\u0644\u0645\u0635\u0631\u062d \u0628\u0647 \u0639\u0644\u0649 \u0627\u0644\u0645\u0646\u0635\u0627\u062a \u0627\u0644\u0639\u0627\u0645\u0629 \u0648\u064a\u062e\u0636\u0639 \u0644\u0644\u0625\u062c\u0631\u0627\u0621\u0627\u062a \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064a\u0629 \u0628\u0645\u0648\u062c\u0628 \u0642\u0648\u0627\u0646\u064a\u0646 \u0627\u0644\u0645\u0644\u0643\u064a\u0629 \u0627\u0644\u0641\u0643\u0631\u064a\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629."
      },
      {
        sectionId: "refund-policy",
        sidebarLabel: "6. \u0627\u0644\u0625\u0644\u063a\u0627\u0621 \u0648\u0627\u0644\u0627\u0633\u062a\u0631\u062f\u0627\u062f",
        title: "6. \u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u0625\u0644\u063a\u0627\u0621 \u0648\u0627\u0644\u0627\u0633\u062a\u0631\u062f\u0627\u062f",
        content: "\u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u062f\u0648\u0631\u0629: \u0625\u0630\u0627 \u0623\u0644\u063a\u062a \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633 \u062f\u0648\u0631\u0629 \u062a\u062f\u0631\u064a\u0628\u064a\u0629 \u0645\u0628\u0627\u0634\u0631\u0629\u060c \u064a\u062d\u0642 \u0644\u0644\u0645\u062a\u0639\u0644\u0645\u064a\u0646 \u0627\u0633\u062a\u0631\u062f\u0627\u062f 100% \u0623\u0648 \u0631\u0635\u064a\u062f \u0644\u062f\u0648\u0631\u0627\u062a \u0645\u0633\u062a\u0642\u0628\u0644\u064a\u0629.\n\n\u0627\u0646\u0633\u062d\u0627\u0628 \u0627\u0644\u0645\u062a\u0639\u0644\u0645:\n\n- \u0627\u0644\u062f\u0648\u0631\u0627\u062a \u0627\u0644\u062a\u062f\u0631\u064a\u0628\u064a\u0629 \u0627\u0644\u0630\u0627\u062a\u064a\u0629: \u064a\u062a\u0648\u0641\u0631 \u0627\u0644\u0627\u0633\u062a\u0631\u062f\u0627\u062f \u062e\u0644\u0627\u0644 48 \u0633\u0627\u0639\u0629 \u0645\u0646 \u0627\u0644\u0634\u0631\u0627\u0621\u060c \u0634\u0631\u064a\u0637\u0629 \u0623\u0644\u0627 \u064a\u0643\u0648\u0646 \u0627\u0644\u0645\u062a\u0639\u0644\u0645 \u0642\u062f \u0648\u0635\u0644 \u0625\u0644\u0649 \u0623\u0643\u062b\u0631 \u0645\u0646 10% \u0645\u0646 \u0627\u0644\u0645\u062d\u062a\u0648\u0649 \u0623\u0648 \u062d\u0627\u0648\u0644 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631 \u0627\u0644\u0646\u0647\u0627\u0626\u064a.\n- \u0627\u0644\u062f\u0648\u0631\u0627\u062a \u0627\u0644\u062a\u062f\u0631\u064a\u0628\u064a\u0629 \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629: \u064a\u062a\u0648\u0641\u0631 \u0627\u0644\u0627\u0633\u062a\u0631\u062f\u0627\u062f \u0642\u0628\u0644 3 \u0623\u064a\u0627\u0645 \u0645\u0646 \u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0628\u062f\u0621. \u0644\u0627 \u064a\u062a\u0645 \u0625\u0635\u062f\u0627\u0631 \u0627\u0633\u062a\u0631\u062f\u0627\u062f \u0644\u062d\u0627\u0644\u0627\u062a \u0639\u062f\u0645 \u0627\u0644\u062d\u0636\u0648\u0631."
      },
      {
        sectionId: "technical-requirements",
        sidebarLabel: "7. \u0627\u0644\u0645\u062a\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u062a\u0642\u0646\u064a\u0629",
        title: "7. \u0627\u0644\u0645\u062a\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u062a\u0642\u0646\u064a\u0629",
        content: "\u0644\u0636\u0645\u0627\u0646 \u062a\u062c\u0631\u0628\u0629 \u062a\u0639\u0644\u0645 \u0633\u0644\u0633\u0629\u060c \u064a\u062c\u0628 \u0623\u0646 \u064a\u062a\u0648\u0641\u0631 \u0644\u062f\u0649 \u0627\u0644\u0645\u062a\u0639\u0644\u0645\u064a\u0646:\n\n- \u0627\u062a\u0635\u0627\u0644 \u0625\u0646\u062a\u0631\u0646\u062a \u0645\u0633\u062a\u0642\u0631 (\u0633\u0631\u0639\u0629 \u062a\u062d\u0645\u064a\u0644 \u0644\u0627 \u062a\u0642\u0644 \u0639\u0646 2 \u0645\u064a\u063a\u0627\u0628\u062a \u0641\u064a \u0627\u0644\u062b\u0627\u0646\u064a\u0629).\n- \u062c\u0647\u0627\u0632 \u0645\u062a\u0648\u0627\u0641\u0642 (\u062d\u0627\u0633\u0628 \u0645\u0643\u062a\u0628\u064a \u0623\u0648 \u0645\u062d\u0645\u0648\u0644 \u0623\u0648 \u062c\u0647\u0627\u0632 \u0644\u0648\u062d\u064a) \u0645\u0639 \u0645\u062a\u0635\u0641\u062d \u0648\u064a\u0628 \u0645\u062d\u062f\u062b (Chrome \u0623\u0648 Safari \u0623\u0648 Edge).\n- \u0633\u0645\u0627\u0639\u0627\u062a \u0623\u0648 \u0645\u0643\u0628\u0631\u0627\u062a \u0635\u0648\u062a \u0644\u0644\u0645\u062d\u062a\u0648\u0649 \u0627\u0644\u0635\u0648\u062a\u064a."
      },
      {
        sectionId: "privacy-data",
        sidebarLabel: "8. \u0627\u0644\u062e\u0635\u0648\u0635\u064a\u0629 \u0648\u062d\u0645\u0627\u064a\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a",
        title: "8. \u0627\u0644\u062e\u0635\u0648\u0635\u064a\u0629 \u0648\u062d\u0645\u0627\u064a\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a",
        content: "\u0646\u0644\u062a\u0632\u0645 \u0628\u0633\u064a\u0627\u0633\u0627\u062a \u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0648\u0637\u0646\u064a\u0629 \u0627\u0644\u0635\u0627\u062f\u0631\u0629 \u0639\u0646 \u0647\u064a\u0626\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0648\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a (SDAIA).\n\n- \u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a: \u064a\u062a\u0645 \u0645\u0634\u0627\u0631\u0643\u0629 \u0628\u064a\u0627\u0646\u0627\u062a\u0643 \u0627\u0644\u0634\u062e\u0635\u064a\u0629 (\u0627\u0644\u0627\u0633\u0645 \u0648\u0631\u0642\u0645 \u0627\u0644\u062a\u0631\u062e\u064a\u0635 \u0648\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a) \u062d\u0635\u0631\u064a\u064b\u0627 \u0645\u0639 \u0627\u0644\u0647\u064a\u0626\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0644\u0644\u062a\u062e\u0635\u0635\u0627\u062a \u0627\u0644\u0635\u062d\u064a\u0629 (\u0645\u0645\u0627\u0631\u0633 \u0628\u0644\u0633) \u0644\u063a\u0631\u0636 \u062a\u0633\u062c\u064a\u0644 \u0633\u0627\u0639\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631.\n- \u0627\u0644\u0633\u0631\u064a\u0629: \u0644\u0627 \u0646\u0628\u064a\u0639 \u0623\u0648 \u0646\u0634\u0627\u0631\u0643 \u0628\u064a\u0627\u0646\u0627\u062a\u0643 \u0645\u0639 \u0645\u0639\u0644\u0646\u064a\u0646 \u0645\u0646 \u0623\u0637\u0631\u0627\u0641 \u062b\u0627\u0644\u062b\u0629."
      }
    ]
  },
  termsPage: {
    title: "\u0627\u0644\u0634\u0631\u0648\u0637 \u0648\u0627\u0644\u0623\u062d\u0643\u0627\u0645",
    lastUpdated: "\u0622\u062e\u0631 \u062a\u062d\u062f\u064a\u062b: \u064a\u0646\u0627\u064a\u0631 2026",
    sections: [
      {
        sectionId: "introduction",
        sidebarLabel: "1. \u0627\u0644\u0645\u0642\u062f\u0645\u0629",
        title: "1. \u0627\u0644\u0645\u0642\u062f\u0645\u0629",
        content: "\u0645\u0631\u062d\u0628\u064b\u0627 \u0628\u0643 \u0641\u064a \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633. \u0628\u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0645\u0648\u0642\u0639\u0646\u0627 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a \u0623\u0648 \u0627\u0644\u062a\u0633\u062c\u064a\u0644 \u0641\u064a \u0627\u0644\u062f\u0648\u0631\u0627\u062a \u0623\u0648 \u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u062e\u062f\u0645\u0627\u062a\u0646\u0627\u060c \u0641\u0625\u0646\u0643 \u062a\u0648\u0627\u0641\u0642 \u0639\u0644\u0649 \u0627\u0644\u0627\u0644\u062a\u0632\u0627\u0645 \u0628\u0647\u0630\u0647 \u0627\u0644\u0634\u0631\u0648\u0637 \u0648\u0627\u0644\u0623\u062d\u0643\u0627\u0645. \u0625\u0630\u0627 \u0644\u0645 \u062a\u0648\u0627\u0641\u0642 \u0639\u0644\u0649 \u0623\u064a \u062c\u0632\u0621 \u0645\u0646 \u0647\u0630\u0647 \u0627\u0644\u0634\u0631\u0648\u0637\u060c \u064a\u062c\u0628 \u0639\u0644\u064a\u0643 \u0627\u0644\u062a\u0648\u0642\u0641 \u0639\u0646 \u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0645\u0646\u0635\u062a\u0646\u0627 \u0641\u0648\u0631\u064b\u0627. \u062a\u0634\u0643\u0644 \u0647\u0630\u0647 \u0627\u0644\u0634\u0631\u0648\u0637 \u0627\u062a\u0641\u0627\u0642\u064b\u0627 \u0645\u0644\u0632\u0645\u064b\u0627 \u0642\u0627\u0646\u0648\u0646\u064a\u064b\u0627 \u0628\u064a\u0646\u0643 \u0648\u0628\u064a\u0646 \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633\u060c \u0627\u0644\u062a\u064a \u064a\u0642\u0639 \u0645\u0642\u0631\u0647\u0627 \u0627\u0644\u0631\u0626\u064a\u0633\u064a \u0641\u064a \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629."
      },
      {
        sectionId: "medical-disclaimer",
        sidebarLabel: "2. \u0625\u062e\u0644\u0627\u0621 \u0627\u0644\u0645\u0633\u0624\u0648\u0644\u064a\u0629 \u0627\u0644\u0637\u0628\u064a\u0629",
        title: "2. \u0625\u062e\u0644\u0627\u0621 \u0627\u0644\u0645\u0633\u0624\u0648\u0644\u064a\u0629 \u0627\u0644\u0637\u0628\u064a\u0629",
        content: "\u062a\u0642\u062f\u0645 \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633 \u0645\u062d\u062a\u0648\u0649 \u062a\u0639\u0644\u064a\u0645\u064a \u0644\u0644\u062a\u0637\u0648\u064a\u0631 \u0627\u0644\u0645\u0647\u0646\u064a \u0648\u0627\u0644\u0625\u0639\u062f\u0627\u062f \u0644\u0644\u0627\u0645\u062a\u062d\u0627\u0646\u0627\u062a \u0641\u0642\u0637.\n\n- \u0644\u064a\u0633 \u0646\u0635\u064a\u062d\u0629 \u0637\u0628\u064a\u0629: \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u0645\u0642\u062f\u0645\u0629 \u0641\u064a \u062f\u0648\u0631\u0627\u062a\u0646\u0627 \u0644\u064a\u0633\u062a \u0628\u062f\u064a\u0644\u064b\u0627 \u0639\u0646 \u0627\u0644\u0627\u0633\u062a\u0634\u0627\u0631\u0629 \u0627\u0644\u0637\u0628\u064a\u0629 \u0627\u0644\u0645\u062a\u062e\u0635\u0635\u0629 \u0623\u0648 \u0627\u0644\u062a\u0634\u062e\u064a\u0635 \u0623\u0648 \u0627\u0644\u0639\u0644\u0627\u062c.\n- \u0627\u0644\u062d\u0643\u0645 \u0627\u0644\u0645\u0647\u0646\u064a: \u0627\u0644\u0645\u0645\u0627\u0631\u0633\u0648\u0646 \u0627\u0644\u0635\u062d\u064a\u0648\u0646 \u0645\u0633\u0624\u0648\u0644\u0648\u0646 \u0639\u0646 \u0645\u0645\u0627\u0631\u0633\u0629 \u062d\u0643\u0645\u0647\u0645 \u0627\u0644\u0633\u0631\u064a\u0631\u064a \u0627\u0644\u062e\u0627\u0635 \u0639\u0646\u062f \u062a\u0637\u0628\u064a\u0642 \u0627\u0644\u0645\u0641\u0627\u0647\u064a\u0645 \u0627\u0644\u0645\u0643\u062a\u0633\u0628\u0629 \u0639\u0644\u0649 \u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0645\u0631\u0636\u0649. \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633 \u063a\u064a\u0631 \u0645\u0633\u0624\u0648\u0644\u0629 \u0639\u0646 \u0623\u064a \u0623\u062e\u0637\u0627\u0621 \u0637\u0628\u064a\u0629 \u0623\u0648 \u0646\u062a\u0627\u0626\u062c \u0633\u0644\u0628\u064a\u0629 \u0644\u0644\u0645\u0631\u0636\u0649 \u0646\u0627\u062a\u062c\u0629 \u0639\u0646 \u062a\u0637\u0628\u064a\u0642 \u062a\u062f\u0631\u064a\u0628\u0646\u0627."
      },
      {
        sectionId: "user-accounts",
        sidebarLabel: "3. \u062d\u0633\u0627\u0628\u0627\u062a \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646 \u0648\u0627\u0644\u0623\u0645\u0627\u0646",
        title: "3. \u062d\u0633\u0627\u0628\u0627\u062a \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646 \u0648\u0627\u0644\u0623\u0645\u0627\u0646",
        content: "\u0645\u0633\u0624\u0648\u0644\u064a\u0629 \u0627\u0644\u062d\u0633\u0627\u0628: \u0623\u0646\u062a \u0645\u0633\u0624\u0648\u0644 \u0639\u0646 \u0627\u0644\u062d\u0641\u0627\u0638 \u0639\u0644\u0649 \u0633\u0631\u064a\u0629 \u0628\u064a\u0627\u0646\u0627\u062a \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0627\u0644\u062e\u0627\u0635\u0629 \u0628\u0643. \u064a\u064f\u062d\u0638\u0631 \u0639\u0644\u064a\u0643 \u0628\u0634\u0643\u0644 \u0635\u0627\u0631\u0645 \u0645\u0634\u0627\u0631\u0643\u0629 \u062d\u0633\u0627\u0628\u0643 \u0645\u0639 \u0627\u0644\u0622\u062e\u0631\u064a\u0646.\n\n\u0645\u0633\u062a\u062e\u062f\u0645 \u0648\u0627\u062d\u062f\u060c \u062d\u0633\u0627\u0628 \u0648\u0627\u062d\u062f: \u0627\u0644\u062d\u0633\u0627\u0628\u0627\u062a \u063a\u064a\u0631 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u062a\u062d\u0648\u064a\u0644. \u0634\u0631\u0627\u0621 \u062f\u0648\u0631\u0629 \u064a\u0645\u0646\u062d\u0643 \u062a\u0631\u062e\u064a\u0635\u064b\u0627 \u0644\u0645\u0634\u0627\u0647\u062f\u062a\u0647\u0627\u061b \u0644\u0627 \u064a\u0645\u0643\u0646\u0643 \"\u0645\u0634\u0627\u0631\u0643\u0629\" \u0627\u0644\u062a\u0631\u062e\u064a\u0635 \u0645\u0639 \u0627\u0644\u0632\u0645\u0644\u0627\u0621.\n\n\u0627\u0644\u0648\u0635\u0648\u0644 \u063a\u064a\u0631 \u0627\u0644\u0645\u0635\u0631\u062d \u0628\u0647: \u064a\u062c\u0628 \u0639\u0644\u064a\u0643 \u0625\u062e\u0637\u0627\u0631\u0646\u0627 \u0641\u0648\u0631\u064b\u0627 \u0628\u0623\u064a \u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u063a\u064a\u0631 \u0645\u0635\u0631\u062d \u0628\u0647 \u0644\u062d\u0633\u0627\u0628\u0643."
      },
      {
        sectionId: "payments",
        sidebarLabel: "4. \u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0627\u062a \u0648\u0636\u0631\u064a\u0628\u0629 \u0627\u0644\u0642\u064a\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629",
        title: "4. \u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0627\u062a \u0648\u0636\u0631\u064a\u0628\u0629 \u0627\u0644\u0642\u064a\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629",
        content: "\u0627\u0644\u0639\u0645\u0644\u0629: \u062a\u062a\u0645 \u0645\u0639\u0627\u0644\u062c\u0629 \u062c\u0645\u064a\u0639 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0627\u062a \u0628\u0627\u0644\u0631\u064a\u0627\u0644 \u0627\u0644\u0633\u0639\u0648\u062f\u064a (SAR).\n\n\u0636\u0631\u064a\u0628\u0629 \u0627\u0644\u0642\u064a\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629: \u0648\u0641\u0642\u064b\u0627 \u0644\u0623\u0646\u0638\u0645\u0629 \u0647\u064a\u0626\u0629 \u0627\u0644\u0632\u0643\u0627\u0629 \u0648\u0627\u0644\u0636\u0631\u064a\u0628\u0629 \u0648\u0627\u0644\u062c\u0645\u0627\u0631\u0643 (ZATCA)\u060c \u062a\u064f\u0637\u0628\u0642 \u0636\u0631\u064a\u0628\u0629 \u0627\u0644\u0642\u064a\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629 \u0628\u0646\u0633\u0628\u0629 15% \u0639\u0644\u0649 \u062c\u0645\u064a\u0639 \u0627\u0644\u0645\u0634\u062a\u0631\u064a\u0627\u062a \u0645\u0627 \u0644\u0645 \u064a\u064f\u0630\u0643\u0631 \u062e\u0644\u0627\u0641 \u0630\u0644\u0643.\n\n\u0637\u0631\u0642 \u0627\u0644\u062f\u0641\u0639: \u0646\u0642\u0628\u0644 \u0627\u0644\u062f\u0641\u0639 \u0639\u0628\u0631 \u0645\u062f\u0649 \u0648\u0641\u064a\u0632\u0627 \u0648\u0645\u0627\u0633\u062a\u0631\u0643\u0627\u0631\u062f \u0648\u0622\u0628\u0644 \u0628\u0627\u064a \u0648STC Pay. \u064a\u062a\u0645 \u0645\u0646\u062d \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0645\u0648\u0627\u062f \u0627\u0644\u062f\u0648\u0631\u0629 \u0641\u0642\u0637 \u0628\u0639\u062f \u062a\u0623\u0643\u064a\u062f \u0627\u0644\u062f\u0641\u0639 \u0628\u0646\u062c\u0627\u062d."
      },
      {
        sectionId: "intellectual-property",
        sidebarLabel: "5. \u0627\u0644\u0645\u0644\u0643\u064a\u0629 \u0627\u0644\u0641\u0643\u0631\u064a\u0629",
        title: "5. \u062d\u0642\u0648\u0642 \u0627\u0644\u0645\u0644\u0643\u064a\u0629 \u0627\u0644\u0641\u0643\u0631\u064a\u0629",
        content: "\u0645\u0646\u0635\u0629 \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633\u060c \u0628\u0645\u0627 \u0641\u064a \u0630\u0644\u0643 \u0634\u0639\u0627\u0631\u0647\u0627 \u0648\u0643\u0648\u062f\u0647\u0627 \u0627\u0644\u0645\u0635\u062f\u0631\u064a \u0648\u0646\u0635\u0648\u0635\u0647\u0627 \u0648\u0631\u0633\u0648\u0645\u0627\u062a\u0647\u0627 \u0648\u0641\u064a\u062f\u064a\u0648\u0647\u0627\u062a \u0627\u0644\u062f\u0648\u0631\u0627\u062a\u060c \u0647\u064a \u0645\u0644\u0643 \u0644\u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633 \u0648\u0645\u062d\u0645\u064a\u0629 \u0628\u0645\u0648\u062c\u0628 \u0642\u0648\u0627\u0646\u064a\u0646 \u0627\u0644\u0647\u064a\u0626\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0644\u0644\u0645\u0644\u0643\u064a\u0629 \u0627\u0644\u0641\u0643\u0631\u064a\u0629 (SIPA).\n\n- \u0627\u0644\u0642\u064a\u0648\u062f: \u0644\u0627 \u064a\u062c\u0648\u0632 \u0644\u0643 \u062a\u0639\u062f\u064a\u0644 \u0623\u0648 \u0646\u0634\u0631 \u0623\u0648 \u0646\u0642\u0644 \u0623\u0648 \u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0629 \u0641\u064a \u0628\u064a\u0639 \u0623\u0648 \u0627\u0633\u062a\u0646\u0633\u0627\u062e \u0623\u0648 \u0625\u0646\u0634\u0627\u0621 \u0623\u0639\u0645\u0627\u0644 \u0645\u0634\u062a\u0642\u0629 \u0645\u0646 \u0623\u064a \u0645\u062d\u062a\u0648\u0649\u060c \u0643\u0644\u064a\u064b\u0627 \u0623\u0648 \u062c\u0632\u0626\u064a\u064b\u0627."
      },
      {
        sectionId: "limitation",
        sidebarLabel: "6. \u062a\u062d\u062f\u064a\u062f \u0627\u0644\u0645\u0633\u0624\u0648\u0644\u064a\u0629",
        title: "6. \u062a\u062d\u062f\u064a\u062f \u0627\u0644\u0645\u0633\u0624\u0648\u0644\u064a\u0629",
        content: "\u0625\u0644\u0649 \u0623\u0642\u0635\u0649 \u062d\u062f \u064a\u0633\u0645\u062d \u0628\u0647 \u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u0633\u0639\u0648\u062f\u064a:\n\n- \u0644\u0627 \u062a\u062a\u062d\u0645\u0644 \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633 \u0627\u0644\u0645\u0633\u0624\u0648\u0644\u064a\u0629 \u0639\u0646 \u0623\u064a \u0623\u0636\u0631\u0627\u0631 \u063a\u064a\u0631 \u0645\u0628\u0627\u0634\u0631\u0629 \u0623\u0648 \u0639\u0631\u0636\u064a\u0629 \u0623\u0648 \u062e\u0627\u0635\u0629 \u0623\u0648 \u062a\u0628\u0639\u064a\u0629 \u0646\u0627\u062a\u062c\u0629 \u0639\u0646 \u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0623\u0648 \u0639\u062f\u0645 \u0627\u0644\u0642\u062f\u0631\u0629 \u0639\u0644\u0649 \u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u062e\u062f\u0645\u0627\u062a\u0646\u0627.\n- \u0644\u0627 \u0646\u0636\u0645\u0646 \u0623\u0646 \u0627\u0644\u0645\u0646\u0635\u0629 \u0633\u062a\u0643\u0648\u0646 \u062e\u0627\u0644\u064a\u0629 \u0645\u0646 \u0627\u0644\u0623\u062e\u0637\u0627\u0621 \u0623\u0648 \u063a\u064a\u0631 \u0645\u0646\u0642\u0637\u0639\u0629. \u0646\u062d\u062a\u0641\u0638 \u0628\u0627\u0644\u062d\u0642 \u0641\u064a \u0625\u062c\u0631\u0627\u0621 \u0635\u064a\u0627\u0646\u0629 \u0645\u062c\u062f\u0648\u0644\u0629.\n- \u0644\u0633\u0646\u0627 \u0645\u0633\u0624\u0648\u0644\u064a\u0646 \u0639\u0646 \u0642\u0628\u0648\u0644 \u0623\u0648 \u0631\u0641\u0636 \u0633\u0627\u0639\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631 \u0645\u0646 \u0642\u0628\u0644 \u0647\u064a\u0626\u0627\u062a \u062f\u0648\u0644\u064a\u0629 \u062e\u0627\u0631\u062c \u0627\u0644\u0647\u064a\u0626\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0644\u0644\u062a\u062e\u0635\u0635\u0627\u062a \u0627\u0644\u0635\u062d\u064a\u0629."
      },
      {
        sectionId: "termination",
        sidebarLabel: "7. \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645",
        title: "7. \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645",
        content: "\u062a\u062d\u062a\u0641\u0638 \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633 \u0628\u0627\u0644\u062d\u0642 \u0641\u064a \u062a\u0639\u0644\u064a\u0642 \u0623\u0648 \u0625\u0646\u0647\u0627\u0621 \u062d\u0633\u0627\u0628\u0643 \u0648\u0641\u0642\u064b\u0627 \u0644\u062a\u0642\u062f\u064a\u0631\u0646\u0627 \u0627\u0644\u0645\u0637\u0644\u0642\u060c \u062f\u0648\u0646 \u0625\u0634\u0639\u0627\u0631\u060c \u0628\u0633\u0628\u0628 \u0633\u0644\u0648\u0643 \u0646\u0639\u062a\u0642\u062f \u0623\u0646\u0647 \u064a\u0646\u062a\u0647\u0643 \u0647\u0630\u0647 \u0627\u0644\u0634\u0631\u0648\u0637 \u0648\u0627\u0644\u0623\u062d\u0643\u0627\u0645 \u0623\u0648 \u064a\u0636\u0631 \u0628\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646 \u0627\u0644\u0622\u062e\u0631\u064a\u0646 \u0623\u0648 \u0628\u0646\u0627 \u0623\u0648 \u0628\u0623\u0637\u0631\u0627\u0641 \u062b\u0627\u0644\u062b\u0629\u060c \u0623\u0648 \u0644\u0623\u064a \u0633\u0628\u0628 \u0622\u062e\u0631."
      },
      {
        sectionId: "governing-law",
        sidebarLabel: "8. \u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u062d\u0627\u0643\u0645",
        title: "8. \u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u062d\u0627\u0643\u0645",
        content: "\u062a\u062e\u0636\u0639 \u0647\u0630\u0647 \u0627\u0644\u0634\u0631\u0648\u0637 \u0648\u062a\u064f\u0641\u0633\u0631 \u0648\u0641\u0642\u064b\u0627 \u0644\u0642\u0648\u0627\u0646\u064a\u0646 \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629. \u062a\u062e\u0636\u0639 \u0623\u064a \u0646\u0632\u0627\u0639\u0627\u062a \u0646\u0627\u0634\u0626\u0629 \u0628\u0645\u0648\u062c\u0628 \u0647\u0630\u0647 \u0627\u0644\u0634\u0631\u0648\u0637 \u0623\u0648 \u0641\u064a\u0645\u0627 \u064a\u062a\u0639\u0644\u0642 \u0628\u0647\u0627 \u0644\u0644\u0627\u062e\u062a\u0635\u0627\u0635 \u0627\u0644\u062d\u0635\u0631\u064a \u0644\u0644\u0645\u062d\u0627\u0643\u0645 \u0627\u0644\u0645\u0648\u062c\u0648\u062f\u0629 \u0641\u064a \u0627\u0644\u0631\u064a\u0627\u0636\u060c \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629."
      },
      {
        sectionId: "contact",
        sidebarLabel: "9. \u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u0627\u062a\u0635\u0627\u0644",
        title: "9. \u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u0627\u062a\u0635\u0627\u0644",
        content: "\u0646\u062d\u062a\u0641\u0638 \u0628\u0627\u0644\u062d\u0642 \u0641\u064a \u062a\u0639\u062f\u064a\u0644 \u0647\u0630\u0647 \u0627\u0644\u0634\u0631\u0648\u0637 \u0641\u064a \u0623\u064a \u0648\u0642\u062a. \u062a\u0633\u0631\u064a \u0627\u0644\u062a\u063a\u064a\u064a\u0631\u0627\u062a \u0641\u0648\u0631\u064b\u0627 \u0639\u0646\u062f \u0646\u0634\u0631\u0647\u0627 \u0639\u0644\u0649 \u0627\u0644\u0645\u0648\u0642\u0639. \u0627\u0633\u062a\u0645\u0631\u0627\u0631\u0643 \u0641\u064a \u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0627\u0644\u062e\u062f\u0645\u0629 \u0628\u0639\u062f \u0646\u0634\u0631 \u0627\u0644\u062a\u063a\u064a\u064a\u0631\u0627\u062a \u064a\u0639\u0646\u064a \u0642\u0628\u0648\u0644\u0643 \u0644\u0647\u0630\u0647 \u0627\u0644\u062a\u063a\u064a\u064a\u0631\u0627\u062a."
      }
    ]
  },
  learningPoliciesPage: {
    title: "\u0633\u064a\u0627\u0633\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u0645",
    lastUpdated: "\u0622\u062e\u0631 \u062a\u062d\u062f\u064a\u062b: \u064a\u0646\u0627\u064a\u0631 2026",
    sections: [
      {
        sectionId: "general",
        sidebarLabel: "1. \u0627\u0644\u0623\u062d\u0643\u0627\u0645 \u0627\u0644\u0639\u0627\u0645\u0629",
        title: "1. \u0627\u0644\u0623\u062d\u0643\u0627\u0645 \u0627\u0644\u0639\u0627\u0645\u0629",
        content: "\u062a\u0644\u062a\u0632\u0645 \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633 \u0628\u062a\u0642\u062f\u064a\u0645 \u062a\u0639\u0644\u064a\u0645 \u0637\u0628\u064a \u0639\u0627\u0644\u064a \u0627\u0644\u062c\u0648\u062f\u0629 \u0645\u062a\u0648\u0627\u0641\u0642 \u0645\u0639 \u0627\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u0648\u0637\u0646\u064a \u0644\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a (NELC) \u0648\u0627\u0644\u0647\u064a\u0626\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0644\u0644\u062a\u062e\u0635\u0635\u0627\u062a \u0627\u0644\u0635\u062d\u064a\u0629 (SCFHS). \u0628\u0627\u0644\u062a\u0633\u062c\u064a\u0644 \u0641\u064a \u062f\u0648\u0631\u0627\u062a\u0646\u0627\u060c \u064a\u0648\u0627\u0641\u0642 \u0627\u0644\u0645\u062a\u0639\u0644\u0645\u0648\u0646 \u0639\u0644\u0649 \u0627\u0644\u0627\u0644\u062a\u0632\u0627\u0645 \u0628\u0627\u0644\u0633\u064a\u0627\u0633\u0627\u062a \u0627\u0644\u0645\u0648\u0636\u062d\u0629 \u0623\u062f\u0646\u0627\u0647. \u062a\u062e\u0636\u0639 \u0647\u0630\u0647 \u0627\u0644\u0633\u064a\u0627\u0633\u0627\u062a \u0644\u0644\u062a\u062d\u062f\u064a\u062b\u0627\u062a \u0648\u0641\u0642\u064b\u0627 \u0644\u0623\u0646\u0638\u0645\u0629 \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629."
      },
      {
        sectionId: "attendance",
        sidebarLabel: "2. \u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u062d\u0636\u0648\u0631",
        title: "2. \u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u062d\u0636\u0648\u0631 (\u0645\u062a\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631)",
        content: "\u0644\u0636\u0645\u0627\u0646 \u0646\u0632\u0627\u0647\u0629 \u0633\u0627\u0639\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631 (CME)\u060c \u064a\u062c\u0628 \u0645\u0631\u0627\u0642\u0628\u0629 \u0627\u0644\u062d\u0636\u0648\u0631 \u0628\u0634\u0643\u0644 \u0635\u0627\u0631\u0645:\n\n- \u0627\u0644\u0646\u062f\u0648\u0627\u062a \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629: \u064a\u062c\u0628 \u0639\u0644\u0649 \u0627\u0644\u0645\u062a\u0639\u0644\u0645\u064a\u0646 \u062d\u0636\u0648\u0631 80% \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644 \u0645\u0646 \u0645\u062f\u0629 \u0627\u0644\u062c\u0644\u0633\u0629 \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629 \u0644\u0644\u062a\u0623\u0647\u0644 \u0644\u0644\u0634\u0647\u0627\u062f\u0629.\n- \u0627\u0644\u062f\u0648\u0631\u0627\u062a \u0627\u0644\u0645\u0633\u062c\u0644\u0629: \u064a\u062c\u0628 \u0639\u0644\u0649 \u0627\u0644\u0645\u062a\u0639\u0644\u0645\u064a\u0646 \u0645\u0634\u0627\u0647\u062f\u0629 100% \u0645\u0646 \u0645\u062d\u062a\u0648\u0649 \u0627\u0644\u0641\u064a\u062f\u064a\u0648 \u0648\u0625\u0643\u0645\u0627\u0644 \u062c\u0645\u064a\u0639 \u0627\u0644\u0648\u062d\u062f\u0627\u062a \u0627\u0644\u062a\u0641\u0627\u0639\u0644\u064a\u0629.\n- \u0639\u062f\u0645 \u0627\u0644\u062d\u0636\u0648\u0631: \u0625\u0630\u0627 \u0644\u0645 \u064a\u062a\u0645 \u0627\u0633\u062a\u064a\u0641\u0627\u0621 \u0627\u0644\u062d\u062f \u0627\u0644\u0623\u062f\u0646\u0649\u060c \u0644\u0646 \u064a\u0643\u0648\u0646 \u0627\u0644\u0645\u062a\u0639\u0644\u0645 \u0645\u0624\u0647\u0644\u064b\u0627 \u0644\u0633\u0627\u0639\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631 \u0648\u064a\u062c\u0628 \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062f\u0648\u0631\u0629."
      },
      {
        sectionId: "assessment",
        sidebarLabel: "3. \u0627\u0644\u062a\u0642\u064a\u064a\u0645 \u0648\u0627\u0644\u062f\u0631\u062c\u0627\u062a",
        title: "3. \u0627\u0644\u062a\u0642\u064a\u064a\u0645 \u0648\u0627\u0644\u062f\u0631\u062c\u0627\u062a",
        content: "\u062f\u0631\u062c\u0629 \u0627\u0644\u0646\u062c\u0627\u062d: \u064a\u0644\u0632\u0645 \u0627\u0644\u062d\u0635\u0648\u0644 \u0639\u0644\u0649 70% \u0643\u062d\u062f \u0623\u062f\u0646\u0649 \u0641\u064a \u0627\u0644\u062a\u0642\u064a\u064a\u0645 \u0627\u0644\u0646\u0647\u0627\u0626\u064a \u0644\u0625\u0635\u062f\u0627\u0631 \u0634\u0647\u0627\u062f\u0629 \u0627\u0644\u0625\u062a\u0645\u0627\u0645.\n\n\u0633\u064a\u0627\u0633\u0629 \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631: \u064a\u064f\u0645\u0646\u062d \u0627\u0644\u0645\u062a\u0639\u0644\u0645\u0648\u0646 \u062b\u0644\u0627\u062b (3) \u0645\u062d\u0627\u0648\u0644\u0627\u062a \u0644\u0627\u062c\u062a\u064a\u0627\u0632 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631 \u0627\u0644\u0646\u0647\u0627\u0626\u064a. \u0625\u0630\u0627 \u0641\u0634\u0644 \u0627\u0644\u0645\u062a\u0639\u0644\u0645 \u0641\u064a \u062c\u0645\u064a\u0639 \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0627\u062a \u0627\u0644\u062b\u0644\u0627\u062b\u060c \u064a\u062c\u0628 \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062a\u0633\u062c\u064a\u0644.\n\n\u0627\u0644\u062a\u063a\u0630\u064a\u0629 \u0627\u0644\u0631\u0627\u062c\u0639\u0629: \u064a\u062a\u0645 \u062a\u0642\u062f\u064a\u0645 \u0627\u0644\u062a\u063a\u0630\u064a\u0629 \u0627\u0644\u0631\u0627\u062c\u0639\u0629 \u0627\u0644\u062a\u0644\u0642\u0627\u0626\u064a\u0629 \u0641\u0648\u0631\u064b\u0627 \u0628\u0639\u062f \u062a\u0642\u062f\u064a\u0645 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631 \u0644\u062a\u0639\u0632\u064a\u0632 \u0627\u0644\u0627\u0633\u062a\u064a\u0639\u0627\u0628."
      },
      {
        sectionId: "integrity",
        sidebarLabel: "4. \u0627\u0644\u0646\u0632\u0627\u0647\u0629 \u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a\u0629",
        title: "4. \u0627\u0644\u0646\u0632\u0627\u0647\u0629 \u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a\u0629",
        content: "\u062a\u0637\u0628\u0642 \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633 \u0633\u064a\u0627\u0633\u0629 \u0639\u062f\u0645 \u0627\u0644\u062a\u0633\u0627\u0645\u062d \u0627\u0644\u0645\u0637\u0644\u0642 \u062a\u062c\u0627\u0647 \u0627\u0644\u063a\u0634 \u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a.\n\n- \u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0647\u0648\u064a\u0629: \u064a\u062c\u0628 \u0639\u0644\u0649 \u0627\u0644\u0645\u062a\u0639\u0644\u0645\u064a\u0646 \u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0631\u0642\u0645 \u062a\u0631\u062e\u064a\u0635 \u0627\u0644\u0647\u064a\u0626\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0644\u0644\u062a\u062e\u0635\u0635\u0627\u062a \u0627\u0644\u0635\u062d\u064a\u0629 \u0648\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064a.\n- \u0627\u0644\u0627\u0646\u062a\u062d\u0627\u0644 \u0648\u0627\u0644\u063a\u0634: \u0623\u064a \u0645\u062d\u0627\u0648\u0644\u0629 \u0644\u0644\u062a\u0644\u0627\u0639\u0628 \u0628\u0627\u0644\u062f\u0631\u062c\u0627\u062a \u0623\u0648 \u0645\u0634\u0627\u0631\u0643\u0629 \u0625\u062c\u0627\u0628\u0627\u062a \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631 \u0633\u062a\u0624\u062f\u064a \u0625\u0644\u0649 \u062a\u0639\u0644\u064a\u0642 \u0627\u0644\u062d\u0633\u0627\u0628 \u0641\u0648\u0631\u064b\u0627 \u0648\u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u0634\u0647\u0627\u062f\u0627\u062a \u0627\u0644\u0635\u0627\u062f\u0631\u0629."
      },
      {
        sectionId: "intellectual",
        sidebarLabel: "5. \u0627\u0644\u0645\u0644\u0643\u064a\u0629 \u0627\u0644\u0641\u0643\u0631\u064a\u0629",
        title: "5. \u062d\u0642\u0648\u0642 \u0627\u0644\u0645\u0644\u0643\u064a\u0629 \u0627\u0644\u0641\u0643\u0631\u064a\u0629",
        content: "\u062c\u0645\u064a\u0639 \u0645\u0648\u0627\u062f \u0627\u0644\u062f\u0648\u0631\u0629\u060c \u0628\u0645\u0627 \u0641\u064a \u0630\u0644\u0643 \u0627\u0644\u0641\u064a\u062f\u064a\u0648\u0647\u0627\u062a \u0648\u0627\u0644\u0634\u0631\u0627\u0626\u062d \u0648\u0645\u0644\u0641\u0627\u062a PDF \u0648\u0627\u0644\u062a\u0642\u064a\u064a\u0645\u0627\u062a\u060c \u0647\u064a \u0645\u0644\u0643 \u062d\u0635\u0631\u064a \u0644\u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633 \u0648\u0645\u062f\u0631\u0628\u064a\u0647\u0627.\n\n- \u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645: \u0627\u0644\u0645\u0648\u0627\u062f \u0644\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0627\u0644\u062a\u0639\u0644\u064a\u0645\u064a \u0627\u0644\u0634\u062e\u0635\u064a \u0641\u0642\u0637.\n- \u0627\u0644\u062a\u0648\u0632\u064a\u0639: \u064a\u064f\u062d\u0638\u0631 \u0627\u0644\u062a\u0633\u062c\u064a\u0644 \u0623\u0648 \u0627\u0644\u0627\u0633\u062a\u0646\u0633\u0627\u062e \u0623\u0648 \u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0629 \u063a\u064a\u0631 \u0627\u0644\u0645\u0635\u0631\u062d \u0628\u0647\u0627 \u0648\u064a\u062e\u0636\u0639 \u0644\u0642\u0648\u0627\u0646\u064a\u0646 \u0627\u0644\u0645\u0644\u0643\u064a\u0629 \u0627\u0644\u0641\u0643\u0631\u064a\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629."
      },
      {
        sectionId: "cancellation",
        sidebarLabel: "6. \u0627\u0644\u0625\u0644\u063a\u0627\u0621 \u0648\u0627\u0644\u0627\u0633\u062a\u0631\u062f\u0627\u062f",
        title: "6. \u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u0625\u0644\u063a\u0627\u0621 \u0648\u0627\u0644\u0627\u0633\u062a\u0631\u062f\u0627\u062f",
        content: "\u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u062f\u0648\u0631\u0629: \u0625\u0630\u0627 \u0623\u0644\u063a\u062a \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633 \u062f\u0648\u0631\u0629 \u0645\u0628\u0627\u0634\u0631\u0629\u060c \u064a\u062d\u0642 \u0644\u0644\u0645\u062a\u0639\u0644\u0645\u064a\u0646 \u0627\u0633\u062a\u0631\u062f\u0627\u062f 100% \u0623\u0648 \u0631\u0635\u064a\u062f \u0644\u062f\u0648\u0631\u0627\u062a \u0645\u0633\u062a\u0642\u0628\u0644\u064a\u0629.\n\n\u0627\u0646\u0633\u062d\u0627\u0628 \u0627\u0644\u0645\u062a\u0639\u0644\u0645:\n\n- \u0627\u0644\u062f\u0648\u0631\u0627\u062a \u0627\u0644\u0630\u0627\u062a\u064a\u0629: \u064a\u062a\u0648\u0641\u0631 \u0627\u0644\u0627\u0633\u062a\u0631\u062f\u0627\u062f \u062e\u0644\u0627\u0644 48 \u0633\u0627\u0639\u0629 \u0645\u0646 \u0627\u0644\u0634\u0631\u0627\u0621\u060c \u0634\u0631\u064a\u0637\u0629 \u0623\u0644\u0627 \u064a\u0643\u0648\u0646 \u0627\u0644\u0645\u062a\u0639\u0644\u0645 \u0642\u062f \u0648\u0635\u0644 \u0625\u0644\u0649 \u0623\u0643\u062b\u0631 \u0645\u0646 10% \u0645\u0646 \u0627\u0644\u0645\u062d\u062a\u0648\u0649.\n- \u0627\u0644\u062f\u0648\u0631\u0627\u062a \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629: \u064a\u062a\u0648\u0641\u0631 \u0627\u0644\u0627\u0633\u062a\u0631\u062f\u0627\u062f \u0642\u0628\u0644 3 \u0623\u064a\u0627\u0645 \u0645\u0646 \u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0628\u062f\u0621. \u0644\u0627 \u0627\u0633\u062a\u0631\u062f\u0627\u062f \u0644\u062d\u0627\u0644\u0627\u062a \u0639\u062f\u0645 \u0627\u0644\u062d\u0636\u0648\u0631."
      },
      {
        sectionId: "technical",
        sidebarLabel: "7. \u0627\u0644\u0645\u062a\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u062a\u0642\u0646\u064a\u0629",
        title: "7. \u0627\u0644\u0645\u062a\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u062a\u0642\u0646\u064a\u0629",
        content: "\u0644\u0636\u0645\u0627\u0646 \u062a\u062c\u0631\u0628\u0629 \u062a\u0639\u0644\u0645 \u0633\u0644\u0633\u0629\u060c \u064a\u062c\u0628 \u0623\u0646 \u064a\u062a\u0648\u0641\u0631 \u0644\u062f\u0649 \u0627\u0644\u0645\u062a\u0639\u0644\u0645\u064a\u0646:\n\n- \u0627\u062a\u0635\u0627\u0644 \u0625\u0646\u062a\u0631\u0646\u062a \u0645\u0633\u062a\u0642\u0631 (\u0633\u0631\u0639\u0629 \u062a\u062d\u0645\u064a\u0644 2 \u0645\u064a\u063a\u0627\u0628\u062a \u0641\u064a \u0627\u0644\u062b\u0627\u0646\u064a\u0629 \u0643\u062d\u062f \u0623\u062f\u0646\u0649).\n- \u062c\u0647\u0627\u0632 \u0645\u062a\u0648\u0627\u0641\u0642 (\u062d\u0627\u0633\u0628 \u0645\u0643\u062a\u0628\u064a \u0623\u0648 \u0645\u062d\u0645\u0648\u0644 \u0623\u0648 \u062c\u0647\u0627\u0632 \u0644\u0648\u062d\u064a) \u0645\u0639 \u0645\u062a\u0635\u0641\u062d \u0645\u062d\u062f\u062b (Chrome \u0623\u0648 Edge \u0623\u0648 Safari).\n- \u0633\u0645\u0627\u0639\u0627\u062a \u0623\u0648 \u0645\u0643\u0628\u0631\u0627\u062a \u0635\u0648\u062a \u0644\u0644\u0645\u062d\u062a\u0648\u0649 \u0627\u0644\u0635\u0648\u062a\u064a."
      },
      {
        sectionId: "privacy",
        sidebarLabel: "8. \u0627\u0644\u062e\u0635\u0648\u0635\u064a\u0629 \u0648\u062d\u0645\u0627\u064a\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a",
        title: "8. \u0627\u0644\u062e\u0635\u0648\u0635\u064a\u0629 \u0648\u062d\u0645\u0627\u064a\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a",
        content: "\u0646\u0644\u062a\u0632\u0645 \u0628\u0633\u064a\u0627\u0633\u0627\u062a \u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0648\u0637\u0646\u064a\u0629 \u0627\u0644\u0635\u0627\u062f\u0631\u0629 \u0639\u0646 \u0647\u064a\u0626\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0648\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a (SDAIA).\n\n- \u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a: \u064a\u062a\u0645 \u0645\u0634\u0627\u0631\u0643\u0629 \u0628\u064a\u0627\u0646\u0627\u062a\u0643 \u0627\u0644\u0634\u062e\u0635\u064a\u0629 (\u0627\u0644\u0627\u0633\u0645 \u0648\u0631\u0642\u0645 \u0627\u0644\u062a\u0631\u062e\u064a\u0635 \u0648\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a) \u062d\u0635\u0631\u064a\u064b\u0627 \u0645\u0639 \u0627\u0644\u0647\u064a\u0626\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0644\u0644\u062a\u062e\u0635\u0635\u0627\u062a \u0627\u0644\u0635\u062d\u064a\u0629 (\u0645\u0645\u0627\u0631\u0633 \u0628\u0644\u0633) \u0644\u062a\u0633\u062c\u064a\u0644 \u0633\u0627\u0639\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631.\n- \u0627\u0644\u0633\u0631\u064a\u0629: \u0644\u0627 \u0646\u0628\u064a\u0639 \u0623\u0648 \u0646\u0634\u0627\u0631\u0643 \u0628\u064a\u0627\u0646\u0627\u062a\u0643 \u0645\u0639 \u0645\u0639\u0644\u0646\u064a\u0646 \u0645\u0646 \u0623\u0637\u0631\u0627\u0641 \u062b\u0627\u0644\u062b\u0629."
      }
    ]
  },
  footer: {
    companyDescription: "\u0645\u0646\u0635\u0629 \u062a\u0639\u0644\u064a\u0645 \u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a \u0648\u062a\u062f\u0631\u064a\u0628 \u0635\u062d\u064a \u0645\u062a\u0648\u0627\u0641\u0642\u0629 \u0645\u0639 \u0627\u0644\u0645\u0639\u0627\u064a\u064a\u0631 \u0627\u0644\u0648\u0637\u0646\u064a\u0629",
    platform: "\u0627\u0644\u0645\u0646\u0635\u0629",
    organization: "\u0627\u0644\u0645\u0624\u0633\u0633\u0629",
    support: "\u0627\u0644\u062f\u0639\u0645",
    copyright: "\u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633\u060c 2025"
  },
  courses: [
    {
      title: "\u0645\u0643\u0627\u0641\u062d\u0629 \u0627\u0644\u0639\u062f\u0648\u0649 (\u0627\u0644\u0623\u0633\u0627\u0633\u064a\u0629 / \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629)",
      description: "\u0646\u0638\u0631\u0629 \u0639\u0627\u0645\u0629 \u0634\u0627\u0645\u0644\u0629 \u0642\u0627\u0626\u0645\u0629 \u0639\u0644\u0649 \u0627\u0644\u0623\u062f\u0644\u0629 \u062d\u0648\u0644 \u0627\u0633\u062a\u0631\u0627\u062a\u064a\u062c\u064a\u0627\u062a \u0627\u0644\u0648\u0642\u0627\u064a\u0629 \u0645\u0646 \u0627\u0644\u0639\u062f\u0648\u0649 \u0641\u064a \u0628\u064a\u0626\u0627\u062a \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629 \u0627\u0644\u062d\u062f\u064a\u062b\u0629.",
      date: "2026-01-11",
      hours: 8,
      price: 575,
      slug: "infection-control-flagship",
      courseType: "\u0628\u062b \u0645\u0628\u0627\u0634\u0631"
    },
    {
      title: "\u062f\u0639\u0645 \u0627\u0644\u062d\u064a\u0627\u0629 / \u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0637\u0648\u0627\u0631\u0626",
      description: "\u0627\u0644\u0645\u0647\u0627\u0631\u0627\u062a \u0627\u0644\u0623\u0633\u0627\u0633\u064a\u0629 \u0644\u0625\u0646\u0642\u0627\u0630 \u0627\u0644\u062d\u064a\u0627\u0629 \u0644\u0644\u0627\u0633\u062a\u062c\u0627\u0628\u0629 \u0627\u0644\u0645\u0628\u0643\u0631\u0629 \u0648\u0627\u0644\u0625\u0646\u0639\u0627\u0634 \u0648\u0625\u062f\u0627\u0631\u0629 \u062d\u0627\u0644\u0627\u062a \u0627\u0644\u0637\u0648\u0627\u0631\u0626.",
      date: "2026-01-18",
      hours: 6,
      price: 375,
      slug: "life-support-emergency-care",
      courseType: "\u0628\u062b \u0645\u0628\u0627\u0634\u0631"
    },
    {
      title: "\u0633\u0644\u0627\u0645\u0629 \u0627\u0644\u0645\u0631\u0636\u0649 \u0648\u0627\u0644\u062c\u0648\u062f\u0629",
      description: "\u062a\u0639\u0644\u0645 \u0623\u0633\u0627\u0644\u064a\u0628 \u0645\u0646\u0638\u0645\u0629 \u0644\u062a\u0642\u0644\u064a\u0644 \u0627\u0644\u0623\u062e\u0637\u0627\u0621 \u0627\u0644\u0637\u0628\u064a\u0629 \u0648\u062a\u062d\u0633\u064a\u0646 \u0627\u0644\u0646\u062a\u0627\u0626\u062c \u0648\u062a\u0639\u0632\u064a\u0632 \u062c\u0648\u062f\u0629 \u0627\u0644\u0631\u0639\u0627\u064a\u0629.",
      date: "2026-01-11",
      hours: 8,
      price: 460,
      slug: "patient-safety-quality",
      courseType: "\u0628\u062b \u0645\u0628\u0627\u0634\u0631"
    },
    {
      title: "\u0627\u0644\u0635\u062d\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 \u0648\u0627\u0644\u0627\u0633\u062a\u0639\u062f\u0627\u062f",
      description: "\u0645\u0628\u0627\u062f\u0626 \u0627\u0644\u0645\u0631\u0627\u0642\u0628\u0629 \u0648\u062a\u0642\u064a\u064a\u0645 \u0627\u0644\u0645\u062e\u0627\u0637\u0631 \u0648\u0627\u0644\u0627\u0633\u062a\u062c\u0627\u0628\u0629 \u0627\u0644\u0645\u0646\u0633\u0642\u0629 \u0644\u062d\u0627\u0644\u0627\u062a \u0627\u0644\u0637\u0648\u0627\u0631\u0626 \u0627\u0644\u0635\u062d\u064a\u0629 \u0627\u0644\u0639\u0627\u0645\u0629.",
      date: "2026-01-11",
      hours: 8,
      price: 575,
      slug: "public-health-preparedness",
      courseType: "\u0628\u062b \u0645\u0628\u0627\u0634\u0631"
    }
  ],
  testimonialItems: [
    {
      quote: "\u0643\u0627\u0646 \u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0645\u0646\u0638\u0645\u064b\u0627 \u0628\u0634\u0643\u0644 \u062c\u064a\u062f \u0648\u0642\u0627\u0628\u0644\u064b\u0627 \u0644\u0644\u062a\u0637\u0628\u064a\u0642 \u0645\u0628\u0627\u0634\u0631\u0629 \u0641\u064a \u0645\u0645\u0627\u0631\u0633\u062a\u0646\u0627 \u0627\u0644\u0633\u0631\u064a\u0631\u064a\u0629. \u0643\u0627\u0646 \u0627\u0644\u0645\u062d\u062a\u0648\u0649 \u0645\u062a\u0648\u0627\u0641\u0642\u064b\u0627 \u0645\u0639 \u0627\u0644\u0645\u0639\u0627\u064a\u064a\u0631 \u0627\u0644\u062d\u0627\u0644\u064a\u0629\u060c \u0648\u0623\u0638\u0647\u0631 \u0627\u0644\u0645\u062f\u0631\u0628\u0648\u0646 \u062e\u0628\u0631\u0629 \u0633\u0631\u064a\u0631\u064a\u0629 \u0642\u0648\u064a\u0629.",
      authorName: "\u062f. \u0623\u062d\u0645\u062f \u0627\u0644\u0642\u062d\u0637\u0627\u0646\u064a",
      authorRole: "\u0627\u0633\u062a\u0634\u0627\u0631\u064a\u060c \u0645\u0633\u062a\u0634\u0641\u0649 \u062d\u0643\u0648\u0645\u064a"
    },
    {
      quote: "\u0645\u0627 \u062a\u0645\u064a\u0632 \u0628\u0647 \u0647\u0648 \u0648\u0636\u0648\u062d \u0627\u0644\u0645\u0627\u062f\u0629 \u0648\u0627\u0644\u062a\u0631\u0643\u064a\u0632 \u0627\u0644\u0639\u0645\u0644\u064a. \u0633\u0627\u0639\u062f \u0627\u0644\u0628\u0631\u0646\u0627\u0645\u062c \u0641\u064a \u062a\u0639\u0632\u064a\u0632 \u0627\u0644\u0628\u0631\u0648\u062a\u0648\u0643\u0648\u0644\u0627\u062a \u0627\u0644\u062d\u0631\u062c\u0629 \u0648\u0642\u062f\u0645 \u0633\u0627\u0639\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631 \u0627\u0644\u0645\u0639\u062a\u0645\u062f\u0629 \u062f\u0648\u0646 \u0627\u0644\u0645\u0633\u0627\u0633 \u0628\u0627\u0644\u062c\u0648\u062f\u0629.",
      authorName: "\u0633\u0627\u0631\u0629 \u0627\u0644\u062d\u0627\u0631\u062b\u064a",
      authorRole: "\u0623\u062e\u0635\u0627\u0626\u064a\u0629 \u062a\u0645\u0631\u064a\u0636 \u0623\u0648\u0644\u0649"
    },
    {
      quote: "\u062a\u0648\u0641\u0631 \u0627\u0644\u0645\u0646\u0635\u0629 \u0628\u064a\u0626\u0629 \u062a\u0639\u0644\u064a\u0645\u064a\u0629 \u0645\u0648\u062b\u0648\u0642\u0629 \u062a\u0644\u0628\u064a \u0645\u062a\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0627\u0644\u0648\u0637\u0646\u064a\u0629. \u0648\u0647\u064a \u0645\u0646\u0627\u0633\u0628\u0629 \u0644\u0644\u0645\u062a\u062e\u0635\u0635\u064a\u0646 \u0627\u0644\u0623\u0641\u0631\u0627\u062f \u0648\u0645\u0628\u0627\u062f\u0631\u0627\u062a \u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0627\u0644\u0645\u0624\u0633\u0633\u064a\u0629 \u0639\u0644\u0649 \u062d\u062f \u0633\u0648\u0627\u0621.",
      authorName: "\u0641\u064a\u0635\u0644 \u0627\u0644\u0645\u0637\u064a\u0631\u064a",
      authorRole: "\u0645\u0639\u0647\u062f \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0635\u062d\u064a"
    },
    {
      quote: "\u062a\u062c\u0631\u0628\u0629 \u062a\u062f\u0631\u064a\u0628\u064a\u0629 \u0627\u0633\u062a\u062b\u0646\u0627\u0626\u064a\u0629 \u0641\u0627\u0642\u062a \u062a\u0648\u0642\u0639\u0627\u062a\u0646\u0627. \u0627\u0644\u0645\u0646\u0647\u062c \u0634\u0627\u0645\u0644 \u0648\u0627\u0644\u0645\u062f\u0631\u0628\u0648\u0646 \u064a\u062c\u0644\u0628\u0648\u0646 \u062e\u0628\u0631\u0629 \u0648\u0627\u0642\u0639\u064a\u0629 \u062a\u062b\u0631\u064a \u0643\u0644 \u062c\u0644\u0633\u0629.",
      authorName: "\u062f. \u0644\u064a\u0644\u0649 \u0627\u0644\u0631\u0627\u0634\u062f",
      authorRole: "\u0645\u062f\u064a\u0631\u0629 \u0637\u0628\u064a\u0629\u060c \u0639\u064a\u0627\u062f\u0629 \u062e\u0627\u0635\u0629"
    },
    {
      quote: "\u0643\u0627\u0646\u062a \u0639\u0645\u0644\u064a\u0629 \u0627\u0644\u062d\u0635\u0648\u0644 \u0639\u0644\u0649 \u0627\u0644\u0634\u0647\u0627\u062f\u0629 \u0633\u0644\u0633\u0629 \u0648\u0645\u0648\u0627\u062f \u0627\u0644\u062f\u0648\u0631\u0629 \u0645\u0646 \u0623\u0639\u0644\u0649 \u062c\u0648\u062f\u0629. \u0623\u0648\u0635\u064a \u0628\u0634\u062f\u0629 \u0628\u0647\u0630\u0647 \u0627\u0644\u0645\u0646\u0635\u0629 \u0644\u0623\u064a \u0645\u062a\u062e\u0635\u0635 \u0641\u064a \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629 \u064a\u0633\u0639\u0649 \u0644\u0644\u062d\u0635\u0648\u0644 \u0639\u0644\u0649 \u062a\u062f\u0631\u064a\u0628 \u0645\u0639\u062a\u0645\u062f.",
      authorName: "\u0645\u062d\u0645\u062f \u0627\u0644\u0632\u0647\u0631\u0627\u0646\u064a",
      authorRole: "\u0635\u064a\u062f\u0644\u064a \u0633\u0631\u064a\u0631\u064a"
    },
    {
      quote: "\u062f\u0639\u0645 \u0645\u062a\u0645\u064a\u0632 \u0645\u0646 \u0627\u0644\u0641\u0631\u064a\u0642 \u0648\u0647\u064a\u0643\u0644 \u062f\u0648\u0631\u0629 \u0645\u0645\u062a\u0627\u0632. \u062c\u0639\u0644\u062a \u0627\u0644\u0648\u062d\u062f\u0627\u062a \u0627\u0644\u062a\u0641\u0627\u0639\u0644\u064a\u0629 \u0627\u0644\u062a\u0639\u0644\u0645 \u062c\u0630\u0627\u0628\u064b\u0627 \u0648\u0636\u0645\u0646\u062a \u0627\u0644\u062a\u0642\u064a\u064a\u0645\u0627\u062a \u0627\u0644\u0639\u0645\u0644\u064a\u0629 \u062a\u0637\u0628\u064a\u0642 \u0627\u0644\u0645\u0639\u0631\u0641\u0629 \u0641\u0648\u0631\u064b\u0627.",
      authorName: "\u0646\u0648\u0631\u0629 \u0627\u0644\u0639\u062a\u064a\u0628\u064a",
      authorRole: "\u0631\u0626\u064a\u0633\u0629 \u0627\u0644\u062a\u0645\u0631\u064a\u0636\u060c \u0645\u0633\u062a\u0634\u0641\u0649 \u0625\u0642\u0644\u064a\u0645\u064a"
    }
  ],
  contactPage: {
    title: "\u0627\u062a\u0635\u0644 \u0628\u0646\u0627",
    subtitle: "\u0646\u062d\u0646 \u062f\u0627\u0626\u0645\u0627 \u062c\u0627\u0647\u0632\u0648\u0646 \u0644\u0644\u0631\u062f \u0639\u0644\u0649 \u0623\u0633\u0626\u0644\u062a\u0643\u0645 \u0648\u0627\u0633\u062a\u0641\u0633\u0627\u0631\u0627\u062a\u0643\u0645.",
    formFullNameLabel: "\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0643\u0627\u0645\u0644",
    formEmailLabel: "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a",
    formIssueTypeLabel: "\u062d\u062f\u062f \u0646\u0648\u0639 \u0627\u0644\u0645\u0634\u0643\u0644\u0629",
    formSelectOptionLabel: "\u062d\u062f\u062f \u062e\u064a\u0627\u0631\u064b\u0627",
    formPhoneLabel: "\u0631\u0642\u0645 \u0627\u0644\u062a\u0644\u064a\u0641\u0648\u0646",
    formSubjectLabel: "\u0645\u0648\u0636\u0648\u0639",
    formDescriptionLabel: "\u0648\u0635\u0641",
    formCharactersLeftLabel: "\u062d\u0631\u0641\u0627 \u0628\u0642\u064a",
    formSubmitLabel: "\u0625\u0631\u0633\u0627\u0644",
    issueTypeTechnicalSupport: "\u0627\u0644\u062f\u0639\u0645 \u0627\u0644\u0641\u0646\u064a",
    issueTypeBillingIssue: "\u0645\u0634\u0643\u0644\u0629 \u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631",
    issueTypeCourseInquiry: "\u0627\u0633\u062a\u0641\u0633\u0627\u0631 \u0639\u0646 \u0627\u0644\u062f\u0648\u0631\u0629",
    issueTypePartnership: "\u0634\u0631\u0627\u0643\u0629",
    issueTypeOther: "\u0623\u062e\u0631\u0649",
    generalInquiryLabel: "\u0627\u0633\u062a\u0641\u0633\u0627\u0631 \u0639\u0627\u0645",
    generalInquiryEmail: "inquiry@physioguidance.org",
    technicalSupportLabel: "\u0627\u0644\u062f\u0639\u0645 \u0627\u0644\u0641\u0646\u064a",
    technicalSupportPhone: "+966 920035022",
    address: "\u0625\u0643\u0633\u064a\u0632\u060c \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629",
    getDirectionsLabel: "\u0627\u0644\u062d\u0635\u0648\u0644 \u0639\u0644\u0649 \u0627\u0644\u0627\u062a\u062c\u0627\u0647\u0627\u062a",
    loadingMapText: "\u062c\u0627\u0631\u064a \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u062e\u0631\u064a\u0637\u0629...",
    mapLatitude: 24.4539,
    mapLongitude: 39.6142,
    mapPopupText: "PhysioGuidance - \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629"
  },
  feedbackPage: {
    title: "\u0646\u062d\u0646 \u0646\u0642\u062f\u0631 \u0631\u0623\u064a\u0643",
    description: "\u0633\u0627\u0639\u062f\u0646\u0627 \u0641\u064a \u062a\u062d\u0633\u064a\u0646 \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0641\u064a \u0627\u0644\u0645\u0645\u0644\u0643\u0629. \u064a\u062a\u0645 \u0625\u0631\u0633\u0627\u0644 \u062a\u0639\u0644\u064a\u0642\u0627\u062a\u0643 \u0645\u0628\u0627\u0634\u0631\u0629\u064b \u0625\u0644\u0649 \u0641\u0631\u064a\u0642 \u0636\u0645\u0627\u0646 \u0627\u0644\u062c\u0648\u062f\u0629 \u0644\u062f\u064a\u0646\u0627.",
    formFullNameLabel: "\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0643\u0627\u0645\u0644",
    formEmailLabel: "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a",
    formSubjectLabel: "\u0645\u0648\u0636\u0648\u0639",
    formDescriptionLabel: "\u0648\u0635\u0641",
    formCharactersLeftPrefix: "\u0628\u0642\u064a",
    formCharactersLeftSuffix: "\u062d\u0631\u0641\u0627",
    formSubmitLabel: "\u064a\u0642\u062f\u0645"
  },
  certificationsPage: {
    breadcrumb: "\u0627\u0644\u0634\u0647\u0627\u062f\u0627\u062a \u0648 \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631",
    heroTitle: "\u0634\u0647\u0627\u062f\u0629 \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631 (CME)",
    heroDescription: "\u0645\u0639\u062a\u0645\u062f\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0647\u064a\u0626\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0644\u0644\u062a\u062e\u0635\u0635\u0627\u062a \u0627\u0644\u0635\u062d\u064a\u0629 (SCFHS) \u0648\u0627\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u0648\u0637\u0646\u064a \u0644\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a (NELC). \u0627\u062d\u0635\u0644 \u0639\u0644\u0649 \u0633\u0627\u0639\u0627\u062a \u0645\u0639\u062a\u0631\u0641 \u0628\u0647\u0627 \u0644\u062a\u062c\u062f\u064a\u062f \u0631\u062e\u0635\u062a\u0643 \u0627\u0644\u0645\u0647\u0646\u064a\u0629.",
    heroButtonLabel: "\u062a\u0635\u0641\u062d \u0627\u0644\u062f\u0648\u0631\u0627\u062a \u0627\u0644\u0645\u0639\u062a\u0645\u062f\u0629",
    nelcTitle: "\u0645\u0631\u062e\u0635 \u0645\u0646 NELC",
    nelcDescription: "PhysioGuidance \u0645\u0631\u062e\u0635 \u0631\u0633\u0645\u064a\u064b\u0627 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u0648\u0637\u0646\u064a \u0644\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a \u0641\u064a \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629\u060c \u0645\u0645\u0627 \u064a\u0636\u0645\u0646 \u0623\u0639\u0644\u0649 \u0645\u0639\u0627\u064a\u064a\u0631 \u062c\u0648\u062f\u0629 \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0631\u0642\u0645\u064a \u0648\u0627\u0644\u0627\u0645\u062a\u062b\u0627\u0644 \u0644\u0647.",
    nelcLicenseLabel: "\u0631\u0642\u0645 \u0627\u0644\u062a\u0631\u062e\u064a\u0635:",
    nelcLicenseNumber: "123456789",
    scfhsTitle: "\u062a\u0645\u062a \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u064a\u0647 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0647\u064a\u0626\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0644\u0644\u062a\u062e\u0635\u0635\u0627\u062a \u0627\u0644\u0635\u062d\u064a\u0629 (SCFHS)",
    scfhsDescription: "\u062f\u0648\u0631\u0627\u062a\u0646\u0627 \u0627\u0644\u0637\u0628\u064a\u0629 \u0645\u0639\u062a\u0645\u062f\u0629 \u0645\u0646 \u0627\u0644\u0647\u064a\u0626\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0644\u0644\u062a\u062e\u0635\u0635\u0627\u062a \u0627\u0644\u0635\u062d\u064a\u0629. \u062c\u0645\u064a\u0639 \u0634\u0647\u0627\u062f\u0627\u062a \u0627\u0644\u0625\u0646\u062c\u0627\u0632 \u0635\u0627\u0644\u062d\u0629 \u0644\u0644\u062a\u0635\u0646\u064a\u0641 \u0627\u0644\u0645\u0647\u0646\u064a \u0648\u062a\u062c\u062f\u064a\u062f \u0627\u0644\u062a\u0633\u062c\u064a\u0644 \u0639\u0628\u0631 Mumaris Plus.",
    scfhsAccreditationLabel: "\u0631\u0642\u0645 \u0627\u0644\u0627\u0639\u062a\u0645\u0627\u062f:",
    scfhsAccreditationNumber: "123456789",
    verificationTitle: "\u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0634\u0647\u0627\u062f\u0629",
    verificationSubtitle: "\u0623\u062f\u062e\u0644 \u0645\u0639\u0631\u0641 \u0627\u0644\u0634\u0647\u0627\u062f\u0629 \u0644\u0644\u062a\u062d\u0642\u0642",
    verificationPlaceholder: "PG-2025-X82910",
    verificationButtonLabel: "\u062a\u062d\u0642\u0642",
    claimCMETitle: "\u0643\u064a\u0641\u064a\u0629 \u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0629 \u0628\u0633\u0627\u0639\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631 \u0627\u0644\u062e\u0627\u0635\u0629 \u0628\u0643",
    step1Title: "\u0623\u0643\u0645\u0644 \u0627\u0644\u062f\u0648\u0631\u0629",
    step1Description: "\u0634\u0627\u0647\u062f \u062c\u0645\u064a\u0639 \u0627\u0644\u0648\u062d\u062f\u0627\u062a \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u0648\u0627\u062d\u0636\u0631 80% \u0645\u0646 \u062c\u0644\u0633\u0627\u062a \u0627\u0644\u0646\u062f\u0648\u0627\u062a \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629 \u0639\u0628\u0631 \u0627\u0644\u0648\u064a\u0628 (\u0625\u0646 \u0623\u0645\u0643\u0646).",
    step2Title: "\u0627\u062c\u062a\u064a\u0627\u0632 \u0627\u0644\u062a\u0642\u064a\u064a\u0645",
    step2Description: "\u062d\u0642\u0642 \u062f\u0631\u062c\u0629 \u0627\u0644\u0646\u062c\u0627\u062d 70% \u0623\u0648 \u0623\u0639\u0644\u0649 \u0641\u064a \u0627\u062e\u062a\u0628\u0627\u0631 \u0627\u0644\u062a\u0642\u064a\u064a\u0645 \u0627\u0644\u0646\u0647\u0627\u0626\u064a.",
    step3Title: "\u062a\u062d\u0645\u064a\u0644 \u0633\u0627\u0639\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631",
    step3Description: "\u0642\u0645 \u0628\u062a\u0646\u0632\u064a\u0644 \u0634\u0647\u0627\u062f\u062a\u0643 \u0639\u0644\u0649 \u0627\u0644\u0641\u0648\u0631 \u0648\u0642\u0645 \u0628\u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0645\u0639\u0631\u0641 \u0627\u0644\u0641\u0631\u064a\u062f \u0645\u0628\u0627\u0634\u0631\u0629 \u0625\u0644\u0649 \u0644\u0648\u062d\u0629 \u0645\u0639\u0644\u0648\u0645\u0627\u062a Mumaris Plus \u0627\u0644\u062e\u0627\u0635\u0629 \u0628\u0643."
  },
  nelcPage: {
    heroTitle: "\u0645\u0644\u062a\u0632\u0645\u0648\u0646 \u0628\u0645\u0639\u0627\u064a\u064a\u0631 \u0627\u0644\u062c\u0648\u062f\u0629 \u0627\u0644\u0648\u0637\u0646\u064a\u0629",
    heroDescription: "PhysioGuidance \u0647\u0648 \u0645\u0632\u0648\u062f \u0645\u0631\u062e\u0635 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0628\u0645\u0648\u062c\u0628 \u0627\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u0648\u0637\u0646\u064a \u0644\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a (NELC) \u0641\u064a \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629.",
    licenseNumberLabel: "\u0631\u0642\u0645 \u0627\u0644\u062a\u0631\u062e\u064a\u0635",
    licenseNumberValue: "\u0627\u0644\u0645\u062f\u064a\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629",
    licenseTypeLabel: "\u0646\u0648\u0639 \u0627\u0644\u062a\u0631\u062e\u064a\u0635",
    licenseTypeValue: "\u0645\u0631\u0641\u0642 \u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0639\u0644\u0649 \u0627\u0644\u062a\u0639\u0644\u0645 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a",
    statusLabel: "\u062d\u0627\u0644\u0629",
    statusValue: "\u0646\u0634\u064a\u0637",
    complianceTitle: "\u0627\u0645\u062a\u062b\u0627\u0644\u0646\u0627",
    complianceDescription: "\u0646\u062d\u0646 \u0646\u0644\u062a\u0632\u0645 \u0628\u0634\u0643\u0644 \u0635\u0627\u0631\u0645 \u0628\u0627\u0644\u0645\u0639\u0627\u064a\u064a\u0631 \u0627\u0644\u062a\u0634\u063a\u064a\u0644\u064a\u0629 \u0644\u0640 NELC \u0644\u0636\u0645\u0627\u0646 \u062a\u062c\u0631\u0628\u0629 \u062a\u0639\u0644\u064a\u0645\u064a\u0629 \u0645\u062a\u0645\u064a\u0632\u0629",
    governanceTitle: "\u0627\u0644\u062d\u0643\u0645",
    governanceDescription: "\u0633\u064a\u0627\u0633\u0627\u062a \u0634\u0641\u0627\u0641\u0629 \u0644\u0644\u062d\u0636\u0648\u0631 \u0648\u0648\u0636\u0639 \u0627\u0644\u062f\u0631\u062c\u0627\u062a \u0648\u0627\u0644\u062a\u0638\u0644\u0645\u0627\u062a.",
    technologyTitle: "\u062a\u0643\u0646\u0648\u0644\u0648\u062c\u064a\u0627",
    technologyDescription: "\u0646\u0638\u0627\u0645 \u0623\u0633\u0627\u0633\u064a \u0622\u0645\u0646 \u064a\u0633\u0647\u0644 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u064a\u0647 \u0648\u064a\u062d\u0645\u064a \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0645\u062a\u0639\u0644\u0645 \u0648\u0627\u0644\u0645\u0644\u0643\u064a\u0629 \u0627\u0644\u0641\u0643\u0631\u064a\u0629.",
    instructionTitle: "\u062a\u0639\u0644\u064a\u0645\u0627\u062a",
    instructionDescription: "\u062a\u0645 \u062a\u0635\u0645\u064a\u0645 \u062c\u0645\u064a\u0639 \u0627\u0644\u062f\u0648\u0631\u0627\u062a \u0627\u0644\u062a\u062f\u0631\u064a\u0628\u064a\u0629 \u0645\u0646 \u0642\u0628\u0644 \u062e\u0628\u0631\u0627\u0621 \u0641\u064a \u0627\u0644\u0645\u0648\u0636\u0648\u0639 \u0648\u062a\u062e\u0636\u0639 \u0644\u0645\u0631\u0627\u062c\u0639\u0629 \u0635\u0627\u0631\u0645\u0629 \u0644\u0644\u062c\u0648\u062f\u0629 \u0642\u0628\u0644 \u0627\u0644\u0646\u0634\u0631."
  },
  partnersPage: {
    title: "\u0627\u0644\u062a\u0639\u0627\u0648\u0646 \u0645\u0639 \u0627\u0644\u0642\u0627\u062f\u0629 \u0641\u064a \u0645\u062c\u0627\u0644 \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629"
  },
  instructorsPage: {
    meetExpertsTitle: "\u062a\u0639\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u062e\u0628\u0631\u0627\u0621",
    mindsBehindTitle: "\u0627\u0644\u0639\u0642\u0648\u0644 \u0648\u0631\u0627\u0621 \u0627\u0644\u062a\u0648\u062c\u064a\u0647 \u0627\u0644\u0637\u0628\u064a\u0639\u064a"
  },
  faqPage: {
    title: "\u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u0634\u0627\u0626\u0639\u0629",
    subtitle: "\u0644\u0627 \u064a\u0632\u0627\u0644 \u0644\u062f\u064a\u0643 \u0623\u064a \u0623\u0633\u0626\u0644\u0629\u061f",
    getInTouchLabel: "\u062a\u0648\u0627\u0635\u0644 \u0645\u0639\u0646\u0627",
    items: [
      {
        question: "\u0647\u0644 PhysioGuidance \u0645\u0639\u062a\u0645\u062f \u0645\u0646 \u0627\u0644\u0647\u064a\u0626\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0644\u0644\u062a\u062e\u0635\u0635\u0627\u062a \u0627\u0644\u0635\u062d\u064a\u0629 (SCFHS)\u061f",
        answer: "\u0646\u0639\u0645\u060c \u0646\u062d\u0646 \u0645\u0632\u0648\u062f \u0645\u0639\u062a\u0645\u062f \u0628\u0627\u0644\u0643\u0627\u0645\u0644. \u062c\u0645\u064a\u0639 \u062f\u0648\u0631\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631 \u0644\u062f\u064a\u0646\u0627 \u0645\u0639\u062a\u0631\u0641 \u0628\u0647\u0627 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0647\u064a\u0626\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0644\u0644\u062a\u062e\u0635\u0635\u0627\u062a \u0627\u0644\u0635\u062d\u064a\u0629."
      },
      {
        question: "\u0643\u064a\u0641 \u064a\u0645\u0643\u0646\u0646\u064a \u062a\u062d\u0645\u064a\u0644 \u0633\u0627\u0639\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631 \u0627\u0644\u062e\u0627\u0635\u0629 \u0628\u064a \u0625\u0644\u0649 Mumaris Plus\u061f",
        answer: "\u0646\u062d\u0646 \u0646\u062a\u0639\u0627\u0645\u0644 \u0645\u0639 \u0647\u0630\u0627 \u0645\u0646 \u0623\u062c\u0644\u0643! \u0628\u0645\u062c\u0631\u062f \u0627\u062c\u062a\u064a\u0627\u0632\u0643 \u0627\u0644\u062f\u0648\u0631\u0629\u060c \u064a\u0642\u0648\u0645 \u0646\u0638\u0627\u0645\u0646\u0627 \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b \u0628\u0625\u0628\u0644\u0627\u063a \u0633\u0627\u0639\u0627\u062a\u0643 \u0625\u0644\u0649 Mumaris Plus \u062e\u0644\u0627\u0644 48 \u0633\u0627\u0639\u0629. \u064a\u0631\u062c\u0649 \u0627\u0644\u062a\u0623\u0643\u062f \u0645\u0646 \u0635\u062d\u0629 \u0631\u0642\u0645 \u062a\u0631\u062e\u064a\u0635 \u0627\u0644\u0647\u064a\u0626\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0644\u0644\u062a\u062e\u0635\u0635\u0627\u062a \u0627\u0644\u0635\u062d\u064a\u0629 (SCFHS) \u0641\u064a \u0645\u0644\u0641\u0643 \u0627\u0644\u0634\u062e\u0635\u064a."
      },
      {
        question: "\u0627\u0633\u0645\u064a \u0645\u0643\u062a\u0648\u0628 \u0628\u0634\u0643\u0644 \u062e\u0627\u0637\u0626 \u0641\u064a \u0634\u0647\u0627\u062f\u062a\u064a. \u0643\u064a\u0641 \u064a\u0645\u0643\u0646\u0646\u064a \u0627\u0635\u0644\u0627\u062d\u0647\u0627\u061f",
        answer: "\u062a\u0633\u062a\u062e\u062f\u0645 \u0634\u0647\u0627\u062f\u062a\u0643 \u0627\u0644\u0627\u0633\u0645 \u062a\u0645\u0627\u0645\u0627\u064b \u0643\u0645\u0627 \u064a\u0638\u0647\u0631 \u0641\u064a \u0645\u0644\u0641 \u0627\u0644\u062a\u0639\u0631\u064a\u0641 \u0627\u0644\u062e\u0627\u0635 \u0628\u0643. \u064a\u0645\u0643\u0646\u0643 \u062a\u0639\u062f\u064a\u0644 \u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0645\u0644\u0641 \u0627\u0644\u062a\u0639\u0631\u064a\u0641 \u0627\u0644\u062e\u0627\u0635 \u0628\u0643 \u0642\u0628\u0644 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0634\u0647\u0627\u062f\u0629. \u0625\u0630\u0627 \u062a\u0645 \u0625\u0646\u0634\u0627\u0624\u0647 \u0628\u0627\u0644\u0641\u0639\u0644\u060c \u0641\u064a\u0631\u062c\u0649 \u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u0628\u0627\u0644\u062f\u0639\u0645."
      },
      {
        question: "\u0647\u0644 PhysioGuidance \u0645\u0639\u062a\u0645\u062f \u0645\u0646 \u0627\u0644\u0647\u064a\u0626\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0644\u0644\u062a\u062e\u0635\u0635\u0627\u062a \u0627\u0644\u0635\u062d\u064a\u0629 (SCFHS)\u061f",
        answer: "\u0646\u0639\u0645\u060c \u0646\u062d\u0646 \u0645\u0632\u0648\u062f \u0645\u0639\u062a\u0645\u062f \u0628\u0627\u0644\u0643\u0627\u0645\u0644. \u062c\u0645\u064a\u0639 \u062f\u0648\u0631\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631 \u0644\u062f\u064a\u0646\u0627 \u0645\u0639\u062a\u0631\u0641 \u0628\u0647\u0627 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0647\u064a\u0626\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0644\u0644\u062a\u062e\u0635\u0635\u0627\u062a \u0627\u0644\u0635\u062d\u064a\u0629."
      }
    ]
  },
  supportPage: {
    title: "\u0643\u064a\u0641 \u064a\u0645\u0643\u0646\u0646\u0627 \u0645\u0633\u0627\u0639\u062f\u062a\u0643\u061f",
    subtitle: "\u0627\u0628\u062d\u062b \u0641\u064a \u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0645\u0639\u0631\u0641\u0629 \u0623\u0648 \u0623\u0631\u0633\u0644 \u062a\u0630\u0643\u0631\u0629 \u062f\u0639\u0645 \u2014 \u0639\u0627\u062f\u0629\u064b \u0645\u0627 \u0646\u0631\u062f \u062e\u0644\u0627\u0644 \u062f\u0642\u0627\u0626\u0642 \u062e\u0644\u0627\u0644 \u0633\u0627\u0639\u0627\u062a \u0627\u0644\u0639\u0645\u0644.",
    categoriesTitle: "\u062a\u0635\u0641\u0651\u062d \u062d\u0633\u0628 \u0627\u0644\u0641\u0626\u0629",
    categoriesSubtitle: "\u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u062c\u0627\u0644 \u0627\u0644\u0630\u064a \u062a\u062d\u062a\u0627\u062c \u0627\u0644\u0645\u0633\u0627\u0639\u062f\u0629 \u0641\u064a\u0647.",
    faqTitle: "\u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u0634\u0627\u0626\u0639\u0629",
    faqViewAllLabel: "\u0639\u0631\u0636 \u0643\u0644 \u0627\u0644\u0623\u0633\u0626\u0644\u0629",
    submitTicketTitle: "\u0625\u0631\u0633\u0627\u0644 \u062a\u0630\u0643\u0631\u0629",
    submitTicketSubtitle: "\u0623\u062e\u0628\u0631\u0646\u0627 \u0628\u0645\u0627 \u064a\u062d\u062f\u062b \u0648\u0633\u0646\u0639\u0627\u0648\u062f \u0625\u0644\u064a\u0643.",
    signInRequiredLabel: "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0645\u0637\u0644\u0648\u0628",
    signInRequiredDescription: "\u0633\u062c\u0651\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0644\u0625\u0631\u0633\u0627\u0644 \u062a\u0630\u0643\u0631\u0629 \u062a\u062e\u0635 \u062d\u0633\u0627\u0628\u0643 \u0623\u0648 \u062f\u0648\u0631\u0627\u062a\u0643 \u0623\u0648 \u0634\u0647\u0627\u062f\u0627\u062a\u0643 \u0623\u0648 \u0641\u0648\u062a\u0631\u062a\u0643.",
    signInLabel: "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644",
    categories: [
      { backendValue: "technical", label: "\u0645\u0634\u0643\u0644\u0629 \u062a\u0642\u0646\u064a\u0629", description: "\u0645\u0634\u0627\u0643\u0644 \u0627\u0644\u0641\u064a\u062f\u064a\u0648 \u0623\u0648 \u0627\u0644\u0635\u0648\u062a \u0623\u0648 \u0627\u0644\u0627\u0646\u0636\u0645\u0627\u0645 \u0644\u0644\u062c\u0644\u0633\u0627\u062a.", iconName: "Video", colorClass: "bg-red-50 text-red-600" },
      { backendValue: "login", label: "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0623\u0648 \u0627\u0644\u0648\u0635\u0648\u0644", description: "\u0646\u0633\u064a\u062a \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0623\u0648 \u062d\u0633\u0627\u0628 \u0645\u0642\u0641\u0644 \u0623\u0648 \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062a\u062d\u0642\u0642 \u0627\u0644\u062b\u0646\u0627\u0626\u064a.", iconName: "KeyRound", colorClass: "bg-amber-50 text-amber-600" },
      { backendValue: "billing", label: "\u0627\u0644\u0641\u0648\u062a\u0631\u0629 \u0623\u0648 \u0627\u0644\u062f\u0641\u0639", description: "\u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631 \u0623\u0648 \u0627\u0644\u0627\u0633\u062a\u0631\u062f\u0627\u062f \u0623\u0648 \u0627\u0644\u062f\u0641\u0639\u0627\u062a \u0627\u0644\u0641\u0627\u0634\u0644\u0629 \u0623\u0648 \u0623\u0633\u0626\u0644\u0629 \u0636\u0631\u064a\u0628\u0629 \u0627\u0644\u0642\u064a\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629.", iconName: "CreditCard", colorClass: "bg-emerald-50 text-emerald-600" },
      { backendValue: "certificate", label: "\u0627\u0644\u0634\u0647\u0627\u062f\u0627\u062a", description: "\u062a\u0646\u0632\u064a\u0644 \u0623\u0648 \u062a\u0635\u062d\u064a\u062d \u0627\u0644\u0627\u0633\u0645 \u0623\u0648 \u0627\u0644\u0625\u0628\u0644\u0627\u063a \u0625\u0644\u0649 Mumaris Plus.", iconName: "Award", colorClass: "bg-purple-50 text-purple-600" },
      { backendValue: "content", label: "\u0645\u062d\u062a\u0648\u0649 \u0627\u0644\u062f\u0648\u0631\u0629", description: "\u0645\u0634\u0627\u0643\u0644 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631\u0627\u062a \u0623\u0648 \u063a\u064a\u0627\u0628 \u0627\u0644\u0645\u0648\u0627\u062f \u0623\u0648 \u0623\u0633\u0626\u0644\u0629 \u062d\u0648\u0644 \u0627\u0644\u0645\u062d\u062a\u0648\u0649 \u0627\u0644\u062a\u0639\u0644\u064a\u0645\u064a.", iconName: "BookOpen", colorClass: "bg-blue-50 text-blue-600" },
      { backendValue: "other", label: "\u0645\u0634\u0643\u0644\u0629 \u062a\u0642\u0646\u064a\u0629 \u0623\u062e\u0631\u0649", description: "\u0623\u064a \u0634\u064a\u0621 \u0622\u062e\u0631 \u0644\u0627 \u064a\u0646\u062f\u0631\u062c \u0641\u064a \u0627\u0644\u0641\u0626\u0627\u062a \u0623\u0639\u0644\u0627\u0647.", iconName: "Wrench", colorClass: "bg-orange-50 text-orange-600" },
      { backendValue: "other", label: "\u0627\u0633\u062a\u0641\u0633\u0627\u0631 \u0639\u0627\u0645", description: "\u0627\u0644\u0634\u0631\u0627\u0643\u0627\u062a \u0623\u0648 \u0627\u0644\u0648\u0638\u0627\u0626\u0641 \u0623\u0648 \u0623\u064a \u0634\u064a\u0621 \u0622\u062e\u0631.", iconName: "HelpCircle", colorClass: "bg-gray-100 text-gray-600" }
    ],
    items: [
      { question: "\u0643\u0645 \u0633\u064a\u0633\u062a\u063a\u0631\u0642 \u0627\u0644\u0631\u062f\u061f", answer: "\u062e\u0644\u0627\u0644 \u0633\u0627\u0639\u0627\u062a \u0627\u0644\u0639\u0645\u0644 (\u0627\u0644\u0623\u062d\u062f-\u0627\u0644\u062e\u0645\u064a\u0633\u060c 9 \u0635\u0628\u0627\u062d\u064b\u0627 - 6 \u0645\u0633\u0627\u0621\u064b \u0628\u062a\u0648\u0642\u064a\u062a \u0627\u0644\u0645\u0645\u0644\u0643\u0629)\u060c \u062a\u062d\u0635\u0644 \u0645\u0639\u0638\u0645 \u0627\u0644\u062a\u0630\u0627\u0643\u0631 \u0639\u0644\u0649 \u0623\u0648\u0644 \u0631\u062f \u062e\u0644\u0627\u0644 30 \u062f\u0642\u064a\u0642\u0629. \u062e\u0627\u0631\u062c \u0633\u0627\u0639\u0627\u062a \u0627\u0644\u0639\u0645\u0644\u060c \u0646\u0631\u062f \u0641\u064a \u0628\u062f\u0627\u064a\u0629 \u064a\u0648\u0645 \u0627\u0644\u0639\u0645\u0644 \u0627\u0644\u062a\u0627\u0644\u064a." },
      { question: "\u0647\u0644 \u064a\u0645\u0643\u0646\u0646\u064a \u0625\u0631\u0633\u0627\u0644 \u062a\u0630\u0643\u0631\u0629 \u062f\u0648\u0646 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644\u061f", answer: "\u0646\u0639\u0645 \u2014 \u0641\u0642\u0637 \u0644\u0645\u0634\u0627\u0643\u0644 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0623\u0648 \u0627\u0644\u0648\u0635\u0648\u0644\u060c \u064a\u0645\u0643\u0646\u0643 \u0625\u0631\u0633\u0627\u0644 \u062a\u0630\u0643\u0631\u0629 \u0643\u0636\u064a\u0641. \u0644\u063a\u064a\u0631 \u0630\u0644\u0643 \u0633\u062a\u062d\u062a\u0627\u062c \u0625\u0644\u0649 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u062d\u062a\u0649 \u0646\u062a\u0645\u0643\u0646 \u0645\u0646 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u062d\u0633\u0627\u0628\u0643." },
      { question: "\u0643\u064a\u0641 \u064a\u0645\u0643\u0646\u0646\u064a \u062a\u062a\u0628\u0639 \u062a\u0630\u0643\u0631\u0629 \u0645\u0641\u062a\u0648\u062d\u0629\u061f", answer: "\u0625\u0630\u0627 \u0643\u0646\u062a \u0645\u0633\u062c\u0644 \u0627\u0644\u062f\u062e\u0648\u0644\u060c \u0627\u0646\u062a\u0642\u0644 \u0625\u0644\u0649 \u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0643\u0645 \u2192 \u0627\u0644\u062f\u0639\u0645 \u0644\u0639\u0631\u0636 \u0643\u0644 \u062a\u0630\u0627\u0643\u0631\u0643. \u062a\u0630\u0627\u0643\u0631 \u0627\u0644\u0636\u064a\u0641 \u062a\u0623\u062a\u064a \u0645\u0639 \u0631\u0627\u0628\u0637 \u062a\u062a\u0628\u0639 \u0641\u064a \u0628\u0631\u064a\u062f \u0627\u0644\u062a\u0623\u0643\u064a\u062f." },
      { question: "\u0645\u0627\u0630\u0627 \u0644\u0648 \u0627\u062d\u062a\u062c\u062a \u0625\u0636\u0627\u0641\u0629 \u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0628\u0639\u062f \u0627\u0644\u0625\u0631\u0633\u0627\u0644\u061f", answer: "\u064a\u0645\u0643\u0646\u0643 \u0627\u0644\u0631\u062f \u0639\u0644\u0649 \u062a\u0630\u0643\u0631\u062a\u0643 \u0645\u0646 \u0644\u0648\u062d\u0629 \u0627\u0644\u062f\u0639\u0645 \u0641\u064a \u0623\u064a \u0648\u0642\u062a. \u0643\u0644 \u0631\u062f \u062c\u062f\u064a\u062f \u064a\u0635\u0644 \u0625\u0644\u0649 \u0627\u0644\u0645\u0648\u0638\u0641 \u0627\u0644\u0645\u0633\u0624\u0648\u0644." },
      { question: "\u0647\u0644 \u0645\u062d\u0627\u062f\u062b\u0627\u062a\u064a \u062e\u0627\u0635\u0629\u061f", answer: "\u0646\u0639\u0645. \u0641\u0642\u0637 \u0623\u0646\u062a \u0648\u0627\u0644\u0645\u0648\u0638\u0641 \u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u0648\u0641\u0631\u064a\u0642 \u0627\u0644\u062f\u0639\u0645 \u0627\u0644\u0623\u0639\u0644\u0649 \u0631\u062a\u0628\u0629 \u064a\u0645\u0643\u0646\u0647\u0645 \u0631\u0624\u064a\u0629 \u062a\u0630\u0643\u0631\u062a\u0643. \u0627\u0644\u0645\u0644\u0627\u062d\u0638\u0627\u062a \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629 \u0628\u064a\u0646 \u0627\u0644\u0645\u0648\u0638\u0641\u064a\u0646 \u0644\u0627 \u062a\u0638\u0647\u0631 \u0644\u0643 \u0623\u0628\u062f\u064b\u0627." }
    ]
  }
};

// Navigation links data
const enNavbarLinks = [
  { label: "Home", url: "/en", hasDropdown: false },
  { label: "Courses", url: "/en/courses", hasDropdown: true },
  { label: "Become a Trainer", url: "/en/become-trainer", hasDropdown: false },
  { label: "Archive", url: "/en/archive", hasDropdown: false },
  { label: "Blogs", url: "/en/blogs", hasDropdown: false },
  { label: "About", url: "/en/about", hasDropdown: false }
];

const arNavbarLinks = [
  { label: "\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629", url: "/ar", hasDropdown: false },
  { label: "\u0627\u0644\u062f\u0648\u0631\u0627\u062a", url: "/ar/courses", hasDropdown: true },
  { label: "\u0643\u0646 \u0645\u062f\u0631\u0628\u064b\u0627", url: "/ar/become-trainer", hasDropdown: false },
  { label: "\u0627\u0644\u0623\u0631\u0634\u064a\u0641", url: "/ar/archive", hasDropdown: false },
  { label: "\u0627\u0644\u0645\u062f\u0648\u0646\u0627\u062a", url: "/ar/blogs", hasDropdown: false },
  { label: "\u0645\u0646 \u0646\u062d\u0646", url: "/ar/about", hasDropdown: false }
];

const enFooterPlatformLinks = [
  { label: "My Learning", url: "/en/learning" },
  { label: "Become a Trainer", url: "/en/become-trainer" },
  { label: "Courses", url: "/en/courses" },
  { label: "Archived", url: "/en/archive" },
  { label: "Certifications & CME", url: "/en/certifications" },
  { label: "Learning Policies", url: "/en/policies" }
];

const arFooterPlatformLinks = [
  { label: "\u062a\u0639\u0644\u064a\u0645\u064a", url: "/ar/learning" },
  { label: "\u0643\u0646 \u0645\u062f\u0631\u0628\u064b\u0627", url: "/ar/become-trainer" },
  { label: "\u0627\u0644\u062f\u0648\u0631\u0627\u062a", url: "/ar/courses" },
  { label: "\u0627\u0644\u0623\u0631\u0634\u064a\u0641", url: "/ar/archive" },
  { label: "\u0627\u0644\u0634\u0647\u0627\u062f\u0627\u062a \u0648\u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631", url: "/ar/certifications" },
  { label: "\u0633\u064a\u0627\u0633\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u0645", url: "/ar/policies" }
];

const enFooterOrganizationLinks = [
  { label: "About us", url: "/en/about" },
  { label: "NELC Alignment", url: "/en/nelc" },
  { label: "Academic Partners", url: "/en/partners" },
  { label: "Instructors & Faculty", url: "/en/instructors" },
  { label: "Terms & Conditions", url: "/en/terms" },
  { label: "Privacy Policy", url: "/en/privacy" }
];

const arFooterOrganizationLinks = [
  { label: "\u0645\u0646 \u0646\u062d\u0646", url: "/ar/about" },
  { label: "\u0627\u0644\u062a\u0648\u0627\u0641\u0642 \u0645\u0639 \u0627\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u0648\u0637\u0646\u064a", url: "/ar/nelc" },
  { label: "\u0627\u0644\u0634\u0631\u0643\u0627\u0621 \u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a\u0648\u0646", url: "/ar/partners" },
  { label: "\u0627\u0644\u0645\u062f\u0631\u0628\u0648\u0646 \u0648\u0623\u0639\u0636\u0627\u0621 \u0647\u064a\u0626\u0629 \u0627\u0644\u062a\u062f\u0631\u064a\u0633", url: "/ar/instructors" },
  { label: "\u0627\u0644\u0634\u0631\u0648\u0637 \u0648\u0627\u0644\u0623\u062d\u0643\u0627\u0645", url: "/ar/terms" },
  { label: "\u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u062e\u0635\u0648\u0635\u064a\u0629", url: "/ar/privacy" }
];

const enFooterSupportLinks = [
  { label: "Contact Us", url: "/en/contact" },
  { label: "Live Support", url: "/en/support" },
  { label: "Feedback", url: "/en/feedback" },
  { label: "FAQ", url: "/en/faq" }
];

const arFooterSupportLinks = [
  { label: "\u0627\u062a\u0635\u0644 \u0628\u0646\u0627", url: "/ar/contact" },
  { label: "\u0627\u0644\u062f\u0639\u0645 \u0627\u0644\u0645\u0628\u0627\u0634\u0631", url: "/ar/support" },
  { label: "\u0627\u0644\u0645\u0644\u0627\u062d\u0638\u0627\u062a", url: "/ar/feedback" },
  { label: "\u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u0634\u0627\u0626\u0639\u0629", url: "/ar/faq" }
];

// Partner names
const enPartners = [
  "National eLearning Center",
  "ISO 9001",
  "Governance Academy",
  "IBTA MEA",
  "SCFHS"
];

const arPartners = [
  "\u0627\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u0648\u0637\u0646\u064a \u0644\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a",
  "ISO 9001",
  "Governance Academy",
  "IBTA MEA",
  "\u0627\u0644\u0647\u064a\u0626\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0644\u0644\u062a\u062e\u0635\u0635\u0627\u062a \u0627\u0644\u0635\u062d\u064a\u0629"
];

// Arabic instructors
const arInstructors = [
  { name: "\u062f. \u0639\u0628\u062f\u0627\u0644\u0644\u0647 \u0627\u0644\u062d\u0631\u0628\u064a", title: "\u0627\u0633\u062a\u0634\u0627\u0631\u064a\u060c \u062c\u0631\u0627\u062d\u0629 \u0627\u0644\u0639\u0638\u0627\u0645", section: "expert" },
  { name: "\u062f. \u0633\u0627\u0631\u0629 \u0627\u0644\u062c\u0627\u0633\u0631", title: "\u0627\u0633\u062a\u0634\u0627\u0631\u064a\u0629\u060c \u0637\u0628 \u0627\u0644\u0631\u0648\u0645\u0627\u062a\u064a\u0632\u0645 \u0644\u0644\u0623\u0637\u0641\u0627\u0644", section: "expert" },
  { name: "\u062f. \u0646\u0648\u0631\u0629 \u0627\u0644\u0639\u0645\u0631\u064a", title: "\u0627\u0633\u062a\u0634\u0627\u0631\u064a\u0629\u060c \u0637\u0628 \u0627\u0644\u0623\u0633\u0631\u0629 \u0648\u0635\u062d\u0629 \u0627\u0644\u0645\u062c\u062a\u0645\u0639", section: "expert" },
  { name: "\u062f. \u0641\u064a\u0635\u0644 \u0627\u0644\u0639\u062a\u064a\u0628\u064a", title: "\u0645\u062f\u064a\u0646\u0629 \u0627\u0644\u0623\u0645\u064a\u0631 \u0633\u0644\u0637\u0627\u0646 \u0627\u0644\u0637\u0628\u064a\u0629 \u0627\u0644\u0639\u0633\u0643\u0631\u064a\u0629\u060c \u0627\u0644\u0631\u064a\u0627\u0636", section: "minds" },
  { name: "\u062f. \u0645\u062d\u0645\u062f \u0627\u0644\u063a\u0627\u0645\u062f\u064a", title: "\u0623\u0633\u062a\u0627\u0630 \u0645\u0633\u0627\u0639\u062f \u0648\u0627\u0633\u062a\u0634\u0627\u0631\u064a\u060c \u0637\u0628 \u0627\u0644\u0637\u0648\u0627\u0631\u0626", section: "minds" },
  { name: "\u062f. \u064a\u0627\u0633\u0631 \u0627\u0644\u0642\u062d\u0637\u0627\u0646\u064a", title: "\u0645\u0633\u062c\u0644 \u0623\u0648\u0644\u060c \u0627\u0644\u0637\u0628 \u0627\u0644\u0628\u0627\u0637\u0646\u064a", section: "minds" },
  { name: "\u062f. \u0639\u0645\u0631 \u0627\u0644\u0634\u0647\u0631\u064a", title: "\u0627\u0633\u062a\u0634\u0627\u0631\u064a\u060c \u0637\u0628 \u0627\u0644\u0623\u0639\u0635\u0627\u0628", section: "minds" }
];

async function apiRequest(endpoint, method = 'GET', data = null) {
  const url = `${STRAPI_URL}/api${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${STRAPI_API_TOKEN}`
    }
  };

  if (data) {
    options.body = JSON.stringify({ data });
  }

  const response = await fetch(url, options);

  // Handle empty responses (e.g. 204 No Content from DELETE)
  const text = await response.text();
  let result;
  try {
    result = text ? JSON.parse(text) : { data: null };
  } catch {
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} - ${text}`);
    }
    return { data: null };
  }

  if (!response.ok) {
    console.error(`API Error for ${endpoint}:`, result);
    throw new Error(`API request failed: ${response.status}`);
  }

  return result;
}

/**
 * Publish a single type entry for a given locale.
 * Strapi v5: POST /api/{singularApiId}/actions/publish
 */
async function publishSingleType(endpoint, locale, label) {
  try {
    await apiRequest(`${endpoint}/actions/publish?locale=${locale}`, 'POST');
    console.log(`  Published ${label} (${locale})`);
  } catch (error) {
    console.error(`  Failed to publish ${label} (${locale}):`, error.message);
  }
}

/**
 * Publish a collection type entry by documentId.
 * Strapi v5: POST /api/{pluralApiId}/{documentId}/actions/publish
 */
async function publishEntry(endpoint, documentId, label) {
  try {
    await apiRequest(`${endpoint}/${documentId}/actions/publish`, 'POST');
  } catch (error) {
    console.error(`  Failed to publish ${label} (${documentId}):`, error.message);
  }
}

/**
 * Seed a single type entry with proper i18n support.
 * Strapi v5 single types use PUT to both create and update (POST is not supported).
 */
async function seedSingleType(endpoint, locale, data, label) {
  console.log(`\nSeeding ${label} (${locale})...`);

  try {
    await apiRequest(`${endpoint}?locale=${locale}`, 'PUT', data);
    console.log(`  Saved ${label} (${locale})`);
    // Auto-publish after seeding
    await publishSingleType(endpoint, locale, label);
  } catch (error) {
    console.error(`  Failed to seed ${label} (${locale}):`, error.message);
  }
}

async function seedHomePage(locale, content) {
  const homePageData = {
    heroTitle: content.hero.title,
    heroTitleLine2: content.hero.titleLine2,
    heroTitleMobile: content.hero.titleMobile,
    heroDescription: content.hero.description,
    heroButton1Label: content.hero.exploreButton,
    heroButton2Label: content.hero.getStartedButton,
    partnersSectionTitle: content.partners.title,
    featuredCoursesTitle: content.featuredCourses.title,
    featuredCoursesDescription: content.featuredCourses.description,
    featuredCoursesViewAllLabel: content.featuredCourses.viewAllButton,
    becomeTrainerTitle: content.becomeTrainer.title,
    becomeTrainerDescription: content.becomeTrainer.description,
    becomeTrainerButtonLabel: content.becomeTrainer.getStartedButton,
    instructorsTitle: content.expertInstructors.title,
    instructorsDescription: content.expertInstructors.description,
    testimonialsTitle: content.testimonials.title,
    testimonialsDescription: content.testimonials.description,
    ctaTitle: content.cta.title,
    ctaDescription: content.cta.description,
    ctaButtonLabel: content.cta.continueButton,
  };

  await seedSingleType('/home-page', locale, homePageData, 'home page');
}

async function seedAboutPage(locale, content) {
  const aboutPageData = {
    heroTitle: content.aboutPage.heroTitle,
    heroDescription: content.aboutPage.heroDescription,
    heroExploreButtonLabel: content.aboutPage.heroExploreButtonLabel,
    heroGetStartedButtonLabel: content.aboutPage.heroGetStartedButtonLabel,
    complianceTitle: content.aboutPage.complianceTitle,
    complianceItem1: content.aboutPage.complianceItem1,
    complianceItem2: content.aboutPage.complianceItem2,
    complianceItem3: content.aboutPage.complianceItem3,
    complianceItem4: content.aboutPage.complianceItem4,
    complianceButtonLabel: content.aboutPage.complianceButtonLabel,
    learningTitle: content.aboutPage.learningTitle,
    learningSubtitle: content.aboutPage.learningSubtitle,
    learningCard1Title: content.aboutPage.learningCard1Title,
    learningCard2Title: content.aboutPage.learningCard2Title,
    learningCard3Title: content.aboutPage.learningCard3Title,
    learningReadMoreLabel: content.aboutPage.learningReadMoreLabel,
    capabilitiesTitle: content.aboutPage.capabilitiesTitle,
    capabilitiesSubtitle: content.aboutPage.capabilitiesSubtitle,
    feature1Title: content.aboutPage.feature1Title,
    feature1Description: content.aboutPage.feature1Description,
    feature2Title: content.aboutPage.feature2Title,
    feature2Description: content.aboutPage.feature2Description,
    feature3Title: content.aboutPage.feature3Title,
    feature3Description: content.aboutPage.feature3Description,
    feature4Title: content.aboutPage.feature4Title,
    feature4Description: content.aboutPage.feature4Description,
    feature5Title: content.aboutPage.feature5Title,
    feature5Description: content.aboutPage.feature5Description,
    feature6Title: content.aboutPage.feature6Title,
    feature6Description: content.aboutPage.feature6Description,
  };

  await seedSingleType('/about-page', locale, aboutPageData, 'about page');
}

async function seedBecomeTrainerPage(locale, content) {
  const becomeTrainerPageData = {
    pageTitle: content.becomeTrainerPage.pageTitle,
    profileSectionTitle: content.becomeTrainerPage.profileSectionTitle,
    profilePhotoLabel: content.becomeTrainerPage.profilePhotoLabel,
    profileAttachCVLabel: content.becomeTrainerPage.profileAttachCVLabel,
    profileFullNameLabel: content.becomeTrainerPage.profileFullNameLabel,
    profileFullNameArabicPlaceholder: content.becomeTrainerPage.profileFullNameArabicPlaceholder,
    profileFullNameEnglishPlaceholder: content.becomeTrainerPage.profileFullNameEnglishPlaceholder,
    profileEmailLabel: content.becomeTrainerPage.profileEmailLabel,
    profileMobileLabel: content.becomeTrainerPage.profileMobileLabel,
    profileGenderLabel: content.becomeTrainerPage.profileGenderLabel,
    profileNationalityLabel: content.becomeTrainerPage.profileNationalityLabel,
    profileNationalIdLabel: content.becomeTrainerPage.profileNationalIdLabel,
    profileProfessionLabel: content.becomeTrainerPage.profileProfessionLabel,
    profileSpecialityLabel: content.becomeTrainerPage.profileSpecialityLabel,
    profileQualificationLabel: content.becomeTrainerPage.profileQualificationLabel,
    profileRankLabel: content.becomeTrainerPage.profileRankLabel,
    profileScfhsQuestion: content.becomeTrainerPage.profileScfhsQuestion,
    profileTwitterLabel: content.becomeTrainerPage.profileTwitterLabel,
    profileLinkedInLabel: content.becomeTrainerPage.profileLinkedInLabel,
    resumeSectionTitle: content.becomeTrainerPage.resumeSectionTitle,
    resumeDescription: content.becomeTrainerPage.resumeDescription,
    resumeUploadLabel: content.becomeTrainerPage.resumeUploadLabel,
    resumeCreateLabel: content.becomeTrainerPage.resumeCreateLabel,
    resumeEducationLabel: content.becomeTrainerPage.resumeEducationLabel,
    resumeProfessionalSkillsLabel: content.becomeTrainerPage.resumeProfessionalSkillsLabel,
    resumeScientificResearchesLabel: content.becomeTrainerPage.resumeScientificResearchesLabel,
    resumeTrainingExperienceLabel: content.becomeTrainerPage.resumeTrainingExperienceLabel,
    resumeClickToUploadLabel: content.becomeTrainerPage.resumeClickToUploadLabel,
    resumeOrDragDropLabel: content.becomeTrainerPage.resumeOrDragDropLabel,
    resumePdfMaxSizeLabel: content.becomeTrainerPage.resumePdfMaxSizeLabel,
    bankAccountSectionTitle: content.becomeTrainerPage.bankAccountSectionTitle,
    bankAccountHolderLabel: content.becomeTrainerPage.bankAccountHolderLabel,
    bankNameLabel: content.becomeTrainerPage.bankNameLabel,
    bankIbanLabel: content.becomeTrainerPage.bankIbanLabel,
    cancelButtonLabel: content.becomeTrainerPage.cancelButtonLabel,
    saveButtonLabel: content.becomeTrainerPage.saveButtonLabel,
    yesButtonLabel: content.becomeTrainerPage.yesButtonLabel,
    noButtonLabel: content.becomeTrainerPage.noButtonLabel,
  };

  await seedSingleType('/become-trainer-page', locale, becomeTrainerPageData, 'become trainer page');
}

async function seedPrivacyPolicyPage(locale, content) {
  const policyData = {
    title: content.privacyPolicyPage.title,
    lastUpdated: content.privacyPolicyPage.lastUpdated,
    sections: content.privacyPolicyPage.sections,
  };

  await seedSingleType('/privacy-policy-page', locale, policyData, 'privacy policy page');
}

async function seedTermsPage(locale, content) {
  const termsData = {
    title: content.termsPage.title,
    lastUpdated: content.termsPage.lastUpdated,
    sections: content.termsPage.sections,
  };

  await seedSingleType('/terms-page', locale, termsData, 'terms page');
}

async function seedLearningPoliciesPage(locale, content) {
  const policiesData = {
    title: content.learningPoliciesPage.title,
    lastUpdated: content.learningPoliciesPage.lastUpdated,
    sections: content.learningPoliciesPage.sections,
  };

  await seedSingleType('/learning-policies-page', locale, policiesData, 'learning policies page');
}

async function seedContactPage(locale, content) {
  const data = { ...content.contactPage };
  await seedSingleType('/contact-page', locale, data, 'contact page');
}

async function seedFeedbackPage(locale, content) {
  const data = { ...content.feedbackPage };
  await seedSingleType('/feedback-page', locale, data, 'feedback page');
}

async function seedCertificationsPage(locale, content) {
  const data = { ...content.certificationsPage };
  await seedSingleType('/certifications-page', locale, data, 'certifications page');
}

async function seedNELCPage(locale, content) {
  const data = { ...content.nelcPage };
  await seedSingleType('/nelc-page', locale, data, 'NELC page');
}

async function seedPartnersPage(locale, content) {
  const data = { ...content.partnersPage };
  await seedSingleType('/partners-page', locale, data, 'partners page');
}

async function seedInstructorsPage(locale, content) {
  const data = { ...content.instructorsPage };
  await seedSingleType('/instructors-page', locale, data, 'instructors page');
}

async function seedFAQPage(locale, content) {
  const data = {
    title: content.faqPage.title,
    subtitle: content.faqPage.subtitle,
    getInTouchLabel: content.faqPage.getInTouchLabel,
    items: content.faqPage.items,
  };
  await seedSingleType('/faq-page', locale, data, 'FAQ page');
}

async function seedSupportPage(locale, content) {
  const sp = content.supportPage;
  if (!sp) {
    console.log(`  ⚠ No supportPage content for locale=${locale}, skipping.`);
    return;
  }
  const data = {
    title: sp.title,
    subtitle: sp.subtitle,
    categoriesTitle: sp.categoriesTitle,
    categoriesSubtitle: sp.categoriesSubtitle,
    categories: sp.categories,
    faqTitle: sp.faqTitle,
    faqViewAllLabel: sp.faqViewAllLabel,
    items: sp.items,
    submitTicketTitle: sp.submitTicketTitle,
    submitTicketSubtitle: sp.submitTicketSubtitle,
    signInRequiredLabel: sp.signInRequiredLabel,
    signInRequiredDescription: sp.signInRequiredDescription,
    signInLabel: sp.signInLabel,
  };
  await seedSingleType('/support-page', locale, data, 'support page');
}

async function seedSiteSettings(locale, content) {
  const siteSettingsData = {
    siteName: 'PhysioGuidance',
    footerDescription: content.footer.companyDescription,
    copyrightText: content.footer.copyright,
    footerPlatformTitle: content.footer.platform,
    footerOrganizationTitle: content.footer.organization,
    footerSupportTitle: content.footer.support,
  };

  await seedSingleType('/site-setting', locale, siteSettingsData, 'site settings');
}

/**
 * Delete all entries from a collection type (for cleanup before re-seeding).
 * Queries every locale + status combination and paginates to catch everything.
 */
async function deleteAllEntries(endpoint, label) {
  console.log(`\nCleaning up ${label}...`);
  const documentIds = new Set();

  for (const locale of ['en', 'ar']) {
    for (const status of ['published', 'draft']) {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        try {
          const result = await apiRequest(
            `${endpoint}?locale=${locale}&status=${status}&pagination[page]=${page}&pagination[pageSize]=100`
          );
          const entries = result.data || [];
          for (const entry of entries) {
            if (entry.documentId) documentIds.add(entry.documentId);
          }
          hasMore = entries.length === 100;
          page++;
        } catch {
          hasMore = false;
        }
      }
    }
  }

  if (documentIds.size === 0) {
    console.log(`  No existing ${label} to delete`);
    return;
  }

  let deleted = 0;
  for (const docId of documentIds) {
    try {
      await apiRequest(`${endpoint}/${docId}`, 'DELETE');
      deleted++;
    } catch {
      // already deleted (shared documentId across locales)
    }
  }
  console.log(`  Deleted ${deleted} ${label} documents`);
}

async function seedFeaturedCourses(locale, courses, labels) {
  console.log(`\nSeeding featured courses (${locale})...`);

  for (let i = 0; i < courses.length; i++) {
    const course = courses[i];
    const courseData = {
      title: course.title,
      description: course.description,
      date: course.date,
      hours: course.hours,
      price: course.price,
      slug: course.slug,
      courseType: course.courseType,
      order: i + 1,
      isActive: true,
      cmeHoursLabel: labels.cmeHours,
      viewDetailsLabel: labels.viewDetails,
    };

    try {
      const result = await apiRequest(`/featured-courses?locale=${locale}`, 'POST', courseData);
      console.log(`  Created course: ${course.title}`);
      if (result?.data?.documentId) {
        await publishEntry('/featured-courses', result.data.documentId, course.title);
      }
    } catch (error) {
      console.error(`  Failed to create course ${course.title}:`, error.message);
    }
  }
}

async function seedTestimonials(locale, testimonials) {
  console.log(`\nSeeding testimonials (${locale})...`);

  for (let i = 0; i < testimonials.length; i++) {
    const testimonial = testimonials[i];
    const testimonialData = {
      quote: testimonial.quote,
      authorName: testimonial.authorName,
      authorRole: testimonial.authorRole,
      order: i + 1,
      isActive: true,
    };

    try {
      const result = await apiRequest(`/testimonials?locale=${locale}`, 'POST', testimonialData);
      console.log(`  Created testimonial from: ${testimonial.authorName}`);
      if (result?.data?.documentId) {
        await publishEntry('/testimonials', result.data.documentId, testimonial.authorName);
      }
    } catch (error) {
      console.error(`  Failed to create testimonial from ${testimonial.authorName}:`, error.message);
    }
  }
}

async function seedInstructors(locale, instructors) {
  console.log(`\nSeeding instructors (${locale})...`);

  for (let i = 0; i < instructors.length; i++) {
    const instructor = instructors[i];
    const instructorData = {
      name: instructor.name,
      title: instructor.title,
      section: instructor.section || 'expert',
      order: i + 1,
      showOnHomepage: true,
    };

    try {
      const result = await apiRequest(`/instructors?locale=${locale}`, 'POST', instructorData);
      console.log(`  Created instructor: ${instructor.name}`);
      if (result?.data?.documentId) {
        await publishEntry('/instructors', result.data.documentId, instructor.name);
      }
    } catch (error) {
      console.error(`  Failed to create instructor ${instructor.name}:`, error.message);
    }
  }
}

async function seedNavigationLinks(locale, links, location) {
  console.log(`\nSeeding navigation links - ${location} (${locale})...`);

  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const linkData = {
      label: link.label,
      url: link.url,
      location,
      order: i + 1,
      isActive: true,
      hasDropdown: link.hasDropdown || false,
      openInNewTab: false,
    };

    try {
      const result = await apiRequest(`/navigation-links?locale=${locale}`, 'POST', linkData);
      console.log(`  Created link: ${link.label}`);
      if (result?.data?.documentId) {
        await publishEntry('/navigation-links', result.data.documentId, link.label);
      }
    } catch (error) {
      console.error(`  Failed to create link ${link.label}:`, error.message);
    }
  }
}

async function seedPartners(locale, partnerNames) {
  console.log(`\nSeeding partners (${locale})...`);

  for (let i = 0; i < partnerNames.length; i++) {
    const partnerData = {
      name: partnerNames[i],
      order: i + 1,
      isActive: true,
    };

    try {
      const result = await apiRequest(`/partners?locale=${locale}`, 'POST', partnerData);
      console.log(`  Created partner: ${partnerNames[i]}`);
      if (result?.data?.documentId) {
        await publishEntry('/partners', result.data.documentId, partnerNames[i]);
      }
    } catch (error) {
      console.error(`  Failed to create partner ${partnerNames[i]}:`, error.message);
    }
  }
}

// Blog categories
const enBlogCategories = [
  { title: "Digital Health", slug: "digital-health" },
  { title: "Training", slug: "training" },
  { title: "Medical", slug: "medical" },
  { title: "Research", slug: "research" },
];

const arBlogCategories = [
  { title: "\u0627\u0644\u0635\u062d\u0629 \u0627\u0644\u0631\u0642\u0645\u064a\u0629", slug: "digital-health" },
  { title: "\u0627\u0644\u062a\u062f\u0631\u064a\u0628", slug: "training" },
  { title: "\u0637\u0628\u064a", slug: "medical" },
  { title: "\u0627\u0644\u0628\u062d\u062b", slug: "research" },
];

// Blog posts (EN)
const enBlogPosts = [
  {
    title: "The Future of Digital Health in Saudi Arabia",
    slug: "future-digital-health-saudi-arabia",
    excerpt: "Exploring how digital transformation is reshaping healthcare delivery and education across the Kingdom of Saudi Arabia.",
    content: "## Introduction\n\nThe healthcare landscape in Saudi Arabia is undergoing a profound transformation driven by Vision 2030 and the rapid adoption of digital technologies. From telemedicine platforms to AI-powered diagnostics, the Kingdom is positioning itself as a regional leader in digital health innovation.\n\n## The Current State of Digital Health\n\nSaudi Arabia has made significant strides in implementing digital health solutions across its healthcare system. The Ministry of Health's e-health strategy has laid the groundwork for a connected healthcare ecosystem that benefits both providers and patients.\n\nKey developments include:\n\n- Implementation of electronic health records (EHR) across major hospitals\n- Launch of telemedicine services reaching remote areas\n- Integration of AI tools for early disease detection\n- Digital platforms for continuing medical education\n\n## Impact on Healthcare Education\n\nDigital transformation is not limited to clinical settings. Healthcare education is being revolutionized through:\n\n- **E-learning platforms** that provide NELC-compliant training\n- **Virtual simulation** environments for clinical practice\n- **Mobile learning** applications for on-the-go education\n- **Data analytics** for tracking learner outcomes\n\n## Looking Ahead\n\nAs Saudi Arabia continues to invest in digital health infrastructure, the opportunities for healthcare professionals to enhance their skills through technology-enabled learning will only grow. The convergence of AI, big data, and personalized medicine will create new demands for specialized training programs.\n\n> The future of healthcare in Saudi Arabia is digital, and the professionals who embrace continuous learning will be at the forefront of this transformation.\n\n## Conclusion\n\nDigital health represents a paradigm shift in how healthcare is delivered and how healthcare professionals are trained. By embracing these innovations, Saudi Arabia is building a healthier, more connected future for its citizens.",
    readTimeMinutes: 8,
    featured: true,
    publishedDate: "2026-01-15",
    authorName: "Dr. Abdullah Al-Harbi",
    tags: ["digital health", "Saudi Arabia", "Vision 2030", "e-learning"],
    categorySlug: "digital-health"
  },
  {
    title: "Best Practices for CME Compliance in Healthcare",
    slug: "cme-compliance-best-practices",
    excerpt: "A comprehensive guide to understanding and maintaining Continuing Medical Education compliance for healthcare professionals in the Kingdom.",
    content: "## Understanding CME Requirements\n\nContinuing Medical Education (CME) is a critical component of professional development for healthcare practitioners in Saudi Arabia. The Saudi Commission for Health Specialties (SCFHS) mandates specific CME requirements to ensure that healthcare professionals maintain their competency.\n\n## Key Compliance Standards\n\nHealthcare professionals must adhere to several standards:\n\n- Complete a minimum number of CME hours annually\n- Participate in accredited programs only\n- Document all learning activities\n- Pass assessment requirements with a minimum score of 70%\n\n## How to Stay Compliant\n\n### 1. Plan Your Learning\n\nCreate an annual learning plan that aligns with your specialty requirements and career goals.\n\n### 2. Choose Accredited Programs\n\nEnsure all training programs you enroll in are accredited by SCFHS and comply with NELC standards.\n\n### 3. Track Your Hours\n\nMaintain accurate records of all CME activities through the Mumaris Plus platform.\n\n### 4. Engage Actively\n\nActive participation in courses, including completing assessments and providing feedback, enhances both compliance and learning outcomes.\n\n## Conclusion\n\nCME compliance is not just a regulatory requirement; it is an investment in professional excellence and patient safety.",
    readTimeMinutes: 6,
    featured: false,
    publishedDate: "2026-01-10",
    authorName: "Dr. Sarah Al-Jasser",
    tags: ["CME", "compliance", "SCFHS", "healthcare education"],
    categorySlug: "training"
  },
  {
    title: "Advances in Infection Control Training",
    slug: "advances-infection-control-training",
    excerpt: "How modern training approaches are improving infection prevention and control practices in healthcare facilities.",
    content: "## The Importance of Infection Control\n\nInfection prevention and control (IPC) remains a cornerstone of patient safety. With emerging infectious diseases and antimicrobial resistance, healthcare professionals must stay updated on the latest IPC protocols.\n\n## Modern Training Approaches\n\n### Simulation-Based Learning\n\nVirtual and physical simulation environments allow healthcare workers to practice IPC procedures in realistic settings without risk to patients.\n\n### Microlearning Modules\n\nShort, focused training modules delivered through digital platforms enable busy healthcare professionals to stay current with IPC best practices.\n\n### Competency-Based Assessment\n\nModern IPC training programs focus on demonstrating practical competency rather than just theoretical knowledge.\n\n## Key Focus Areas\n\n- Hand hygiene compliance and monitoring\n- Personal protective equipment (PPE) usage\n- Environmental cleaning and disinfection\n- Antimicrobial stewardship\n- Outbreak investigation and management\n\n## The Role of Technology\n\nDigital tools are revolutionizing IPC training:\n\n- **Real-time monitoring** systems track hand hygiene compliance\n- **AI-powered analytics** identify infection patterns\n- **Mobile apps** provide instant access to IPC guidelines\n\n## Conclusion\n\nInvesting in modern infection control training is essential for maintaining high standards of patient safety and healthcare quality.",
    readTimeMinutes: 7,
    featured: false,
    publishedDate: "2026-01-05",
    authorName: "Dr. Nourah Al-Amri",
    tags: ["infection control", "patient safety", "training", "IPC"],
    categorySlug: "medical"
  },
  {
    title: "Evidence-Based Medicine: Bridging Research and Practice",
    slug: "evidence-based-medicine-bridging-research-practice",
    excerpt: "Understanding how evidence-based medicine principles can be effectively integrated into daily clinical practice and healthcare education.",
    content: "## What is Evidence-Based Medicine?\n\nEvidence-Based Medicine (EBM) is the conscientious, explicit, and judicious use of current best evidence in making decisions about the care of individual patients. It integrates clinical expertise with the best available research evidence and patient values.\n\n## The Three Pillars of EBM\n\n1. **Best Research Evidence**: Systematic reviews, meta-analyses, and randomized controlled trials\n2. **Clinical Expertise**: The clinician's accumulated experience and skills\n3. **Patient Values**: Individual patient preferences, concerns, and expectations\n\n## Implementing EBM in Practice\n\n### Ask Answerable Questions\n\nFormulate clinical questions using the PICO framework:\n- **P**atient/Population\n- **I**ntervention\n- **C**omparison\n- **O**utcome\n\n### Search for Evidence\n\nUtilize databases such as PubMed, Cochrane Library, and UpToDate to find relevant studies.\n\n### Appraise the Evidence\n\nCritically evaluate the validity, impact, and applicability of the evidence.\n\n### Apply the Evidence\n\nIntegrate findings with clinical expertise and patient preferences.\n\n## Challenges and Solutions\n\n- **Time constraints**: Use pre-appraised evidence sources\n- **Access barriers**: Leverage institutional subscriptions and open-access journals\n- **Knowledge gaps**: Participate in EBM training programs\n\n## Conclusion\n\nEBM is not about replacing clinical judgment but enhancing it with the best available evidence. Healthcare professionals who embrace EBM contribute to better patient outcomes.",
    readTimeMinutes: 9,
    featured: false,
    publishedDate: "2025-12-28",
    authorName: "Dr. Faisal Al-Otaibi",
    tags: ["evidence-based medicine", "research", "clinical practice"],
    categorySlug: "research"
  },
  {
    title: "The Role of Simulation in Healthcare Training",
    slug: "role-simulation-healthcare-training",
    excerpt: "How simulation-based education is transforming healthcare training and improving patient outcomes through hands-on practice.",
    content: "## Introduction to Healthcare Simulation\n\nSimulation-based education has emerged as a powerful tool in healthcare training, providing a safe environment for learners to develop and refine their clinical skills without putting patients at risk.\n\n## Types of Healthcare Simulation\n\n### Task Trainers\n\nPhysical models designed for practicing specific procedures such as:\n- IV insertion\n- Intubation\n- Suturing\n\n### Standardized Patients\n\nTrained actors who portray patients with specific conditions, allowing learners to practice communication and clinical assessment skills.\n\n### High-Fidelity Manikins\n\nAdvanced patient simulators that can replicate vital signs, physiological responses, and clinical scenarios.\n\n### Virtual Reality (VR)\n\nImmersive digital environments for practicing surgical procedures, emergency responses, and clinical decision-making.\n\n## Benefits of Simulation Training\n\n- **Patient Safety**: Learn from mistakes without patient harm\n- **Skill Repetition**: Practice procedures as many times as needed\n- **Teamwork**: Develop interprofessional collaboration skills\n- **Confidence**: Build competence before real clinical encounters\n- **Assessment**: Standardized evaluation of clinical competency\n\n## Integration with E-Learning\n\nModern healthcare education combines simulation with digital learning platforms to create comprehensive training programs that meet NELC standards.\n\n## Conclusion\n\nSimulation is an indispensable component of modern healthcare education, and its integration with digital platforms creates powerful learning experiences.",
    readTimeMinutes: 7,
    featured: false,
    publishedDate: "2025-12-20",
    authorName: "Dr. Mohammed Al-Ghamdi",
    tags: ["simulation", "healthcare training", "patient safety", "VR"],
    categorySlug: "training"
  },
  {
    title: "Patient Safety Culture in Saudi Healthcare",
    slug: "patient-safety-culture-saudi-healthcare",
    excerpt: "Building and sustaining a culture of patient safety across healthcare organizations in the Kingdom of Saudi Arabia.",
    content: "## Understanding Patient Safety Culture\n\nPatient safety culture refers to the shared values, beliefs, and behavioral norms in a healthcare organization that influence staff members' actions and attitudes toward patient safety.\n\n## Key Elements\n\n### Leadership Commitment\n\nSenior leaders must demonstrate visible commitment to patient safety through:\n- Allocating resources for safety initiatives\n- Establishing clear safety policies\n- Leading by example\n\n### Open Communication\n\nA culture where staff feel comfortable reporting errors and near-misses without fear of punitive action.\n\n### Continuous Learning\n\nOrganizations must foster an environment of continuous improvement through:\n- Regular training and education\n- Root cause analysis of incidents\n- Sharing lessons learned across departments\n\n## Measuring Safety Culture\n\nTools such as the Hospital Survey on Patient Safety Culture (HSOPSC) help organizations assess and benchmark their safety culture.\n\n## Strategies for Improvement\n\n- Implement a just culture framework\n- Establish patient safety committees\n- Conduct regular safety rounds\n- Provide ongoing education and training\n- Engage patients in their own safety\n\n## The Saudi Context\n\nSaudi Arabia's healthcare transformation under Vision 2030 places a strong emphasis on patient safety, with regulatory bodies like CBAHI setting standards for healthcare quality.\n\n## Conclusion\n\nBuilding a strong patient safety culture requires sustained effort, leadership commitment, and continuous education.",
    readTimeMinutes: 8,
    featured: false,
    publishedDate: "2025-12-15",
    authorName: "Dr. Yasser Al-Qahtani",
    tags: ["patient safety", "healthcare culture", "Saudi Arabia", "quality"],
    categorySlug: "medical"
  }
];

// Blog posts (AR)
const arBlogPosts = [
  {
    title: "\u0645\u0633\u062a\u0642\u0628\u0644 \u0627\u0644\u0635\u062d\u0629 \u0627\u0644\u0631\u0642\u0645\u064a\u0629 \u0641\u064a \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629",
    slug: "future-digital-health-saudi-arabia",
    excerpt: "\u0627\u0633\u062a\u0643\u0634\u0627\u0641 \u0643\u064a\u0641 \u064a\u0639\u064a\u062f \u0627\u0644\u062a\u062d\u0648\u0644 \u0627\u0644\u0631\u0642\u0645\u064a \u062a\u0634\u0643\u064a\u0644 \u062a\u0642\u062f\u064a\u0645 \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629 \u0648\u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0641\u064a \u062c\u0645\u064a\u0639 \u0623\u0646\u062d\u0627\u0621 \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629.",
    content: "## \u0645\u0642\u062f\u0645\u0629\n\n\u064a\u0634\u0647\u062f \u0627\u0644\u0645\u0634\u0647\u062f \u0627\u0644\u0635\u062d\u064a \u0641\u064a \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u062a\u062d\u0648\u0644\u0627\u064b \u0639\u0645\u064a\u0642\u0627\u064b \u0628\u0641\u0636\u0644 \u0631\u0624\u064a\u0629 2030 \u0648\u0627\u0644\u062a\u0628\u0646\u064a \u0627\u0644\u0633\u0631\u064a\u0639 \u0644\u0644\u062a\u0642\u0646\u064a\u0627\u062a \u0627\u0644\u0631\u0642\u0645\u064a\u0629.\n\n## \u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u062d\u0627\u0644\u064a \u0644\u0644\u0635\u062d\u0629 \u0627\u0644\u0631\u0642\u0645\u064a\u0629\n\n\u062d\u0642\u0642\u062a \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u062a\u0642\u062f\u0645\u0627\u064b \u0643\u0628\u064a\u0631\u0627\u064b \u0641\u064a \u062a\u0646\u0641\u064a\u0630 \u062d\u0644\u0648\u0644 \u0627\u0644\u0635\u062d\u0629 \u0627\u0644\u0631\u0642\u0645\u064a\u0629.\n\n- \u062a\u0637\u0628\u064a\u0642 \u0627\u0644\u0633\u062c\u0644\u0627\u062a \u0627\u0644\u0635\u062d\u064a\u0629 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a\u0629\n- \u0625\u0637\u0644\u0627\u0642 \u062e\u062f\u0645\u0627\u062a \u0627\u0644\u0637\u0628 \u0639\u0646 \u0628\u0639\u062f\n- \u062f\u0645\u062c \u0623\u062f\u0648\u0627\u062a \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a\n- \u0645\u0646\u0635\u0627\u062a \u0631\u0642\u0645\u064a\u0629 \u0644\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631\n\n## \u0627\u0644\u062e\u0627\u062a\u0645\u0629\n\n\u062a\u0645\u062b\u0644 \u0627\u0644\u0635\u062d\u0629 \u0627\u0644\u0631\u0642\u0645\u064a\u0629 \u062a\u062d\u0648\u0644\u0627\u064b \u062c\u0630\u0631\u064a\u0627\u064b \u0641\u064a \u0643\u064a\u0641\u064a\u0629 \u062a\u0642\u062f\u064a\u0645 \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629.",
    readTimeMinutes: 8,
    featured: true,
    publishedDate: "2026-01-15",
    authorName: "\u062f. \u0639\u0628\u062f\u0627\u0644\u0644\u0647 \u0627\u0644\u062d\u0631\u0628\u064a",
    tags: ["\u0627\u0644\u0635\u062d\u0629 \u0627\u0644\u0631\u0642\u0645\u064a\u0629", "\u0631\u0624\u064a\u0629 2030"],
    categorySlug: "digital-health"
  },
  {
    title: "\u0623\u0641\u0636\u0644 \u0627\u0644\u0645\u0645\u0627\u0631\u0633\u0627\u062a \u0644\u0644\u0627\u0645\u062a\u062b\u0627\u0644 \u0644\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631",
    slug: "cme-compliance-best-practices",
    excerpt: "\u062f\u0644\u064a\u0644 \u0634\u0627\u0645\u0644 \u0644\u0641\u0647\u0645 \u0648\u0627\u0644\u062d\u0641\u0627\u0638 \u0639\u0644\u0649 \u0627\u0644\u0627\u0645\u062a\u062b\u0627\u0644 \u0644\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631 \u0644\u0644\u0645\u062a\u062e\u0635\u0635\u064a\u0646 \u0641\u064a \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629.",
    content: "## \u0641\u0647\u0645 \u0645\u062a\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631\n\n\u064a\u0639\u062f \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631 \u0639\u0646\u0635\u0631\u0627\u064b \u0623\u0633\u0627\u0633\u064a\u0627\u064b \u0641\u064a \u0627\u0644\u062a\u0637\u0648\u064a\u0631 \u0627\u0644\u0645\u0647\u0646\u064a \u0644\u0644\u0645\u0645\u0627\u0631\u0633\u064a\u0646 \u0627\u0644\u0635\u062d\u064a\u064a\u0646.\n\n## \u0645\u0639\u0627\u064a\u064a\u0631 \u0627\u0644\u0627\u0645\u062a\u062b\u0627\u0644 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629\n\n- \u0625\u0643\u0645\u0627\u0644 \u0627\u0644\u062d\u062f \u0627\u0644\u0623\u062f\u0646\u0649 \u0645\u0646 \u0633\u0627\u0639\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631 \u0633\u0646\u0648\u064a\u0627\u064b\n- \u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0629 \u0641\u064a \u0627\u0644\u0628\u0631\u0627\u0645\u062c \u0627\u0644\u0645\u0639\u062a\u0645\u062f\u0629 \u0641\u0642\u0637\n- \u062a\u0648\u062b\u064a\u0642 \u062c\u0645\u064a\u0639 \u0627\u0644\u0623\u0646\u0634\u0637\u0629 \u0627\u0644\u062a\u0639\u0644\u064a\u0645\u064a\u0629\n- \u0627\u062c\u062a\u064a\u0627\u0632 \u0645\u062a\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u062a\u0642\u064a\u064a\u0645 \u0628\u062d\u062f \u0623\u062f\u0646\u0649 70%\n\n## \u0627\u0644\u062e\u0627\u062a\u0645\u0629\n\n\u0627\u0644\u0627\u0645\u062a\u062b\u0627\u0644 \u0644\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631 \u0627\u0633\u062a\u062b\u0645\u0627\u0631 \u0641\u064a \u0627\u0644\u062a\u0645\u064a\u0632 \u0627\u0644\u0645\u0647\u0646\u064a \u0648\u0633\u0644\u0627\u0645\u0629 \u0627\u0644\u0645\u0631\u0636\u0649.",
    readTimeMinutes: 6,
    featured: false,
    publishedDate: "2026-01-10",
    authorName: "\u062f. \u0633\u0627\u0631\u0629 \u0627\u0644\u062c\u0627\u0633\u0631",
    tags: ["\u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631", "\u0627\u0644\u0627\u0645\u062a\u062b\u0627\u0644"],
    categorySlug: "training"
  },
  {
    title: "\u0627\u0644\u062a\u0637\u0648\u0631\u0627\u062a \u0641\u064a \u062a\u062f\u0631\u064a\u0628 \u0645\u0643\u0627\u0641\u062d\u0629 \u0627\u0644\u0639\u062f\u0648\u0649",
    slug: "advances-infection-control-training",
    excerpt: "\u0643\u064a\u0641 \u062a\u0639\u0645\u0644 \u0627\u0644\u0623\u0633\u0627\u0644\u064a\u0628 \u0627\u0644\u062a\u062f\u0631\u064a\u0628\u064a\u0629 \u0627\u0644\u062d\u062f\u064a\u062b\u0629 \u0639\u0644\u0649 \u062a\u062d\u0633\u064a\u0646 \u0645\u0645\u0627\u0631\u0633\u0627\u062a \u0627\u0644\u0648\u0642\u0627\u064a\u0629 \u0648\u0645\u0643\u0627\u0641\u062d\u0629 \u0627\u0644\u0639\u062f\u0648\u0649 \u0641\u064a \u0627\u0644\u0645\u0631\u0627\u0641\u0642 \u0627\u0644\u0635\u062d\u064a\u0629.",
    content: "## \u0623\u0647\u0645\u064a\u0629 \u0645\u0643\u0627\u0641\u062d\u0629 \u0627\u0644\u0639\u062f\u0648\u0649\n\n\u062a\u0638\u0644 \u0627\u0644\u0648\u0642\u0627\u064a\u0629 \u0648\u0645\u0643\u0627\u0641\u062d\u0629 \u0627\u0644\u0639\u062f\u0648\u0649 \u0631\u0643\u064a\u0632\u0629 \u0623\u0633\u0627\u0633\u064a\u0629 \u0644\u0633\u0644\u0627\u0645\u0629 \u0627\u0644\u0645\u0631\u0636\u0649.\n\n## \u0627\u0644\u0645\u062c\u0627\u0644\u0627\u062a \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629\n\n- \u0627\u0644\u0627\u0645\u062a\u062b\u0627\u0644 \u0644\u0646\u0638\u0627\u0641\u0629 \u0627\u0644\u064a\u062f\u064a\u0646\n- \u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0645\u0639\u062f\u0627\u062a \u0627\u0644\u062d\u0645\u0627\u064a\u0629 \u0627\u0644\u0634\u062e\u0635\u064a\u0629\n- \u0627\u0644\u062a\u0646\u0638\u064a\u0641 \u0648\u0627\u0644\u062a\u0637\u0647\u064a\u0631 \u0627\u0644\u0628\u064a\u0626\u064a\n- \u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0636\u0627\u062f\u0627\u062a \u0627\u0644\u062d\u064a\u0648\u064a\u0629\n\n## \u0627\u0644\u062e\u0627\u062a\u0645\u0629\n\n\u0627\u0644\u0627\u0633\u062a\u062b\u0645\u0627\u0631 \u0641\u064a \u062a\u062f\u0631\u064a\u0628 \u0645\u0643\u0627\u0641\u062d\u0629 \u0627\u0644\u0639\u062f\u0648\u0649 \u0627\u0644\u062d\u062f\u064a\u062b \u0623\u0645\u0631 \u0636\u0631\u0648\u0631\u064a \u0644\u0644\u062d\u0641\u0627\u0638 \u0639\u0644\u0649 \u0645\u0639\u0627\u064a\u064a\u0631 \u0639\u0627\u0644\u064a\u0629 \u0644\u0633\u0644\u0627\u0645\u0629 \u0627\u0644\u0645\u0631\u0636\u0649.",
    readTimeMinutes: 7,
    featured: false,
    publishedDate: "2026-01-05",
    authorName: "\u062f. \u0646\u0648\u0631\u0629 \u0627\u0644\u0639\u0645\u0631\u064a",
    tags: ["\u0645\u0643\u0627\u0641\u062d\u0629 \u0627\u0644\u0639\u062f\u0648\u0649", "\u0633\u0644\u0627\u0645\u0629 \u0627\u0644\u0645\u0631\u0636\u0649"],
    categorySlug: "medical"
  },
  {
    title: "\u0627\u0644\u0637\u0628 \u0627\u0644\u0645\u0628\u0646\u064a \u0639\u0644\u0649 \u0627\u0644\u0623\u062f\u0644\u0629: \u0627\u0644\u0631\u0628\u0637 \u0628\u064a\u0646 \u0627\u0644\u0628\u062d\u062b \u0648\u0627\u0644\u0645\u0645\u0627\u0631\u0633\u0629",
    slug: "evidence-based-medicine-bridging-research-practice",
    excerpt: "\u0641\u0647\u0645 \u0643\u064a\u0641\u064a\u0629 \u062f\u0645\u062c \u0645\u0628\u0627\u062f\u0626 \u0627\u0644\u0637\u0628 \u0627\u0644\u0645\u0628\u0646\u064a \u0639\u0644\u0649 \u0627\u0644\u0623\u062f\u0644\u0629 \u0628\u0634\u0643\u0644 \u0641\u0639\u0627\u0644 \u0641\u064a \u0627\u0644\u0645\u0645\u0627\u0631\u0633\u0629 \u0627\u0644\u0633\u0631\u064a\u0631\u064a\u0629.",
    content: "## \u0645\u0627 \u0647\u0648 \u0627\u0644\u0637\u0628 \u0627\u0644\u0645\u0628\u0646\u064a \u0639\u0644\u0649 \u0627\u0644\u0623\u062f\u0644\u0629\u061f\n\n\u0627\u0644\u0637\u0628 \u0627\u0644\u0645\u0628\u0646\u064a \u0639\u0644\u0649 \u0627\u0644\u0623\u062f\u0644\u0629 \u0647\u0648 \u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0627\u0644\u0648\u0627\u0639\u064a \u0644\u0623\u0641\u0636\u0644 \u0627\u0644\u0623\u062f\u0644\u0629 \u0627\u0644\u062d\u0627\u0644\u064a\u0629 \u0641\u064a \u0627\u062a\u062e\u0627\u0630 \u0627\u0644\u0642\u0631\u0627\u0631\u0627\u062a \u0627\u0644\u0633\u0631\u064a\u0631\u064a\u0629.\n\n## \u0627\u0644\u0631\u0643\u0627\u0626\u0632 \u0627\u0644\u062b\u0644\u0627\u062b\n\n1. **\u0623\u0641\u0636\u0644 \u0623\u062f\u0644\u0629 \u0627\u0644\u0628\u062d\u062b**: \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0627\u062a \u0627\u0644\u0645\u0646\u0647\u062c\u064a\u0629 \u0648\u0627\u0644\u062a\u062d\u0644\u064a\u0644\u0627\u062a \u0627\u0644\u062a\u0644\u0648\u064a\u0629\n2. **\u0627\u0644\u062e\u0628\u0631\u0629 \u0627\u0644\u0633\u0631\u064a\u0631\u064a\u0629**: \u0627\u0644\u062e\u0628\u0631\u0629 \u0627\u0644\u0645\u062a\u0631\u0627\u0643\u0645\u0629 \u0644\u0644\u0637\u0628\u064a\u0628\n3. **\u0642\u064a\u0645 \u0627\u0644\u0645\u0631\u064a\u0636**: \u062a\u0641\u0636\u064a\u0644\u0627\u062a \u0648\u062a\u0648\u0642\u0639\u0627\u062a \u0627\u0644\u0645\u0631\u064a\u0636\n\n## \u0627\u0644\u062e\u0627\u062a\u0645\u0629\n\n\u0627\u0644\u0637\u0628 \u0627\u0644\u0645\u0628\u0646\u064a \u0639\u0644\u0649 \u0627\u0644\u0623\u062f\u0644\u0629 \u064a\u0639\u0632\u0632 \u0627\u0644\u062d\u0643\u0645 \u0627\u0644\u0633\u0631\u064a\u0631\u064a \u0628\u0623\u0641\u0636\u0644 \u0627\u0644\u0623\u062f\u0644\u0629 \u0627\u0644\u0645\u062a\u0627\u062d\u0629.",
    readTimeMinutes: 9,
    featured: false,
    publishedDate: "2025-12-28",
    authorName: "\u062f. \u0641\u064a\u0635\u0644 \u0627\u0644\u0639\u062a\u064a\u0628\u064a",
    tags: ["\u0627\u0644\u0637\u0628 \u0627\u0644\u0645\u0628\u0646\u064a \u0639\u0644\u0649 \u0627\u0644\u0623\u062f\u0644\u0629", "\u0627\u0644\u0628\u062d\u062b"],
    categorySlug: "research"
  },
  {
    title: "\u062f\u0648\u0631 \u0627\u0644\u0645\u062d\u0627\u0643\u0627\u0629 \u0641\u064a \u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0627\u0644\u0635\u062d\u064a",
    slug: "role-simulation-healthcare-training",
    excerpt: "\u0643\u064a\u0641 \u064a\u062d\u0648\u0644 \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0642\u0627\u0626\u0645 \u0639\u0644\u0649 \u0627\u0644\u0645\u062d\u0627\u0643\u0627\u0629 \u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0627\u0644\u0635\u062d\u064a \u0648\u064a\u062d\u0633\u0646 \u0646\u062a\u0627\u0626\u062c \u0627\u0644\u0645\u0631\u0636\u0649.",
    content: "## \u0645\u0642\u062f\u0645\u0629 \u0641\u064a \u0627\u0644\u0645\u062d\u0627\u0643\u0627\u0629 \u0627\u0644\u0635\u062d\u064a\u0629\n\n\u0628\u0631\u0632 \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0642\u0627\u0626\u0645 \u0639\u0644\u0649 \u0627\u0644\u0645\u062d\u0627\u0643\u0627\u0629 \u0643\u0623\u062f\u0627\u0629 \u0642\u0648\u064a\u0629 \u0641\u064a \u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0627\u0644\u0635\u062d\u064a.\n\n## \u0641\u0648\u0627\u0626\u062f \u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0628\u0627\u0644\u0645\u062d\u0627\u0643\u0627\u0629\n\n- **\u0633\u0644\u0627\u0645\u0629 \u0627\u0644\u0645\u0631\u0636\u0649**: \u0627\u0644\u062a\u0639\u0644\u0645 \u0645\u0646 \u0627\u0644\u0623\u062e\u0637\u0627\u0621 \u062f\u0648\u0646 \u0623\u0630\u0649\n- **\u062a\u0643\u0631\u0627\u0631 \u0627\u0644\u0645\u0647\u0627\u0631\u0627\u062a**: \u0645\u0645\u0627\u0631\u0633\u0629 \u0627\u0644\u0625\u062c\u0631\u0627\u0621\u0627\u062a \u0639\u062f\u0629 \u0645\u0631\u0627\u062a\n- **\u0627\u0644\u0639\u0645\u0644 \u0627\u0644\u062c\u0645\u0627\u0639\u064a**: \u062a\u0637\u0648\u064a\u0631 \u0645\u0647\u0627\u0631\u0627\u062a \u0627\u0644\u062a\u0639\u0627\u0648\u0646\n- **\u0627\u0644\u062b\u0642\u0629**: \u0628\u0646\u0627\u0621 \u0627\u0644\u0643\u0641\u0627\u0621\u0629 \u0642\u0628\u0644 \u0627\u0644\u0645\u0645\u0627\u0631\u0633\u0629 \u0627\u0644\u0633\u0631\u064a\u0631\u064a\u0629\n\n## \u0627\u0644\u062e\u0627\u062a\u0645\u0629\n\n\u0627\u0644\u0645\u062d\u0627\u0643\u0627\u0629 \u0639\u0646\u0635\u0631 \u0644\u0627 \u063a\u0646\u0649 \u0639\u0646\u0647 \u0641\u064a \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0635\u062d\u064a \u0627\u0644\u062d\u062f\u064a\u062b.",
    readTimeMinutes: 7,
    featured: false,
    publishedDate: "2025-12-20",
    authorName: "\u062f. \u0645\u062d\u0645\u062f \u0627\u0644\u063a\u0627\u0645\u062f\u064a",
    tags: ["\u0627\u0644\u0645\u062d\u0627\u0643\u0627\u0629", "\u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0627\u0644\u0635\u062d\u064a"],
    categorySlug: "training"
  },
  {
    title: "\u062b\u0642\u0627\u0641\u0629 \u0633\u0644\u0627\u0645\u0629 \u0627\u0644\u0645\u0631\u0636\u0649 \u0641\u064a \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629",
    slug: "patient-safety-culture-saudi-healthcare",
    excerpt: "\u0628\u0646\u0627\u0621 \u0648\u0627\u0633\u062a\u062f\u0627\u0645\u0629 \u062b\u0642\u0627\u0641\u0629 \u0633\u0644\u0627\u0645\u0629 \u0627\u0644\u0645\u0631\u0636\u0649 \u0639\u0628\u0631 \u0645\u0646\u0638\u0645\u0627\u062a \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629 \u0641\u064a \u0627\u0644\u0645\u0645\u0644\u0643\u0629.",
    content: "## \u0641\u0647\u0645 \u062b\u0642\u0627\u0641\u0629 \u0633\u0644\u0627\u0645\u0629 \u0627\u0644\u0645\u0631\u0636\u0649\n\n\u062a\u0634\u064a\u0631 \u062b\u0642\u0627\u0641\u0629 \u0633\u0644\u0627\u0645\u0629 \u0627\u0644\u0645\u0631\u0636\u0649 \u0625\u0644\u0649 \u0627\u0644\u0642\u064a\u0645 \u0648\u0627\u0644\u0645\u0639\u062a\u0642\u062f\u0627\u062a \u0627\u0644\u0645\u0634\u062a\u0631\u0643\u0629 \u0641\u064a \u0627\u0644\u0645\u0646\u0638\u0645\u0629 \u0627\u0644\u0635\u062d\u064a\u0629.\n\n## \u0627\u0644\u0639\u0646\u0627\u0635\u0631 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629\n\n- \u0627\u0644\u062a\u0632\u0627\u0645 \u0627\u0644\u0642\u064a\u0627\u062f\u0629\n- \u0627\u0644\u062a\u0648\u0627\u0635\u0644 \u0627\u0644\u0645\u0641\u062a\u0648\u062d\n- \u0627\u0644\u062a\u0639\u0644\u0645 \u0627\u0644\u0645\u0633\u062a\u0645\u0631\n- \u0625\u0634\u0631\u0627\u0643 \u0627\u0644\u0645\u0631\u0636\u0649\n\n## \u0627\u0644\u062e\u0627\u062a\u0645\u0629\n\n\u0628\u0646\u0627\u0621 \u062b\u0642\u0627\u0641\u0629 \u0642\u0648\u064a\u0629 \u0644\u0633\u0644\u0627\u0645\u0629 \u0627\u0644\u0645\u0631\u0636\u0649 \u064a\u062a\u0637\u0644\u0628 \u062c\u0647\u062f\u0627\u064b \u0645\u0633\u062a\u062f\u0627\u0645\u0627\u064b \u0648\u0627\u0644\u062a\u0632\u0627\u0645 \u0627\u0644\u0642\u064a\u0627\u062f\u0629 \u0648\u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0645\u0633\u062a\u0645\u0631.",
    readTimeMinutes: 8,
    featured: false,
    publishedDate: "2025-12-15",
    authorName: "\u062f. \u064a\u0627\u0633\u0631 \u0627\u0644\u0642\u062d\u0637\u0627\u0646\u064a",
    tags: ["\u0633\u0644\u0627\u0645\u0629 \u0627\u0644\u0645\u0631\u0636\u0649", "\u0627\u0644\u062c\u0648\u062f\u0629"],
    categorySlug: "medical"
  }
];

// Seed blog categories
async function seedBlogCategories(locale, categories) {
  console.log(`\nSeeding blog categories (${locale})...`);

  const createdCategories = {};
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const catData = {
      title: cat.title,
      slug: cat.slug,
    };

    try {
      const result = await apiRequest(`/blog-categories?locale=${locale}`, 'POST', catData);
      console.log(`  Created category: ${cat.title}`);
      if (result?.data?.documentId) {
        await publishEntry('/blog-categories', result.data.documentId, cat.title);
        createdCategories[cat.slug] = result.data.id;
      }
    } catch (error) {
      console.error(`  Failed to create category ${cat.title}:`, error.message);
    }
  }
  return createdCategories;
}

// Seed blog posts
async function seedBlogPosts(locale, posts, categoryMap) {
  console.log(`\nSeeding blog posts (${locale})...`);

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const postData = {
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      readTimeMinutes: post.readTimeMinutes,
      featured: post.featured,
      publishedDate: post.publishedDate,
      authorName: post.authorName,
      tags: post.tags,
      order: i + 1,
    };

    // Link category if available
    if (post.categorySlug && categoryMap[post.categorySlug]) {
      postData.category = categoryMap[post.categorySlug];
    }

    try {
      const result = await apiRequest(`/blog-posts?locale=${locale}`, 'POST', postData);
      console.log(`  Created blog post: ${post.title}`);
      if (result?.data?.documentId) {
        await publishEntry('/blog-posts', result.data.documentId, post.title);
      }
    } catch (error) {
      console.error(`  Failed to create blog post ${post.title}:`, error.message);
    }
  }
}

// English instructors
const enInstructors = [
  { name: "Dr. Abdullah Al-Harbi", title: "Consultant, Orthopedic Surgery", section: "expert" },
  { name: "Dr. Sarah Al-Jasser", title: "Consultant, Pediatric Rheumatology", section: "expert" },
  { name: "Dr. Nourah Al-Amri", title: "Consultant, Family Medicine & Community Health", section: "expert" },
  { name: "Dr. Faisal Al-Otaibi", title: "Prince Sultan Military Medical City, Riyadh", section: "minds" },
  { name: "Dr. Mohammed Al-Ghamdi", title: "Assistant Professor & Consultant, Emergency Medicine", section: "minds" },
  { name: "Dr. Yasser Al-Qahtani", title: "Senior Registrar, Internal Medicine", section: "minds" },
  { name: "Dr. Omar Al-Shehri", title: "Consultant, Neurology", section: "minds" }
];

async function main() {
  console.log('='.repeat(60));
  console.log('Strapi Content Seeder');
  console.log('='.repeat(60));
  console.log(`\nStrapi URL: ${STRAPI_URL}`);

  if (STRAPI_API_TOKEN === 'YOUR_API_TOKEN_HERE') {
    console.error('\nERROR: Please set your STRAPI_API_TOKEN!');
    console.log('\nTo create an API token:');
    console.log('1. Go to Strapi Admin > Settings > API Tokens');
    console.log('2. Create a new token with "Full access"');
    console.log('3. Set STRAPI_API_TOKEN environment variable or edit this script');
    process.exit(1);
  }

  try {
    // Test connection
    console.log('\nTesting connection...');
    await fetch(`${STRAPI_URL}/api`);
    console.log('Connection successful!');

    // === Clean up collection types before re-seeding ===
    console.log('\n--- Cleaning up existing collection data ---');
    await deleteAllEntries('/navigation-links', 'navigation links');
    await deleteAllEntries('/featured-courses', 'featured courses');
    await deleteAllEntries('/testimonials', 'testimonials');
    await deleteAllEntries('/instructors', 'instructors');
    await deleteAllEntries('/partners', 'partners');
    await deleteAllEntries('/blog-posts', 'blog posts');
    await deleteAllEntries('/blog-categories', 'blog categories');

    // === Seed English content ===
    await seedHomePage('en', enContent);
    await seedAboutPage('en', enContent);
    await seedBecomeTrainerPage('en', enContent);
    await seedPrivacyPolicyPage('en', enContent);
    await seedTermsPage('en', enContent);
    await seedLearningPoliciesPage('en', enContent);
    await seedContactPage('en', enContent);
    await seedFeedbackPage('en', enContent);
    await seedCertificationsPage('en', enContent);
    await seedNELCPage('en', enContent);
    await seedPartnersPage('en', enContent);
    await seedInstructorsPage('en', enContent);
    await seedFAQPage('en', enContent);
    await seedSupportPage('en', enContent);
    await seedSiteSettings('en', enContent);
    await seedFeaturedCourses('en', enContent.courses, {
      cmeHours: 'CME Hours',
      viewDetails: 'View Details'
    });
    await seedTestimonials('en', enContent.testimonialItems);
    await seedInstructors('en', enInstructors);
    await seedNavigationLinks('en', enNavbarLinks, 'navbar');
    await seedNavigationLinks('en', enFooterPlatformLinks, 'footer-platform');
    await seedNavigationLinks('en', enFooterOrganizationLinks, 'footer-organization');
    await seedNavigationLinks('en', enFooterSupportLinks, 'footer-support');
    await seedPartners('en', enPartners);
    const enCategoryMap = await seedBlogCategories('en', enBlogCategories);
    await seedBlogPosts('en', enBlogPosts, enCategoryMap);

    // === Seed Arabic content ===
    await seedHomePage('ar', arContent);
    await seedAboutPage('ar', arContent);
    await seedBecomeTrainerPage('ar', arContent);
    await seedPrivacyPolicyPage('ar', arContent);
    await seedTermsPage('ar', arContent);
    await seedLearningPoliciesPage('ar', arContent);
    await seedContactPage('ar', arContent);
    await seedFeedbackPage('ar', arContent);
    await seedCertificationsPage('ar', arContent);
    await seedNELCPage('ar', arContent);
    await seedPartnersPage('ar', arContent);
    await seedInstructorsPage('ar', arContent);
    await seedFAQPage('ar', arContent);
    await seedSupportPage('ar', arContent);
    await seedSiteSettings('ar', arContent);
    await seedFeaturedCourses('ar', arContent.courses, {
      cmeHours: '\u0633\u0627\u0639\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631',
      viewDetails: '\u0639\u0631\u0636 \u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644'
    });
    await seedTestimonials('ar', arContent.testimonialItems);
    await seedInstructors('ar', arInstructors);
    await seedNavigationLinks('ar', arNavbarLinks, 'navbar');
    await seedNavigationLinks('ar', arFooterPlatformLinks, 'footer-platform');
    await seedNavigationLinks('ar', arFooterOrganizationLinks, 'footer-organization');
    await seedNavigationLinks('ar', arFooterSupportLinks, 'footer-support');
    await seedPartners('ar', arPartners);
    const arCategoryMap = await seedBlogCategories('ar', arBlogCategories);
    await seedBlogPosts('ar', arBlogPosts, arCategoryMap);

    console.log('\n' + '='.repeat(60));
    console.log('Seeding complete!');
    console.log('='.repeat(60));
    console.log('\nNote: Media files (images, logos) need to be uploaded manually');
    console.log('through the Strapi admin panel.');
    console.log('\nRemember to publish all content in the Strapi admin:');
    console.log('  Select all entries > Publish');

  } catch (error) {
    console.error('\nFailed to seed content:', error.message);
    process.exit(1);
  }
}

main();
