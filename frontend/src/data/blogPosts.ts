// Legacy mock data interface - blogs are now fetched from Sanity CMS
export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readTime: string;
  publishDate: string;
  image: string;
  featured?: boolean;
}

export const blogPosts: BlogPost[] = [
  {
    id: "1",
    slug: "digital-health-transformation",
    title: "Digital Health Transformation in Modern Healthcare Systems",
    excerpt: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
    category: "Digital Health",
    readTime: "5 min read",
    publishDate: "Published on 11 Jan 2022",
    image: "/blogs/blog-1.png",
    featured: true,
  },
  {
    id: "2",
    slug: "advanced-life-support-training",
    title: "Advanced Life Support Training: Why Practical Simulation Matters",
    excerpt: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
    category: "Training",
    readTime: "5 min read",
    publishDate: "Published on 11 Jan 2022",
    image: "/blogs/blog-1.png",
  },
  {
    id: "3",
    slug: "digital-health-modern-systems",
    title: "Digital Health Transformation in Modern Healthcare Practice",
    excerpt: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
    category: "Digital Health",
    readTime: "5 min read",
    publishDate: "Published on 11 Jan 2022",
    image: "/blogs/blog-2.png",
  },
  {
    id: "4",
    slug: "infection-prevention-control",
    title: "Infection Prevention and Control: A Continuous Learning Journey",
    excerpt: "Lorem ipsum dolor sit amet consectetur adipiscing elit Suspendisse varius eros.",
    category: "Medical",
    readTime: "5 min read",
    publishDate: "Published on 11 Jan 2022",
    image: "/blogs/blog-3.png",
  },
  {
    id: "5",
    slug: "advanced-life-support-importance",
    title: "Advanced Life Support Training: Why Practical Simulation Matters",
    excerpt: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
    category: "Training",
    readTime: "5 min read",
    publishDate: "Published on 11 Jan 2022",
    image: "/blogs/blog-1.png",
  },
  {
    id: "6",
    slug: "digital-health-transformation-2",
    title: "Digital Health Transformation in Modern Healthcare Systems",
    excerpt: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
    category: "Digital Health",
    readTime: "5 min read",
    publishDate: "Published on 11 Jan 2022",
    image: "/blogs/blog-2.png",
  },
  {
    id: "7",
    slug: "infection-control-best-practices",
    title: "Infection Prevention and Control: A Continuous Learning Journey",
    excerpt: "Lorem ipsum dolor sit amet consectetur adipiscing elit Suspendisse varius eros.",
    category: "Medical",
    readTime: "5 min read",
    publishDate: "Published on 11 Jan 2022",
    image: "/blogs/blog-3.png",
  },
  {
    id: "8",
    slug: "healthcare-innovation-trends",
    title: "Healthcare Innovation Trends: What to Expect in 2025",
    excerpt: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
    category: "Digital Health",
    readTime: "6 min read",
    publishDate: "Published on 15 Jan 2022",
    image: "/blogs/blog-1.png",
  },
  {
    id: "9",
    slug: "emergency-response-training",
    title: "Emergency Response Training: Building Critical Skills",
    excerpt: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
    category: "Training",
    readTime: "4 min read",
    publishDate: "Published on 18 Jan 2022",
    image: "/blogs/blog-2.png",
  },
  {
    id: "10",
    slug: "patient-care-excellence",
    title: "Patient Care Excellence: Best Practices for Healthcare Professionals",
    excerpt: "Lorem ipsum dolor sit amet consectetur adipiscing elit Suspendisse varius eros.",
    category: "Medical",
    readTime: "7 min read",
    publishDate: "Published on 20 Jan 2022",
    image: "/blogs/blog-3.png",
  },
  {
    id: "11",
    slug: "telemedicine-future",
    title: "The Future of Telemedicine in Healthcare Delivery",
    excerpt: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
    category: "Digital Health",
    readTime: "5 min read",
    publishDate: "Published on 22 Jan 2022",
    image: "/blogs/blog-1.png",
  },
  {
    id: "12",
    slug: "clinical-skills-development",
    title: "Clinical Skills Development: A Comprehensive Guide",
    excerpt: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
    category: "Training",
    readTime: "8 min read",
    publishDate: "Published on 25 Jan 2022",
    image: "/blogs/blog-2.png",
  },
  {
    id: "13",
    slug: "medical-research-advances",
    title: "Medical Research Advances: Breaking New Ground",
    excerpt: "Lorem ipsum dolor sit amet consectetur adipiscing elit Suspendisse varius eros.",
    category: "Research",
    readTime: "6 min read",
    publishDate: "Published on 28 Jan 2022",
    image: "/blogs/blog-3.png",
  },
];

export const blogCategories = ["All", "Digital Health", "Training", "Medical", "Research"];
