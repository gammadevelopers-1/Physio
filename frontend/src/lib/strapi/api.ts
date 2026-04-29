'use server';

import { fetchStrapi, getStrapiMediaUrl } from './client';
import type {
  HomePage,
  AboutPage,
  BecomeTrainerPage,
  PolicyPage,
  ContactPage,
  FeedbackPage,
  CertificationsPage,
  NELCPage,
  SiteSettings,
  Partner,
  FeaturedCourse,
  Instructor,
  Testimonial,
  NavigationLink,
  StrapiBlogPost,
  StrapiBlogCategory,
  PartnersPage,
  InstructorsPage,
  FAQPage,
  SearchPage,
  BlogsPage,
  CoursesPage,
  CourseDetailPage,
  StrapiSingleResponse,
  StrapiResponse,
} from './types';

// Re-export media URL helper
export { getStrapiMediaUrl };

/** Common populate params for dynamic zone blocks on all pages */
const BLOCKS_POPULATE_PARAMS: Record<string, string> = {
  'populate[blocks][on][blocks.hero-banner][populate]': '*',
  'populate[blocks][on][blocks.partners-strip][populate]': '*',
  'populate[blocks][on][blocks.featured-courses-grid][populate]': '*',
  'populate[blocks][on][blocks.cta-banner][populate][buttons]': 'true',
  'populate[blocks][on][blocks.cta-banner][populate][image]': 'true',
  'populate[blocks][on][blocks.cta-banner][populate][backgroundImage]': 'true',
  // Image Banner Block - has media (image) + single component (button)
  'populate[blocks][on][blocks.image-banner-block][populate][image]': 'true',
  'populate[blocks][on][blocks.image-banner-block][populate][button]': 'true',
  'populate[blocks][on][blocks.instructors-grid][populate]': '*',
  'populate[blocks][on][blocks.testimonials-carousel][populate]': '*',
  'populate[blocks][on][blocks.rich-text-block][populate]': '*',
  'populate[blocks][on][blocks.stats-numbers-block][populate][items]': 'true',
  'populate[blocks][on][blocks.cards-grid][populate][cards][populate]': '*',
  'populate[blocks][on][blocks.video-embed][populate][videoFile]': 'true',
  'populate[blocks][on][blocks.logo-strip][populate][logos]': 'true',
  'populate[blocks][on][blocks.faq-accordion][populate][items]': 'true',
  'populate[blocks][on][blocks.accordion-block][populate][items]': 'true',
  'populate[blocks][on][blocks.live-counter-block][populate][counters]': 'true',
  'populate[blocks][on][blocks.policy-sections-block][populate][sections]': 'true',
  'populate[blocks][on][blocks.contact-form-block][populate]': '*',
  'populate[blocks][on][blocks.feedback-form-block][populate]': '*',
  'populate[blocks][on][blocks.trainer-form-block][populate]': '*',
  'populate[blocks][on][blocks.certification-cards-block][populate]': '*',
  // Accreditation Badges Block - has media (badges)
  'populate[blocks][on][blocks.accreditation-badges-block][populate][badges]': 'true',
  // Anchor Links Block - has repeatable component (links)
  'populate[blocks][on][blocks.anchor-links-block][populate][links]': 'true',
  // Announcement Banner Block - flat scalars only
  'populate[blocks][on][blocks.announcement-banner-block][populate]': '*',
  // Before After Block - has media (beforeImage, afterImage)
  'populate[blocks][on][blocks.before-after-block][populate][beforeImage]': 'true',
  'populate[blocks][on][blocks.before-after-block][populate][afterImage]': 'true',
  // Blog Posts Grid Block - flat scalars only
  'populate[blocks][on][blocks.blog-posts-grid-block][populate]': '*',
  // Breadcrumb Block - has repeatable component (items)
  'populate[blocks][on][blocks.breadcrumb-block][populate][items]': 'true',
  // Comparison Table Block - has repeatable component (columns)
  'populate[blocks][on][blocks.comparison-table-block][populate][columns]': 'true',
  // Compliance Badge Block - has repeatable component with media
  'populate[blocks][on][blocks.compliance-badge-block][populate][badges][populate]': '*',
  // Countdown Timer Block - has repeatable component (buttons)
  'populate[blocks][on][blocks.countdown-timer-block][populate][buttons]': 'true',
  // Course Preview Block - has media (previewVideo, previewImage)
  'populate[blocks][on][blocks.course-preview-block][populate][previewVideo]': 'true',
  'populate[blocks][on][blocks.course-preview-block][populate][previewImage]': 'true',
  // CPD Calculator Block - has repeatable component (tiers)
  'populate[blocks][on][blocks.cpd-calculator-block][populate][tiers]': 'true',
  // Curriculum Outline Block - has repeatable component (modules)
  'populate[blocks][on][blocks.curriculum-outline-block][populate][modules]': 'true',
  // Download Resources Block - has repeatable component with media
  'populate[blocks][on][blocks.download-resources-block][populate][resources][populate]': '*',
  // Image Gallery Block - has media (images)
  'populate[blocks][on][blocks.image-gallery-block][populate][images]': 'true',
  // Instructor Spotlight Block - has media (photo)
  'populate[blocks][on][blocks.instructor-spotlight-block][populate][photo]': 'true',
  // Learning Outcomes Block - has repeatable component (outcomes)
  'populate[blocks][on][blocks.learning-outcomes-block][populate][outcomes]': 'true',
  // Newsletter Block - flat scalars only
  'populate[blocks][on][blocks.newsletter-block][populate]': '*',
  // PDF Viewer Block - has media (pdfFile)
  'populate[blocks][on][blocks.pdf-viewer-block][populate][pdfFile]': 'true',
  // Pricing Table Block - has repeatable component (plans)
  'populate[blocks][on][blocks.pricing-table-block][populate][plans]': 'true',
  // Related Pages Block - has repeatable component with media
  'populate[blocks][on][blocks.related-pages-block][populate][pages][populate]': '*',
  // Section Header Block - flat scalars only
  'populate[blocks][on][blocks.section-header-block][populate]': '*',
  // Social Feed Block - has repeatable component (posts)
  'populate[blocks][on][blocks.social-feed-block][populate][posts]': 'true',
  // Spacer Block - flat scalars only
  'populate[blocks][on][blocks.spacer-block][populate]': '*',
  // Student Progress Block - has repeatable component (metrics)
  'populate[blocks][on][blocks.student-progress-block][populate][metrics]': 'true',
  // Success Stories Block - has repeatable component with media
  'populate[blocks][on][blocks.success-stories-block][populate][stories][populate]': '*',
  // Tabs Block - has repeatable component (tabs)
  'populate[blocks][on][blocks.tabs-block][populate][tabs]': 'true',
  // Timeline Block - has repeatable component (steps)
  'populate[blocks][on][blocks.timeline-block][populate][steps]': 'true',
  // Treatment Gallery Block - has repeatable component with media
  'populate[blocks][on][blocks.treatment-gallery-block][populate][techniques][populate]': '*',
  // Upcoming Events Block - has repeatable component with media
  'populate[blocks][on][blocks.upcoming-events-block][populate][events][populate]': '*',
};

// Separate populate for ogImage — only for single-type pages that have this field
const OG_IMAGE_POPULATE = { 'populate[ogImage]': 'true' };

/**
 * Fetch home page content
 */
export async function getHomePage(locale: string = 'en'): Promise<HomePage | null> {
  const response = await fetchStrapi<StrapiSingleResponse<HomePage>>(
    '/home-page',
    {
      params: {
        locale,
        ...BLOCKS_POPULATE_PARAMS,
        ...OG_IMAGE_POPULATE,
        'populate[heroVideo]': 'true',
        'populate[becomeTrainerImage]': 'true',
        'populate[ctaBackgroundImage]': 'true',
        'populate[heroPartnerLogos]': 'true',
      },
    }
  );
  return response?.data || null;
}

/**
 * Fetch site settings
 */
export async function getSiteSettings(locale: string = 'en'): Promise<SiteSettings | null> {
  const response = await fetchStrapi<StrapiSingleResponse<SiteSettings>>(
    '/site-setting',
    {
      params: {
        locale,
        'populate[logo]': 'true',
        'populate[paymentMethods][populate][icon]': 'true',
      },
    }
  );
  return response?.data || null;
}

/**
 * Fetch all active partners
 */
export async function getPartners(locale: string = 'en'): Promise<Partner[]> {
  const response = await fetchStrapi<StrapiResponse<Partner[]>>(
    '/partners',
    {
      params: {
        locale,
        'filters[isActive][$eq]': 'true',
        'sort[0]': 'order:asc',
        'populate[logo]': 'true',
      },
    }
  );
  return response?.data || [];
}

/**
 * Fetch all active featured courses
 */
export async function getFeaturedCourses(locale: string = 'en'): Promise<FeaturedCourse[]> {
  const response = await fetchStrapi<StrapiResponse<FeaturedCourse[]>>(
    '/featured-courses',
    {
      params: {
        locale,
        'filters[isActive][$eq]': 'true',
        'sort[0]': 'order:asc',
        'populate[vectorImage]': 'true',
      },
    }
  );
  return response?.data || [];
}

/**
 * Fetch instructors for homepage
 */
export async function getHomeInstructors(locale: string = 'en'): Promise<Instructor[]> {
  const response = await fetchStrapi<StrapiResponse<Instructor[]>>(
    '/instructors',
    {
      params: {
        locale,
        'filters[showOnHomepage][$eq]': 'true',
        'sort[0]': 'order:asc',
        'populate[avatar]': 'true',
      },
    }
  );
  return response?.data || [];
}

/**
 * Fetch all instructors
 */
export async function getAllInstructors(locale: string = 'en'): Promise<Instructor[]> {
  const response = await fetchStrapi<StrapiResponse<Instructor[]>>(
    '/instructors',
    {
      params: {
        locale,
        'sort[0]': 'order:asc',
        'populate[avatar]': 'true',
      },
    }
  );
  return response?.data || [];
}

/**
 * Fetch all active testimonials
 */
export async function getTestimonials(locale: string = 'en'): Promise<Testimonial[]> {
  const response = await fetchStrapi<StrapiResponse<Testimonial[]>>(
    '/testimonials',
    {
      params: {
        locale,
        'filters[isActive][$eq]': 'true',
        'sort[0]': 'order:asc',
        'populate[authorImage]': 'true',
      },
    }
  );
  return response?.data || [];
}

/**
 * Fetch navigation links by location
 */
export async function getNavigationLinks(
  locale: string = 'en',
  location?: 'navbar' | 'footer-platform' | 'footer-organization' | 'footer-support'
): Promise<NavigationLink[]> {
  const params: Record<string, string> = {
    locale,
    'filters[isActive][$eq]': 'true',
    'sort[0]': 'order:asc',
    'pagination[pageSize]': '100',
  };

  if (location) {
    params['filters[location][$eq]'] = location;
  }

  const response = await fetchStrapi<StrapiResponse<NavigationLink[]>>(
    '/navigation-links',
    { params }
  );
  return response?.data || [];
}

/**
 * Fetch navbar links
 */
export async function getNavbarLinks(locale: string = 'en'): Promise<NavigationLink[]> {
  return getNavigationLinks(locale, 'navbar');
}

/**
 * Fetch footer links grouped by section
 */
export async function getFooterLinks(locale: string = 'en'): Promise<{
  platform: NavigationLink[];
  organization: NavigationLink[];
  support: NavigationLink[];
}> {
  const [platform, organization, support] = await Promise.all([
    getNavigationLinks(locale, 'footer-platform'),
    getNavigationLinks(locale, 'footer-organization'),
    getNavigationLinks(locale, 'footer-support'),
  ]);

  return { platform, organization, support };
}

/**
 * Fetch about page content
 */
export async function getAboutPage(locale: string = 'en'): Promise<AboutPage | null> {
  const response = await fetchStrapi<StrapiSingleResponse<AboutPage>>(
    '/about-page',
    {
      params: {
        locale,
        ...BLOCKS_POPULATE_PARAMS,
        ...OG_IMAGE_POPULATE,
        'populate[heroImage]': 'true',
        'populate[heroImageMobile]': 'true',
        // Repeatable components (each carries its own media)
        'populate[complianceItems]': 'true',
        'populate[learningCards][populate][image]': 'true',
        'populate[learningCards][populate][imageMobile]': 'true',
        'populate[features][populate][icon]': 'true',
      },
    }
  );
  return response?.data || null;
}

/**
 * Fetch all about page data at once (optimized for about page)
 */
export async function getAboutPageData(locale: string = 'en') {
  const [
    aboutPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  ] = await Promise.all([
    getAboutPage(locale),
    getSiteSettings(locale),
    getNavbarLinks(locale),
    getFooterLinks(locale),
  ]);

  return {
    aboutPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  };
}

/**
 * Fetch become-trainer page content
 */
export async function getBecomeTrainerPage(locale: string = 'en'): Promise<BecomeTrainerPage | null> {
  const response = await fetchStrapi<StrapiSingleResponse<BecomeTrainerPage>>(
    '/become-trainer-page',
    {
      params: {
        locale,
        ...BLOCKS_POPULATE_PARAMS,
        ...OG_IMAGE_POPULATE,
      },
    }
  );
  return response?.data || null;
}

/**
 * Fetch all become-trainer page data at once
 */
export async function getBecomeTrainerPageData(locale: string = 'en') {
  const [
    becomeTrainerPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  ] = await Promise.all([
    getBecomeTrainerPage(locale),
    getSiteSettings(locale),
    getNavbarLinks(locale),
    getFooterLinks(locale),
  ]);

  return {
    becomeTrainerPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  };
}

/**
 * Fetch privacy policy page content
 */
export async function getPrivacyPolicyPage(locale: string = 'en'): Promise<PolicyPage | null> {
  const response = await fetchStrapi<StrapiSingleResponse<PolicyPage>>(
    '/privacy-policy-page',
    {
      params: {
        locale,
        ...BLOCKS_POPULATE_PARAMS,
        ...OG_IMAGE_POPULATE,
        'populate[sections]': 'true',
      },
    }
  );
  return response?.data || null;
}

/**
 * Fetch terms page content
 */
export async function getTermsPage(locale: string = 'en'): Promise<PolicyPage | null> {
  const response = await fetchStrapi<StrapiSingleResponse<PolicyPage>>(
    '/terms-page',
    {
      params: {
        locale,
        ...BLOCKS_POPULATE_PARAMS,
        ...OG_IMAGE_POPULATE,
        'populate[sections]': 'true',
      },
    }
  );
  return response?.data || null;
}

/**
 * Fetch learning policies page content
 */
export async function getLearningPoliciesPage(locale: string = 'en'): Promise<PolicyPage | null> {
  const response = await fetchStrapi<StrapiSingleResponse<PolicyPage>>(
    '/learning-policies-page',
    {
      params: {
        locale,
        ...BLOCKS_POPULATE_PARAMS,
        ...OG_IMAGE_POPULATE,
        'populate[sections]': 'true',
      },
    }
  );
  return response?.data || null;
}

/**
 * Fetch all privacy policy page data at once
 */
export async function getPrivacyPolicyPageData(locale: string = 'en') {
  const [
    policyPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  ] = await Promise.all([
    getPrivacyPolicyPage(locale),
    getSiteSettings(locale),
    getNavbarLinks(locale),
    getFooterLinks(locale),
  ]);

  return {
    policyPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  };
}

/**
 * Fetch all terms page data at once
 */
export async function getTermsPageData(locale: string = 'en') {
  const [
    policyPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  ] = await Promise.all([
    getTermsPage(locale),
    getSiteSettings(locale),
    getNavbarLinks(locale),
    getFooterLinks(locale),
  ]);

  return {
    policyPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  };
}

/**
 * Fetch all learning policies page data at once
 */
export async function getLearningPoliciesPageData(locale: string = 'en') {
  const [
    policyPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  ] = await Promise.all([
    getLearningPoliciesPage(locale),
    getSiteSettings(locale),
    getNavbarLinks(locale),
    getFooterLinks(locale),
  ]);

  return {
    policyPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  };
}

/**
 * Fetch all home page data at once (optimized for home page)
 */
export async function getHomePageData(locale: string = 'en') {
  const [
    homePage,
    siteSettings,
    partners,
    featuredCourses,
    instructors,
    testimonials,
    navbarLinks,
    footerLinks,
  ] = await Promise.all([
    getHomePage(locale),
    getSiteSettings(locale),
    getPartners(locale),
    getFeaturedCourses(locale),
    getHomeInstructors(locale),
    getTestimonials(locale),
    getNavbarLinks(locale),
    getFooterLinks(locale),
  ]);

  return {
    homePage,
    siteSettings,
    partners,
    featuredCourses,
    instructors,
    testimonials,
    navbarLinks,
    footerLinks,
  };
}

/**
 * Fetch contact page content
 */
export async function getContactPage(locale: string = 'en'): Promise<ContactPage | null> {
  const response = await fetchStrapi<StrapiSingleResponse<ContactPage>>(
    '/contact-page',
    {
      params: {
        locale,
        ...BLOCKS_POPULATE_PARAMS,
        ...OG_IMAGE_POPULATE,
      },
    }
  );
  return response?.data || null;
}

/**
 * Fetch all contact page data at once
 */
export async function getContactPageData(locale: string = 'en') {
  const [
    contactPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  ] = await Promise.all([
    getContactPage(locale),
    getSiteSettings(locale),
    getNavbarLinks(locale),
    getFooterLinks(locale),
  ]);

  return {
    contactPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  };
}

/**
 * Fetch feedback page content
 */
export async function getFeedbackPage(locale: string = 'en'): Promise<FeedbackPage | null> {
  const response = await fetchStrapi<StrapiSingleResponse<FeedbackPage>>(
    '/feedback-page',
    {
      params: {
        locale,
        ...BLOCKS_POPULATE_PARAMS,
        ...OG_IMAGE_POPULATE,
      },
    }
  );
  return response?.data || null;
}

/**
 * Fetch all feedback page data at once
 */
export async function getFeedbackPageData(locale: string = 'en') {
  const [
    feedbackPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  ] = await Promise.all([
    getFeedbackPage(locale),
    getSiteSettings(locale),
    getNavbarLinks(locale),
    getFooterLinks(locale),
  ]);

  return {
    feedbackPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  };
}

/**
 * Fetch certifications page content
 */
export async function getCertificationsPage(locale: string = 'en'): Promise<CertificationsPage | null> {
  const response = await fetchStrapi<StrapiSingleResponse<CertificationsPage>>(
    '/certifications-page',
    {
      params: {
        locale,
        ...BLOCKS_POPULATE_PARAMS,
        ...OG_IMAGE_POPULATE,
        'populate[nelcLogo]': 'true',
        'populate[scfhsLogo]': 'true',
        'populate[certificateImage]': 'true',
        'populate[steps][populate][icon]': 'true',
      },
    }
  );
  return response?.data || null;
}

/**
 * Fetch all certifications page data at once
 */
export async function getCertificationsPageData(locale: string = 'en') {
  const [
    certificationsPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  ] = await Promise.all([
    getCertificationsPage(locale),
    getSiteSettings(locale),
    getNavbarLinks(locale),
    getFooterLinks(locale),
  ]);

  return {
    certificationsPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  };
}

/**
 * Fetch NELC page content
 */
export async function getNELCPage(locale: string = 'en'): Promise<NELCPage | null> {
  const response = await fetchStrapi<StrapiSingleResponse<NELCPage>>(
    '/nelc-page',
    {
      params: {
        locale,
        ...BLOCKS_POPULATE_PARAMS,
        ...OG_IMAGE_POPULATE,
        'populate[nelcLogo]': 'true',
        'populate[infoBadges]': 'true',
        'populate[complianceCards][populate][image]': 'true',
      },
    }
  );
  return response?.data || null;
}

/**
 * Fetch all NELC page data at once
 */
export async function getNELCPageData(locale: string = 'en') {
  const [
    nelcPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  ] = await Promise.all([
    getNELCPage(locale),
    getSiteSettings(locale),
    getNavbarLinks(locale),
    getFooterLinks(locale),
  ]);

  return {
    nelcPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  };
}

/**
 * Fetch all blog posts
 */
export async function getBlogPosts(locale: string = 'en'): Promise<StrapiBlogPost[]> {
  const response = await fetchStrapi<StrapiResponse<StrapiBlogPost[]>>(
    '/blog-posts',
    {
      params: {
        locale,
        'sort[0]': 'publishedDate:desc',
        'populate[category]': 'true',
        'populate[mainImage]': 'true',
        'pagination[pageSize]': '100',
      },
    }
  );
  return response?.data || [];
}

/**
 * Fetch featured blog post
 */
export async function getFeaturedBlog(locale: string = 'en'): Promise<StrapiBlogPost | null> {
  const response = await fetchStrapi<StrapiResponse<StrapiBlogPost[]>>(
    '/blog-posts',
    {
      params: {
        locale,
        'filters[featured][$eq]': 'true',
        'sort[0]': 'publishedDate:desc',
        'populate[category]': 'true',
        'populate[mainImage]': 'true',
        'pagination[pageSize]': '1',
      },
    }
  );
  const posts = response?.data || [];
  return posts.length > 0 ? posts[0] : null;
}

/**
 * Fetch ALL featured blog posts (for hero carousel).
 * Newest-published first, capped at 10 to keep the hero manageable.
 */
export async function getFeaturedBlogs(locale: string = 'en'): Promise<StrapiBlogPost[]> {
  const response = await fetchStrapi<StrapiResponse<StrapiBlogPost[]>>(
    '/blog-posts',
    {
      params: {
        locale,
        'filters[featured][$eq]': 'true',
        'sort[0]': 'publishedDate:desc',
        'populate[category]': 'true',
        'populate[mainImage]': 'true',
        'pagination[pageSize]': '10',
      },
    }
  );
  return response?.data || [];
}

/**
 * Fetch all blog categories
 */
export async function getBlogCategories(locale: string = 'en'): Promise<StrapiBlogCategory[]> {
  const response = await fetchStrapi<StrapiResponse<StrapiBlogCategory[]>>(
    '/blog-categories',
    {
      params: {
        locale,
        'sort[0]': 'title:asc',
        'pagination[pageSize]': '100',
      },
    }
  );
  return response?.data || [];
}

/**
 * Fetch a single blog post by slug
 */
export async function getBlogBySlug(slug: string, locale: string = 'en'): Promise<StrapiBlogPost | null> {
  const response = await fetchStrapi<StrapiResponse<StrapiBlogPost[]>>(
    '/blog-posts',
    {
      params: {
        locale,
        'filters[slug][$eq]': slug,
        'populate[category]': 'true',
        'populate[mainImage]': 'true',
      },
    }
  );
  const posts = response?.data || [];
  return posts.length > 0 ? posts[0] : null;
}

/**
 * Fetch latest blog posts (for sidebar/related)
 */
export async function getLatestBlogs(locale: string = 'en', limit: number = 3): Promise<StrapiBlogPost[]> {
  const response = await fetchStrapi<StrapiResponse<StrapiBlogPost[]>>(
    '/blog-posts',
    {
      params: {
        locale,
        'sort[0]': 'publishedDate:desc',
        'populate[category]': 'true',
        'populate[mainImage]': 'true',
        'pagination[pageSize]': String(limit),
      },
    }
  );
  return response?.data || [];
}

/**
 * Search blog posts
 */
export async function searchBlogs(query: string, locale: string = 'en'): Promise<StrapiBlogPost[]> {
  const response = await fetchStrapi<StrapiResponse<StrapiBlogPost[]>>(
    '/blog-posts',
    {
      params: {
        locale,
        'filters[$or][0][title][$containsi]': query,
        'filters[$or][1][excerpt][$containsi]': query,
        'sort[0]': 'publishedDate:desc',
        'populate[category]': 'true',
        'populate[mainImage]': 'true',
        'pagination[pageSize]': '100',
      },
    }
  );
  return response?.data || [];
}

/**
 * Fetch blogs-page single type (section labels for blog listing + detail pages)
 */
export async function getBlogsPage(locale: string = 'en'): Promise<BlogsPage | null> {
  const response = await fetchStrapi<StrapiSingleResponse<BlogsPage>>(
    '/blogs-page',
    {
      params: {
        locale,
        ...OG_IMAGE_POPULATE,
      },
    }
  );
  return response?.data || null;
}

/**
 * Fetch all blogs page data at once
 */
export async function getBlogsPageData(locale: string = 'en') {
  const [
    blogPosts,
    featuredBlogs,
    blogCategories,
    blogsPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  ] = await Promise.all([
    getBlogPosts(locale),
    getFeaturedBlogs(locale),
    getBlogCategories(locale),
    getBlogsPage(locale),
    getSiteSettings(locale),
    getNavbarLinks(locale),
    getFooterLinks(locale),
  ]);

  return {
    blogPosts,
    featuredBlogs,
    blogCategories,
    blogsPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  };
}

/**
 * Fetch blog detail page data
 */
export async function getBlogDetailData(slug: string, locale: string = 'en') {
  const [
    blogPost,
    latestBlogs,
    blogsPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  ] = await Promise.all([
    getBlogBySlug(slug, locale),
    getLatestBlogs(locale, 4),
    getBlogsPage(locale),
    getSiteSettings(locale),
    getNavbarLinks(locale),
    getFooterLinks(locale),
  ]);

  return {
    blogPost,
    latestBlogs,
    blogsPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  };
}

/**
 * Fetch partners page content
 */
export async function getPartnersPage(locale: string = 'en'): Promise<PartnersPage | null> {
  const response = await fetchStrapi<StrapiSingleResponse<PartnersPage>>(
    '/partners-page',
    {
      params: {
        locale,
        ...BLOCKS_POPULATE_PARAMS,
        ...OG_IMAGE_POPULATE,
      },
    }
  );
  return response?.data || null;
}

/**
 * Fetch all partners page data at once
 */
export async function getPartnersPageData(locale: string = 'en') {
  const [
    partnersPage,
    partners,
    siteSettings,
    navbarLinks,
    footerLinks,
  ] = await Promise.all([
    getPartnersPage(locale),
    getPartners(locale),
    getSiteSettings(locale),
    getNavbarLinks(locale),
    getFooterLinks(locale),
  ]);

  return {
    partnersPage,
    partners,
    siteSettings,
    navbarLinks,
    footerLinks,
  };
}

/**
 * Fetch instructors page content
 */
export async function getInstructorsPage(locale: string = 'en'): Promise<InstructorsPage | null> {
  const response = await fetchStrapi<StrapiSingleResponse<InstructorsPage>>(
    '/instructors-page',
    {
      params: {
        locale,
        ...BLOCKS_POPULATE_PARAMS,
        ...OG_IMAGE_POPULATE,
      },
    }
  );
  return response?.data || null;
}

/**
 * Fetch all instructors page data at once
 */
export async function getInstructorsPageData(locale: string = 'en') {
  const [
    instructorsPage,
    instructors,
    siteSettings,
    navbarLinks,
    footerLinks,
  ] = await Promise.all([
    getInstructorsPage(locale),
    getAllInstructors(locale),
    getSiteSettings(locale),
    getNavbarLinks(locale),
    getFooterLinks(locale),
  ]);

  return {
    instructorsPage,
    instructors,
    siteSettings,
    navbarLinks,
    footerLinks,
  };
}

/**
 * Fetch FAQ page content
 */
export async function getFAQPage(locale: string = 'en'): Promise<FAQPage | null> {
  const response = await fetchStrapi<StrapiSingleResponse<FAQPage>>(
    '/faq-page',
    {
      params: {
        locale,
        ...BLOCKS_POPULATE_PARAMS,
        ...OG_IMAGE_POPULATE,
        'populate[items]': 'true',
      },
    }
  );
  return response?.data || null;
}

/**
 * Fetch search page text content
 */
export async function getSearchPage(locale: string = 'en'): Promise<SearchPage | null> {
  const response = await fetchStrapi<StrapiSingleResponse<SearchPage>>(
    '/search-page',
    {
      params: {
        locale,
        'populate[popularSearchTerms]': 'true',
      },
    }
  );
  return response?.data || null;
}

/**
 * Fetch all FAQ page data at once
 */
export async function getFAQPageData(locale: string = 'en') {
  const [
    faqPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  ] = await Promise.all([
    getFAQPage(locale),
    getSiteSettings(locale),
    getNavbarLinks(locale),
    getFooterLinks(locale),
  ]);

  return {
    faqPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  };
}

/**
 * Fetch a dynamic page by slug
 */
export async function getDynamicPage(slug: string, locale: string = 'en') {
  const response = await fetchStrapi<StrapiResponse<any[]>>(
    '/pages',
    {
      params: {
        locale,
        'filters[slug][$eq]': slug,
        ...BLOCKS_POPULATE_PARAMS,
      },
    }
  );
  const page = response?.data?.[0] || null;

  const [siteSettings, navbarLinks, footerLinks] = await Promise.all([
    getSiteSettings(locale),
    getNavbarLinks(locale),
    getFooterLinks(locale),
  ]);

  return { page, siteSettings, navbarLinks, footerLinks };
}

/**
 * Fetch Courses Page (listing page content)
 */
export async function getCoursesPage(locale: string = 'en'): Promise<CoursesPage | null> {
  const response = await fetchStrapi<StrapiSingleResponse<CoursesPage>>(
    '/courses-page',
    {
      params: {
        locale,
        ...BLOCKS_POPULATE_PARAMS,
      },
    }
  );
  return response?.data || null;
}

/**
 * Fetch all data for the courses listing page
 */
export async function getCoursesPageData(locale: string = 'en') {
  const [coursesPage, siteSettings, navbarLinks, footerLinks] = await Promise.all([
    getCoursesPage(locale),
    getSiteSettings(locale),
    getNavbarLinks(locale),
    getFooterLinks(locale),
  ]);
  return { coursesPage, siteSettings, navbarLinks, footerLinks };
}

/**
 * Fetch Course Detail Page (global blocks for all course detail pages)
 */
export async function getCourseDetailPage(locale: string = 'en'): Promise<CourseDetailPage | null> {
  const response = await fetchStrapi<StrapiSingleResponse<CourseDetailPage>>(
    '/course-detail-page',
    {
      params: {
        locale,
        ...BLOCKS_POPULATE_PARAMS,
      },
    }
  );
  return response?.data || null;
}
