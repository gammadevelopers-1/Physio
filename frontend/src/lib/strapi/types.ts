// Strapi API Response Types

export interface StrapiMedia {
  id: number;
  documentId: string;
  name: string;
  alternativeText: string | null;
  caption: string | null;
  width: number;
  height: number;
  formats: {
    thumbnail?: StrapiImageFormat;
    small?: StrapiImageFormat;
    medium?: StrapiImageFormat;
    large?: StrapiImageFormat;
  } | null;
  hash: string;
  ext: string;
  mime: string;
  size: number;
  url: string;
  previewUrl: string | null;
  provider: string;
}

export interface StrapiImageFormat {
  name: string;
  hash: string;
  ext: string;
  mime: string;
  width: number;
  height: number;
  size: number;
  url: string;
}

export interface StrapiResponse<T> {
  data: T;
  meta: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

export interface StrapiSingleResponse<T> {
  data: T;
  meta: Record<string, unknown>;
}

// Content Types

export interface HomePage {
  id: number;
  documentId: string;
  blocks: DynamicZoneBlock[] | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: StrapiMedia | null;
  heroTitle: string;
  heroTitleLine2: string | null;
  heroTitleMobile: string | null;
  heroDescription: string;
  heroButton1Label: string | null;
  heroButton1Link: string | null;
  heroButton2Label: string | null;
  heroButton2Link: string | null;
  partnersSectionTitle: string | null;
  featuredCoursesTitle: string | null;
  featuredCoursesDescription: string | null;
  featuredCoursesViewAllLabel: string | null;
  becomeTrainerTitle: string | null;
  becomeTrainerDescription: string | null;
  becomeTrainerButtonLabel: string | null;
  becomeTrainerButtonLink: string | null;
  instructorsTitle: string | null;
  instructorsDescription: string | null;
  testimonialsTitle: string | null;
  testimonialsDescription: string | null;
  ctaTitle: string | null;
  ctaDescription: string | null;
  ctaButtonLabel: string | null;
  ctaButtonLink: string | null;
  heroVideo: StrapiMedia | null;
  heroVideoMode: "banner" | "widescreen" | "fullFit" | null;
  becomeTrainerImage: StrapiMedia | null;
  ctaBackgroundImage: StrapiMedia | null;
  heroPartnerLogos: StrapiMedia[] | null;
  locale: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface AboutComplianceItem {
  id: number;
  text: string;
}

export interface AboutLearningCardItem {
  id: number;
  title: string;
  linkUrl: string | null;
  image: StrapiMedia | null;
  imageMobile: StrapiMedia | null;
}

export interface AboutFeatureItem {
  id: number;
  title: string;
  description: string | null;
  icon: StrapiMedia | null;
}

export interface AboutPage {
  id: number;
  documentId: string;
  blocks: DynamicZoneBlock[] | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: StrapiMedia | null;
  heroTitle: string | null;
  heroDescription: string | null;
  heroExploreButtonLabel: string | null;
  heroExploreButtonLink: string | null;
  heroGetStartedButtonLabel: string | null;
  heroGetStartedButtonLink: string | null;
  heroImage: StrapiMedia | null;
  heroImageMobile: StrapiMedia | null;
  complianceTitle: string | null;
  complianceItems: AboutComplianceItem[] | null;
  complianceButtonLabel: string | null;
  complianceButtonLink: string | null;
  learningTitle: string | null;
  learningSubtitle: string | null;
  learningCards: AboutLearningCardItem[] | null;
  learningReadMoreLabel: string | null;
  capabilitiesTitle: string | null;
  capabilitiesSubtitle: string | null;
  features: AboutFeatureItem[] | null;
  locale: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface PaymentMethodItem {
  id: number;
  name: string;
  icon: StrapiMedia | null;
}

export interface SiteSettings {
  id: number;
  documentId: string;
  siteName: string;
  footerDescription: string | null;
  copyrightText: string | null;
  whatsappNumber: string | null;
  showSearchBar: boolean | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
  linkedinUrl: string | null;
  facebookUrl: string | null;
  footerPlatformTitle: string | null;
  footerOrganizationTitle: string | null;
  footerSupportTitle: string | null;
  logo: StrapiMedia | null;
  paymentMethods: PaymentMethodItem[] | null;
  themePrimaryColor: string | null;
  themePrimaryDark: string | null;
  themeSurfacePage: string | null;
  themeSurfaceCard: string | null;
  themeTextPrimary: string | null;
  themeTextSecondary: string | null;
  locale: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface Partner {
  id: number;
  documentId: string;
  name: string;
  url: string | null;
  order: number;
  isActive: boolean;
  logo: StrapiMedia;
  locale: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface FeaturedCourse {
  id: number;
  documentId: string;
  title: string;
  description: string | null;
  date: string | null;
  hours: number;
  price: number;
  slug: string;
  courseType: string | null;
  order: number;
  isActive: boolean;
  cmeHoursLabel: string | null;
  viewDetailsLabel: string | null;
  vectorImage: StrapiMedia | null;
  locale: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface Instructor {
  id: number;
  documentId: string;
  name: string;
  title: string | null;
  bio: string | null;
  order: number;
  showOnHomepage: boolean;
  section: "expert" | "minds" | null;
  avatar: StrapiMedia;
  locale: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface Testimonial {
  id: number;
  documentId: string;
  quote: string;
  authorName: string;
  authorRole: string | null;
  order: number;
  isActive: boolean;
  authorImage: StrapiMedia | null;
  locale: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface BecomeTrainerPage {
  id: number;
  documentId: string;
  blocks: DynamicZoneBlock[] | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: StrapiMedia | null;
  pageTitle: string;
  profileSectionTitle: string | null;
  profilePhotoLabel: string | null;
  profileAttachCVLabel: string | null;
  profileFullNameLabel: string | null;
  profileFullNameArabicPlaceholder: string | null;
  profileFullNameEnglishPlaceholder: string | null;
  profileEmailLabel: string | null;
  profileMobileLabel: string | null;
  profileGenderLabel: string | null;
  profileNationalityLabel: string | null;
  profileNationalIdLabel: string | null;
  profileProfessionLabel: string | null;
  profileSpecialityLabel: string | null;
  profileQualificationLabel: string | null;
  profileRankLabel: string | null;
  profileScfhsQuestion: string | null;
  profileTwitterLabel: string | null;
  profileLinkedInLabel: string | null;
  resumeSectionTitle: string | null;
  resumeDescription: string | null;
  resumeUploadLabel: string | null;
  resumeCreateLabel: string | null;
  resumeEducationLabel: string | null;
  resumeProfessionalSkillsLabel: string | null;
  resumeScientificResearchesLabel: string | null;
  resumeTrainingExperienceLabel: string | null;
  resumeClickToUploadLabel: string | null;
  resumeOrDragDropLabel: string | null;
  resumePdfMaxSizeLabel: string | null;
  bankAccountSectionTitle: string | null;
  bankAccountHolderLabel: string | null;
  bankNameLabel: string | null;
  bankIbanLabel: string | null;
  cancelButtonLabel: string | null;
  saveButtonLabel: string | null;
  yesButtonLabel: string | null;
  noButtonLabel: string | null;
  locale: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface PolicySection {
  id: number;
  sectionId: string;
  sidebarLabel: string;
  title: string;
  content: string;
}

export interface PolicyPage {
  id: number;
  documentId: string;
  blocks: DynamicZoneBlock[] | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: StrapiMedia | null;
  title: string;
  lastUpdated: string | null;
  sections: PolicySection[];
  locale: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface ContactPage {
  id: number;
  documentId: string;
  blocks: DynamicZoneBlock[] | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: StrapiMedia | null;
  title: string;
  subtitle: string | null;
  formFullNameLabel: string | null;
  formEmailLabel: string | null;
  formIssueTypeLabel: string | null;
  formSelectOptionLabel: string | null;
  formPhoneLabel: string | null;
  formSubjectLabel: string | null;
  formDescriptionLabel: string | null;
  formCharactersLeftLabel: string | null;
  formSubmitLabel: string | null;
  issueTypeTechnicalSupport: string | null;
  issueTypeBillingIssue: string | null;
  issueTypeCourseInquiry: string | null;
  issueTypePartnership: string | null;
  issueTypeOther: string | null;
  generalInquiryLabel: string | null;
  generalInquiryEmail: string | null;
  technicalSupportLabel: string | null;
  technicalSupportPhone: string | null;
  address: string | null;
  getDirectionsLabel: string | null;
  loadingMapText: string | null;
  mapLatitude: number | null;
  mapLongitude: number | null;
  mapPopupText: string | null;
  showMap: boolean | null;
  locale: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface FeedbackPage {
  id: number;
  documentId: string;
  blocks: DynamicZoneBlock[] | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: StrapiMedia | null;
  title: string;
  description: string | null;
  formFullNameLabel: string | null;
  formEmailLabel: string | null;
  formSubjectLabel: string | null;
  formDescriptionLabel: string | null;
  formCharactersLeftPrefix: string | null;
  formCharactersLeftSuffix: string | null;
  formSubmitLabel: string | null;
  locale: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface CertificationsStepItem {
  id: number;
  title: string;
  description: string | null;
  icon: StrapiMedia | null;
}

export interface CertificationsPage {
  id: number;
  documentId: string;
  blocks: DynamicZoneBlock[] | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: StrapiMedia | null;
  breadcrumb: string | null;
  heroTitle: string | null;
  heroDescription: string | null;
  heroButtonLabel: string | null;
  heroButtonLink: string | null;
  nelcTitle: string | null;
  nelcDescription: string | null;
  nelcLicenseLabel: string | null;
  nelcLicenseNumber: string | null;
  scfhsTitle: string | null;
  scfhsDescription: string | null;
  scfhsAccreditationLabel: string | null;
  scfhsAccreditationNumber: string | null;
  verificationTitle: string | null;
  verificationSubtitle: string | null;
  verificationPlaceholder: string | null;
  verificationButtonLabel: string | null;
  claimCMETitle: string | null;
  steps: CertificationsStepItem[] | null;
  nelcLogo: StrapiMedia | null;
  scfhsLogo: StrapiMedia | null;
  certificateImage: StrapiMedia | null;
  locale: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface NELCInfoBadge {
  id: number;
  label: string;
  value: string | null;
}

export interface NELCComplianceCard {
  id: number;
  title: string;
  description: string | null;
  image: StrapiMedia | null;
}

export interface NELCPage {
  id: number;
  documentId: string;
  blocks: DynamicZoneBlock[] | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: StrapiMedia | null;
  heroTitle: string | null;
  heroDescription: string | null;
  infoBadges: NELCInfoBadge[] | null;
  complianceTitle: string | null;
  complianceDescription: string | null;
  complianceCards: NELCComplianceCard[] | null;
  nelcLogo: StrapiMedia | null;
  locale: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface StrapiBlogCategory {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  locale: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface StrapiBlogPost {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  readTimeMinutes: number;
  featured: boolean;
  publishedDate: string | null;
  authorName: string | null;
  tags: string[] | null;
  category: StrapiBlogCategory | null;
  mainImage: StrapiMedia | null;
  order: number;
  locale: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface NavigationLink {
  id: number;
  documentId: string;
  label: string;
  url: string;
  location: 'navbar' | 'footer-platform' | 'footer-organization' | 'footer-support';
  order: number;
  isActive: boolean;
  hasDropdown: boolean;
  openInNewTab: boolean;
  locale: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface PartnersPage {
  id: number;
  documentId: string;
  blocks: DynamicZoneBlock[] | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: StrapiMedia | null;
  title: string;
  locale: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface InstructorsPage {
  id: number;
  documentId: string;
  blocks: DynamicZoneBlock[] | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: StrapiMedia | null;
  meetExpertsTitle: string | null;
  mindsBehindTitle: string | null;
  locale: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface FAQItem {
  id: number;
  question: string;
  answer: string;
}

export interface FAQPage {
  id: number;
  documentId: string;
  blocks: DynamicZoneBlock[] | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: StrapiMedia | null;
  title: string;
  subtitle: string | null;
  getInTouchLabel: string | null;
  getInTouchLink: string | null;
  items: FAQItem[];
  locale: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface BlogsPage {
  id: number;
  documentId: string;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: StrapiMedia | null;
  featuredBlogsTitle: string | null;
  featuredBlogsSubtitle: string | null;
  blogsTitle: string | null;
  blogsSubtitle: string | null;
  backToAllPostsLabel: string | null;
  publishedByLabel: string | null;
  latestBlogsTitle: string | null;
  latestBlogsSubtitle: string | null;
  locale: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface CoursesPage {
  id: number;
  documentId: string;
  blocks: DynamicZoneBlock[] | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  emptyStateTitle: string | null;
  emptyStateMessage: string | null;
  // CTA section
  ctaTitle: string | null;
  ctaDescription: string | null;
  ctaButtonLabel: string | null;
  ctaButtonHref: string | null;
  // Section visibility
  showSearchBar: boolean | null;
  showDeliveryFilter: boolean | null;
  showPricingFilter: boolean | null;
  showAvailabilityFilter: boolean | null;
  showLanguageFilter: boolean | null;
  showSortBy: boolean | null;
  // Filter chrome labels
  searchPlaceholder: string | null;
  sidebarFilterTitle: string | null;
  filterAllLabel: string | null;
  filterDeliveryLabel: string | null;
  filterZoomLabel: string | null;
  filterOnsiteLabel: string | null;
  filterBlendedLabel: string | null;
  filterSelfPacedLabel: string | null;
  filterPricingLabel: string | null;
  filterFreeLabel: string | null;
  filterPaidLabel: string | null;
  filterAvailabilityLabel: string | null;
  filterAvailOpenLabel: string | null;
  filterAvailStartingSoonLabel: string | null;
  filterAvailFullLabel: string | null;
  filterLanguageLabel: string | null;
  filterLangEnLabel: string | null;
  filterLangArLabel: string | null;
  filterLangBothLabel: string | null;
  filterSortByLabel: string | null;
  filterSortNewestLabel: string | null;
  filterSortRatingLabel: string | null;
  filterSortFeaturedLabel: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  locale: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface CourseDetailPage {
  id: number;
  documentId: string;
  blocks: DynamicZoneBlock[] | null;
  noReviewsText: string | null;
  moreContentText: string | null;
  relatedCoursesTitle: string | null;
  relatedCoursesSubtitle: string | null;
  overviewHeading: string | null;
  objectivesHeading: string | null;
  featuresHeading: string | null;
  contentsHeading: string | null;
  scheduleHeading: string | null;
  requirementsHeading: string | null;
  noticesHeading: string | null;
  reviewsHeading: string | null;
  targetAudienceHeading: string | null;
  courseDetailsHeading: string | null;
  locale: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

// ============================================
// Dynamic Zone Block Types
// ============================================

export type BlockVisibility = 'all' | 'desktop-only' | 'mobile-only';

/** Base interface for all dynamic zone blocks */
export interface BaseBlock {
  id: number;
  __component: string;
  visibility: BlockVisibility;
}

// --- Element (sub-component) types ---

export interface ButtonLink {
  id: number;
  label: string;
  url: string;
  variant: 'primary' | 'secondary' | 'outline';
  openInNewTab: boolean;
}

export interface StatItem {
  id: number;
  value: string;
  label: string;
  suffix: string | null;
}

export interface CardItem {
  id: number;
  title: string;
  description: string | null;
  image: StrapiMedia | null;
  linkUrl: string | null;
  linkLabel: string | null;
}

// --- Generic block types ---

export interface HeroBannerBlockData extends BaseBlock {
  __component: 'blocks.hero-banner';
  title: string;
  titleLine2: string | null;
  titleMobile: string | null;
  description: string;
  backgroundVideo: StrapiMedia | null;
  backgroundImage: StrapiMedia | null;
  buttons: ButtonLink[];
  partnerLogos: StrapiMedia[] | null;
}

export interface PartnersStripBlockData extends BaseBlock {
  __component: 'blocks.partners-strip';
  title: string | null;
}

export interface FeaturedCoursesGridBlockData extends BaseBlock {
  __component: 'blocks.featured-courses-grid';
  title: string | null;
  description: string | null;
  viewAllLabel: string | null;
  viewAllLink: string | null;
  maxItems: number;
}

export interface CTABannerBlockData extends BaseBlock {
  __component: 'blocks.cta-banner';
  title: string;
  description: string | null;
  variant: 'centered' | 'image-left' | 'image-right';
  image: StrapiMedia | null;
  backgroundImage: StrapiMedia | null;
  buttons: ButtonLink[];
}

export interface InstructorsGridBlockData extends BaseBlock {
  __component: 'blocks.instructors-grid';
  title: string | null;
  description: string | null;
  filterSection: 'all' | 'expert' | 'minds';
  showHomepageOnly: boolean;
}

export interface TestimonialsCarouselBlockData extends BaseBlock {
  __component: 'blocks.testimonials-carousel';
  title: string | null;
  description: string | null;
}

export interface RichTextBlockData extends BaseBlock {
  __component: 'blocks.rich-text-block';
  content: string;
  maxWidth: 'narrow' | 'medium' | 'full';
}

export interface StatsNumbersBlockData extends BaseBlock {
  __component: 'blocks.stats-numbers-block';
  title: string | null;
  description: string | null;
  items: StatItem[];
}

export interface CardsGridBlockData extends BaseBlock {
  __component: 'blocks.cards-grid';
  title: string | null;
  description: string | null;
  columns: '2' | '3' | '4';
  cards: CardItem[];
}

export interface VideoEmbedBlockData extends BaseBlock {
  __component: 'blocks.video-embed';
  title: string | null;
  description: string | null;
  videoFile: StrapiMedia | null;
  videoUrl: string | null;
  autoplay: boolean;
}

export interface LogoStripBlockData extends BaseBlock {
  __component: 'blocks.logo-strip';
  title: string | null;
  logos: StrapiMedia[] | null;
  enableMarquee: boolean;
}

export interface FAQAccordionBlockData extends BaseBlock {
  __component: 'blocks.faq-accordion';
  title: string | null;
  subtitle: string | null;
  items: FAQItem[];
}

// --- Page-specific block types ---

export interface PolicySectionsBlockData extends BaseBlock {
  __component: 'blocks.policy-sections-block';
  title: string;
  lastUpdated: string | null;
  sections: PolicySection[];
}

export interface ContactFormBlockData extends BaseBlock {
  __component: 'blocks.contact-form-block';
  title: string;
  subtitle: string | null;
  formFullNameLabel: string | null;
  formEmailLabel: string | null;
  formIssueTypeLabel: string | null;
  formSelectOptionLabel: string | null;
  formPhoneLabel: string | null;
  formSubjectLabel: string | null;
  formDescriptionLabel: string | null;
  formCharactersLeftLabel: string | null;
  formSubmitLabel: string | null;
  issueTypeTechnicalSupport: string | null;
  issueTypeBillingIssue: string | null;
  issueTypeCourseInquiry: string | null;
  issueTypePartnership: string | null;
  issueTypeOther: string | null;
  generalInquiryLabel: string | null;
  generalInquiryEmail: string | null;
  technicalSupportLabel: string | null;
  technicalSupportPhone: string | null;
  address: string | null;
  getDirectionsLabel: string | null;
  loadingMapText: string | null;
  mapLatitude: number | null;
  mapLongitude: number | null;
  mapPopupText: string | null;
}

export interface FeedbackFormBlockData extends BaseBlock {
  __component: 'blocks.feedback-form-block';
  title: string;
  description: string | null;
  formFullNameLabel: string | null;
  formEmailLabel: string | null;
  formSubjectLabel: string | null;
  formDescriptionLabel: string | null;
  formCharactersLeftPrefix: string | null;
  formCharactersLeftSuffix: string | null;
  formSubmitLabel: string | null;
}

export interface TrainerFormBlockData extends BaseBlock {
  __component: 'blocks.trainer-form-block';
  pageTitle: string;
  profileSectionTitle: string | null;
  profilePhotoLabel: string | null;
  profileAttachCVLabel: string | null;
  profileFullNameLabel: string | null;
  profileFullNameArabicPlaceholder: string | null;
  profileFullNameEnglishPlaceholder: string | null;
  profileEmailLabel: string | null;
  profileMobileLabel: string | null;
  profileGenderLabel: string | null;
  profileNationalityLabel: string | null;
  profileNationalIdLabel: string | null;
  profileProfessionLabel: string | null;
  profileSpecialityLabel: string | null;
  profileQualificationLabel: string | null;
  profileRankLabel: string | null;
  profileScfhsQuestion: string | null;
  profileTwitterLabel: string | null;
  profileLinkedInLabel: string | null;
  resumeSectionTitle: string | null;
  resumeDescription: string | null;
  resumeUploadLabel: string | null;
  resumeCreateLabel: string | null;
  resumeEducationLabel: string | null;
  resumeProfessionalSkillsLabel: string | null;
  resumeScientificResearchesLabel: string | null;
  resumeTrainingExperienceLabel: string | null;
  resumeClickToUploadLabel: string | null;
  resumeOrDragDropLabel: string | null;
  resumePdfMaxSizeLabel: string | null;
  bankAccountSectionTitle: string | null;
  bankAccountHolderLabel: string | null;
  bankNameLabel: string | null;
  bankIbanLabel: string | null;
  cancelButtonLabel: string | null;
  saveButtonLabel: string | null;
  yesButtonLabel: string | null;
  noButtonLabel: string | null;
}

export interface CertificationCardsBlockData extends BaseBlock {
  __component: 'blocks.certification-cards-block';
  breadcrumb: string | null;
  heroTitle: string;
  heroDescription: string | null;
  heroButtonLabel: string | null;
  nelcTitle: string | null;
  nelcDescription: string | null;
  nelcLicenseLabel: string | null;
  nelcLicenseNumber: string | null;
  scfhsTitle: string | null;
  scfhsDescription: string | null;
  scfhsAccreditationLabel: string | null;
  scfhsAccreditationNumber: string | null;
  verificationTitle: string | null;
  verificationSubtitle: string | null;
  verificationPlaceholder: string | null;
  verificationButtonLabel: string | null;
  claimCMETitle: string | null;
  steps: CertificationsStepItem[] | null;
  nelcLogo: StrapiMedia | null;
  scfhsLogo: StrapiMedia | null;
  certificateImage: StrapiMedia | null;
}

// --- Union type of all blocks ---

export type DynamicZoneBlock =
  | HeroBannerBlockData
  | PartnersStripBlockData
  | FeaturedCoursesGridBlockData
  | CTABannerBlockData
  | InstructorsGridBlockData
  | TestimonialsCarouselBlockData
  | RichTextBlockData
  | StatsNumbersBlockData
  | CardsGridBlockData
  | VideoEmbedBlockData
  | LogoStripBlockData
  | FAQAccordionBlockData
  | PolicySectionsBlockData
  | ContactFormBlockData
  | FeedbackFormBlockData
  | TrainerFormBlockData
  | CertificationCardsBlockData;

/** Side-loaded collection data passed to block wrappers */
export interface SideLoadedData {
  partners: Partner[];
  featuredCourses: FeaturedCourse[];
  instructors: Instructor[];
  testimonials: Testimonial[];
}

