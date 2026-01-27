export interface BlogContent {
  type: "paragraph" | "heading" | "image" | "quote" | "conclusion";
  text?: string;
  src?: string;
  alt?: string;
}

export interface BlogDetail {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readTime: string;
  image: string;
  author: {
    name: string;
    avatar: string;
  };
  content: BlogContent[];
  tags: string[];
}

export const blogDetails: BlogDetail[] = [
  {
    id: "1",
    slug: "digital-health-transformation",
    title: "Digital Health Transformation in Modern Healthcare Systems",
    excerpt: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
    category: "Digital Health",
    date: "Jan 2025",
    readTime: "5 min read",
    image: "/blogs/blog-hero.png",
    author: {
      name: "Dr. Ahmed",
      avatar: "/images/instructor-1.png",
    },
    content: [
      {
        type: "paragraph",
        text: "Technology is playing an ever-greater role in healthcare and is changing the way we think about medical care. We are seeing more automation, more data-driven and machine learning-powered solutions, and new technologies to transform nearly every aspect of how healthcare is delivered to patients.",
      },
      {
        type: "heading",
        text: "Introduction",
      },
      {
        type: "paragraph",
        text: "Although these technologies, such as robotic process automation and machine learning algorithms, have been around for some time, they have matured considerably over the past decade. It now seems like a good time to take a closer look at what the leading technology trends are and how they are expected to continue transforming the healthcare sector.",
      },
      {
        type: "paragraph",
        text: "From artificial intelligence and machine learning to wearables and telehealth, the potential applications of these technologies are vast. They can be used to streamline administrative tasks, improve diagnostic accuracy, enhance patient engagement, and much more.",
      },
      {
        type: "image",
        src: "/blogs/indv-blog-1.png",
        alt: "Healthcare technology illustration",
      },
      {
        type: "quote",
        text: "In a world that is more complex than ever, they often depend on physicians and caregivers, gifted with awareness of the services our health and its current situation bring for success and well-being. Discovering the insights of how transformation is driving the future of healthcare is what makes our small contribution vital.",
      },
      {
        type: "paragraph",
        text: "Digital transformation in healthcare involves the adoption of digital technology by healthcare providers to improve patient care, streamline operations, and enhance the overall efficiency of healthcare delivery. This transformation encompasses everything from electronic health records (EHRs) to telemedicine platforms and AI-powered diagnostic tools.",
      },
      {
        type: "heading",
        text: "Data Security and Privacy in Digital Health",
      },
      {
        type: "paragraph",
        text: "As healthcare organizations embrace digital technologies, data security and privacy concerns have become paramount. With sensitive patient information being stored and transmitted electronically, robust cybersecurity measures are essential to protect against data breaches and unauthorized access.",
      },
      {
        type: "paragraph",
        text: "Healthcare providers must implement comprehensive security protocols, including encryption, access controls, and regular security audits. Compliance with regulations such as HIPAA (Health Insurance Portability and Accountability Act) is mandatory to ensure patient data remains protected.",
      },
      {
        type: "heading",
        text: "Analytics and Data-Driven Decision Making",
      },
      {
        type: "paragraph",
        text: "The ability to collect, analyze, and interpret vast amounts of healthcare data has opened new possibilities for improving patient outcomes and operational efficiency. Healthcare analytics enables providers to identify patterns, predict health trends, and make more informed decisions.",
      },
      {
        type: "paragraph",
        text: "Predictive analytics, powered by machine learning algorithms, can help identify patients at risk of developing certain conditions, enabling early intervention and preventive care. This proactive approach not only improves patient outcomes but also reduces healthcare costs in the long run.",
      },
      {
        type: "image",
        src: "/blogs/indv-blog-2.png",
        alt: "Digital health analytics",
      },
      {
        type: "paragraph",
        text: "The integration of data analytics into clinical workflows allows healthcare providers to optimize resource allocation, reduce wait times, and improve the overall patient experience. Real-time analytics dashboards provide administrators with actionable insights to make timely decisions.",
      },
      {
        type: "conclusion",
        text: "The digital transformation of healthcare is not just about adopting new technologies—it's about reimagining how healthcare is delivered and experienced. By embracing digital solutions, healthcare providers can improve patient outcomes, enhance operational efficiency, and create a more sustainable healthcare system for the future.",
      },
    ],
    tags: ["Digital Health", "Healthcare Technology", "Medical Innovation"],
  },
  {
    id: "2",
    slug: "advanced-life-support-training",
    title: "Advanced Life Support Training: Why Practical Experience Matters",
    excerpt: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
    category: "Training",
    date: "Jan 2025",
    readTime: "4 min read",
    image: "/blogs/blog-1.png",
    author: {
      name: "Dr. Sarah",
      avatar: "/images/instructor-2.png",
    },
    content: [
      {
        type: "paragraph",
        text: "Advanced Life Support (ALS) training is essential for healthcare professionals who may need to respond to cardiac emergencies. This comprehensive training program equips medical staff with the knowledge and skills necessary to manage life-threatening situations effectively.",
      },
      {
        type: "heading",
        text: "Introduction",
      },
      {
        type: "paragraph",
        text: "The importance of hands-on practical experience in ALS training cannot be overstated. While theoretical knowledge forms the foundation, it is the practical application of skills that truly prepares healthcare professionals for real-world emergency situations.",
      },
      {
        type: "conclusion",
        text: "Practical experience in ALS training is invaluable for building confidence and competence. Healthcare professionals who engage in regular hands-on practice are better equipped to save lives when emergencies occur.",
      },
    ],
    tags: ["Training", "Life Support", "Emergency Care"],
  },
];

export const latestBlogs = [
  {
    id: "1",
    slug: "advanced-life-support-training",
    title: "Advanced Life Support Training: Why Practical Experience Matters",
    image: "/blogs/blog-1.png",
    category: "Training",
  },
  {
    id: "2",
    slug: "digital-health-modern-systems",
    title: "Digital Health Transformation in Modern Healthcare Practice",
    image: "/blogs/blog-2.png",
    category: "Digital Health",
  },
  {
    id: "3",
    slug: "infection-prevention-control",
    title: "Infection Prevention and Control: A Continuous Learning Journey",
    image: "/blogs/blog-3.png",
    category: "Medical",
  },
];
