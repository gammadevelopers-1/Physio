export interface Course {
  id: string;
  slug: string;
  title: string;
  type: "Online courses" | "On-site courses" | "Live Online" | "Hybrid";
  category: string;
  date: string;
  hours: string;
  description: string;
  price: number;
  vectorImage: string;
  image: string;
  certification: "BHA" | "NHA" | "SCFHS" | "None";
  isPaid: boolean;
}

export interface CourseDetail extends Course {
  subtitle: string;
  language: string;
  duration: string;
  rating: number;
  reviews: number;
  students: number;
  registrationDeadline: string;
  endDate: string;
  city: string;
  whatYouWillLearn: string[];
  fullDescription: string;
  schedules: {
    city: string;
    dates: { date: string; available: boolean }[];
  }[];
}

export const courses: Course[] = [
  {
    id: "1",
    slug: "life-support-emergency-care",
    title: "Life Support / Emergency Care",
    type: "Live Online",
    category: "Emergency",
    date: "18 Jan 2026",
    hours: "6 CME Hours",
    description: "Essential life-saving skills for early response, resuscitation, and emergency management.",
    price: 375,
    vectorImage: "/featured images/Vector 2 (1).svg",
    image: "/featured images/Vector 2 (1).svg",
    certification: "BHA",
    isPaid: true,
  },
  {
    id: "2",
    slug: "patient-safety-quality",
    title: "Patient Safety & Quality",
    type: "Live Online",
    category: "Quality",
    date: "11 Jan 2026",
    hours: "8 CME Hours",
    description: "Learn structured approaches to reduce medical errors, improve outcomes, and enhance care quality.",
    price: 460,
    vectorImage: "/featured images/Vector 2 (2).svg",
    image: "/featured images/Vector 2 (2).svg",
    certification: "NHA",
    isPaid: true,
  },
  {
    id: "3",
    slug: "public-health-preparedness",
    title: "Public Health & Preparedness",
    type: "Live Online",
    category: "Public Health",
    date: "11 Jan 2026",
    hours: "8 CME Hours",
    description: "Principles of surveillance, risk assessment, and coordinated response to health emergencies.",
    price: 575,
    vectorImage: "/featured images/Vector 2 (3).svg",
    image: "/featured images/Vector 2 (3).svg",
    certification: "SCFHS",
    isPaid: true,
  },
  {
    id: "4",
    slug: "digital-health-systems-data-privacy",
    title: "Digital Health Systems and Data Privacy",
    type: "Live Online",
    category: "Digital Health",
    date: "15 Jan 2026",
    hours: "6 CME Hours",
    description: "Master digital health tools and best practices for secure patient data management.",
    price: 575,
    vectorImage: "/featured images/Vector 2.svg",
    image: "/featured images/Vector 2.svg",
    certification: "BHA",
    isPaid: true,
  },
  {
    id: "5",
    slug: "advanced-cardiovascular-life-support",
    title: "Advanced Cardiovascular Life Support",
    type: "Live Online",
    category: "Emergency",
    date: "8 Jan 2026",
    hours: "8 CME Hours",
    description: "Gain advanced emergency skills to manage cardiac arrest and life-threatening events.",
    price: 460,
    vectorImage: "/featured images/Vector 2 (1).svg",
    image: "/featured images/Vector 2 (1).svg",
    certification: "NHA",
    isPaid: true,
  },
  {
    id: "6",
    slug: "neonatal-resuscitation-program",
    title: "Neonatal Resuscitation Program",
    type: "Live Online",
    category: "Pediatrics",
    date: "11 Jan 2026",
    hours: "8 CME Hours",
    description: "Acquire practical neonatal resuscitation techniques for newborn care and safety.",
    price: 470,
    vectorImage: "/featured images/Vector 2 (3).svg",
    image: "/featured images/Vector 2 (3).svg",
    certification: "SCFHS",
    isPaid: true,
  },
  {
    id: "7",
    slug: "infection-control-flagship",
    title: "Infection Control (Core / Flagship)",
    type: "On-site courses",
    category: "Infection Control",
    date: "11 Jan 2026",
    hours: "8 CME Hours",
    description: "A comprehensive, evidence-based overview of infection prevention strategies for modern healthcare settings.",
    price: 575,
    vectorImage: "/featured images/Vector 2.svg",
    image: "/featured images/Vector 2.svg",
    certification: "BHA",
    isPaid: true,
  },
  {
    id: "8",
    slug: "basic-life-support",
    title: "Basic Life Support (BLS)",
    type: "Hybrid",
    category: "Emergency",
    date: "20 Jan 2026",
    hours: "4 CME Hours",
    description: "Learn essential CPR and basic life support techniques for healthcare providers.",
    price: 0,
    vectorImage: "/featured images/Vector 2 (1).svg",
    image: "/featured images/Vector 2 (1).svg",
    certification: "None",
    isPaid: false,
  },
  {
    id: "9",
    slug: "healthcare-quality-management",
    title: "Healthcare Quality Management",
    type: "Online courses",
    category: "Quality",
    date: "25 Jan 2026",
    hours: "6 CME Hours",
    description: "Comprehensive training on quality management systems in healthcare organizations.",
    price: 425,
    vectorImage: "/featured images/Vector 2 (2).svg",
    image: "/featured images/Vector 2 (2).svg",
    certification: "NHA",
    isPaid: true,
  },
  {
    id: "10",
    slug: "pediatric-emergency-care",
    title: "Pediatric Emergency Care",
    type: "Live Online",
    category: "Pediatrics",
    date: "28 Jan 2026",
    hours: "8 CME Hours",
    description: "Specialized training for pediatric emergency situations and critical care.",
    price: 550,
    vectorImage: "/featured images/Vector 2 (3).svg",
    image: "/featured images/Vector 2 (3).svg",
    certification: "SCFHS",
    isPaid: true,
  },
  {
    id: "11",
    slug: "clinical-documentation",
    title: "Clinical Documentation Excellence",
    type: "Online courses",
    category: "Quality",
    date: "1 Feb 2026",
    hours: "4 CME Hours",
    description: "Best practices for accurate and compliant clinical documentation.",
    price: 320,
    vectorImage: "/featured images/Vector 2.svg",
    image: "/featured images/Vector 2.svg",
    certification: "BHA",
    isPaid: true,
  },
  {
    id: "12",
    slug: "medication-safety",
    title: "Medication Safety & Administration",
    type: "Hybrid",
    category: "Quality",
    date: "5 Feb 2026",
    hours: "6 CME Hours",
    description: "Safe medication practices and error prevention in healthcare settings.",
    price: 480,
    vectorImage: "/featured images/Vector 2 (1).svg",
    image: "/featured images/Vector 2 (1).svg",
    certification: "NHA",
    isPaid: true,
  },
];

export const courseDetails: CourseDetail[] = [
  {
    id: "5",
    slug: "advanced-cardiovascular-life-support",
    title: "Advanced Cardiovascular Life Support",
    subtitle: "Gain advanced emergency skills to manage cardiac arrest and life-threatening events.",
    type: "Live Online",
    category: "Emergency",
    date: "8 Jan 2026",
    hours: "8 CME Hours",
    description: "Gain advanced emergency skills to manage cardiac arrest and life-threatening events.",
    price: 575,
    vectorImage: "/featured images/Vector 2 (1).svg",
    image: "/featured images/Vector 2 (1).svg",
    certification: "BHA",
    isPaid: true,
    language: "English",
    duration: "8 hours",
    rating: 4.9,
    reviews: 200,
    students: 200,
    registrationDeadline: "Only 5% of seats remaining",
    endDate: "February 10, 2026",
    city: "Jeddah",
    whatYouWillLearn: [
      "Reviewing the basics of cardiopulmonary resuscitation (CPR)",
      "Identifying emergency situations and initiating the key responses",
      "Proper performing chest compressions and ventilator techniques",
      "Efficiently using an automated external defibrillator (AED)",
      "Learning correct protocols for handling choking cases in adults and children",
    ],
    fullDescription: "This course offers you a practical opportunity to gain hands-on practical experience that equips you to handle life-critical issues with confidence and efficiency. Training is used today by a team of expert doctors and paramedics who will guide your journey into becoming a part of a life-saving team.",
    schedules: [
      {
        city: "Jeddah",
        dates: [
          { date: "February 9, 2026", available: true },
          { date: "February 17, 2026", available: true },
          { date: "February 23, 2026", available: true },
          { date: "February 28, 2026", available: true },
        ],
      },
      {
        city: "Riyadh",
        dates: [
          { date: "February 05, 2026", available: true },
          { date: "February 15, 2026", available: true },
          { date: "February 22, 2026", available: true },
        ],
      },
    ],
  },
  {
    id: "1",
    slug: "life-support-emergency-care",
    title: "Life Support / Emergency Care",
    subtitle: "Essential life-saving skills for early response, resuscitation, and emergency management.",
    type: "Live Online",
    category: "Emergency",
    date: "18 Jan 2026",
    hours: "6 CME Hours",
    description: "Essential life-saving skills for early response, resuscitation, and emergency management.",
    price: 375,
    vectorImage: "/featured images/Vector 2 (1).svg",
    image: "/featured images/Vector 2 (1).svg",
    certification: "BHA",
    isPaid: true,
    language: "English",
    duration: "6 hours",
    rating: 4.8,
    reviews: 150,
    students: 180,
    registrationDeadline: "Limited seats available",
    endDate: "January 25, 2026",
    city: "Riyadh",
    whatYouWillLearn: [
      "Master essential CPR techniques for adults and children",
      "Understand emergency response protocols",
      "Learn proper use of emergency medical equipment",
      "Develop quick assessment and triage skills",
      "Practice team-based resuscitation scenarios",
    ],
    fullDescription: "This comprehensive course covers all aspects of emergency care and life support, preparing healthcare professionals to respond effectively to critical situations.",
    schedules: [
      {
        city: "Riyadh",
        dates: [
          { date: "January 18, 2026", available: true },
          { date: "January 25, 2026", available: true },
        ],
      },
      {
        city: "Jeddah",
        dates: [
          { date: "January 20, 2026", available: true },
        ],
      },
    ],
  },
  {
    id: "2",
    slug: "patient-safety-quality",
    title: "Patient Safety & Quality",
    subtitle: "Learn structured approaches to reduce medical errors, improve outcomes, and enhance care quality.",
    type: "Live Online",
    category: "Quality",
    date: "11 Jan 2026",
    hours: "8 CME Hours",
    description: "Learn structured approaches to reduce medical errors, improve outcomes, and enhance care quality.",
    price: 460,
    vectorImage: "/featured images/Vector 2 (2).svg",
    image: "/featured images/Vector 2 (2).svg",
    certification: "NHA",
    isPaid: true,
    language: "English",
    duration: "8 hours",
    rating: 4.7,
    reviews: 120,
    students: 150,
    registrationDeadline: "Open registration",
    endDate: "January 18, 2026",
    city: "Jeddah",
    whatYouWillLearn: [
      "Understand root cause analysis methodologies",
      "Implement quality improvement frameworks",
      "Learn patient safety reporting systems",
      "Develop error prevention strategies",
      "Master healthcare quality metrics",
    ],
    fullDescription: "A comprehensive program designed to equip healthcare professionals with the knowledge and skills needed to improve patient safety and healthcare quality.",
    schedules: [
      {
        city: "Jeddah",
        dates: [
          { date: "January 11, 2026", available: true },
          { date: "January 18, 2026", available: true },
        ],
      },
    ],
  },
  {
    id: "3",
    slug: "public-health-preparedness",
    title: "Public Health & Preparedness",
    subtitle: "Principles of surveillance, risk assessment, and coordinated response to health emergencies.",
    type: "Live Online",
    category: "Public Health",
    date: "11 Jan 2026",
    hours: "8 CME Hours",
    description: "Principles of surveillance, risk assessment, and coordinated response to health emergencies.",
    price: 575,
    vectorImage: "/featured images/Vector 2 (3).svg",
    image: "/featured images/Vector 2 (3).svg",
    certification: "SCFHS",
    isPaid: true,
    language: "English",
    duration: "8 hours",
    rating: 4.9,
    reviews: 180,
    students: 200,
    registrationDeadline: "Limited seats",
    endDate: "January 18, 2026",
    city: "Riyadh",
    whatYouWillLearn: [
      "Understand public health surveillance systems",
      "Learn risk assessment methodologies",
      "Develop emergency response plans",
      "Master outbreak investigation techniques",
      "Implement community health interventions",
    ],
    fullDescription: "This course prepares healthcare professionals to handle public health emergencies and implement effective preparedness strategies.",
    schedules: [
      {
        city: "Riyadh",
        dates: [
          { date: "January 11, 2026", available: true },
        ],
      },
      {
        city: "Jeddah",
        dates: [
          { date: "January 15, 2026", available: true },
        ],
      },
    ],
  },
];

export const courseTypes = [
  "Online courses",
  "On-site courses",
  "Live Online",
  "Hybrid",
];

export const certifications = ["BHA", "NHA", "SCFHS"];

export const pricingOptions = ["Paid", "Free"];
