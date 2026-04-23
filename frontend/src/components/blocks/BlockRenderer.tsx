import type { DynamicZoneBlock, SideLoadedData } from '@/lib/strapi/types';
import { HeroBannerBlock } from './HeroBannerBlock';
import { PartnersStripBlock } from './PartnersStripBlock';
import { FeaturedCoursesGridBlock } from './FeaturedCoursesGridBlock';
import { CTABannerBlock } from './CTABannerBlock';
import { ImageBannerBlock } from './ImageBannerBlock';
import { InstructorsGridBlock } from './InstructorsGridBlock';
import { TestimonialsCarouselBlock } from './TestimonialsCarouselBlock';
import { RichTextBlock } from './RichTextBlock';
import { StatsNumbersBlock } from './StatsNumbersBlock';
import { CardsGridBlock } from './CardsGridBlock';
import { VideoEmbedBlock } from './VideoEmbedBlock';
import { LogoStripBlock } from './LogoStripBlock';
import { FAQAccordionBlock } from './FAQAccordionBlock';
import { PolicySectionsBlock } from './PolicySectionsBlock';
import { ContactFormBlock } from './ContactFormBlock';
import { FeedbackFormBlock } from './FeedbackFormBlock';
import { TrainerFormBlock } from './TrainerFormBlock';
import { CertificationCardsBlock } from './CertificationCardsBlock';
import { LiveCounterBlock } from './LiveCounterBlock';
import { AccreditationBadgesBlock } from './AccreditationBadgesBlock';
import { AnchorLinksBlock } from './AnchorLinksBlock';
import { AnnouncementBannerBlock } from './AnnouncementBannerBlock';
import { BeforeAfterBlock } from './BeforeAfterBlock';
import { BlogPostsGridBlock } from './BlogPostsGridBlock';
import { BreadcrumbBlock } from './BreadcrumbBlock';
import { ComparisonTableBlock } from './ComparisonTableBlock';
import { ComplianceBadgeBlock } from './ComplianceBadgeBlock';
import { CountdownTimerBlock } from './CountdownTimerBlock';
import { CoursePreviewBlock } from './CoursePreviewBlock';
import { CpdCalculatorBlock } from './CpdCalculatorBlock';
import { CurriculumOutlineBlock } from './CurriculumOutlineBlock';
import { DownloadResourcesBlock } from './DownloadResourcesBlock';
import { ImageGalleryBlock } from './ImageGalleryBlock';
import { InstructorSpotlightBlock } from './InstructorSpotlightBlock';
import { LearningOutcomesBlock } from './LearningOutcomesBlock';
import { NewsletterBlock } from './NewsletterBlock';
import { PdfViewerBlock } from './PdfViewerBlock';
import { PricingTableBlock } from './PricingTableBlock';
import { RelatedPagesBlock } from './RelatedPagesBlock';
import { SectionHeaderBlock } from './SectionHeaderBlock';
import { SocialFeedBlock } from './SocialFeedBlock';
import { SpacerBlock } from './SpacerBlock';
import { StudentProgressBlock } from './StudentProgressBlock';
import { SuccessStoriesBlock } from './SuccessStoriesBlock';
import { TabsBlock } from './TabsBlock';
import { TimelineBlock } from './TimelineBlock';
import { TreatmentGalleryBlock } from './TreatmentGalleryBlock';
import { UpcomingEventsBlock } from './UpcomingEventsBlock';

/* eslint-disable @typescript-eslint/no-explicit-any */
const BLOCK_COMPONENTS: Record<string, React.ComponentType<any>> = {
  'blocks.hero-banner': HeroBannerBlock,
  'blocks.partners-strip': PartnersStripBlock,
  'blocks.featured-courses-grid': FeaturedCoursesGridBlock,
  'blocks.cta-banner': CTABannerBlock,
  'blocks.image-banner-block': ImageBannerBlock,
  'blocks.instructors-grid': InstructorsGridBlock,
  'blocks.testimonials-carousel': TestimonialsCarouselBlock,
  'blocks.rich-text-block': RichTextBlock,
  'blocks.stats-numbers-block': StatsNumbersBlock,
  'blocks.cards-grid': CardsGridBlock,
  'blocks.video-embed': VideoEmbedBlock,
  'blocks.logo-strip': LogoStripBlock,
  'blocks.faq-accordion': FAQAccordionBlock,
  'blocks.accordion-block': FAQAccordionBlock,
  'blocks.policy-sections-block': PolicySectionsBlock,
  'blocks.contact-form-block': ContactFormBlock,
  'blocks.feedback-form-block': FeedbackFormBlock,
  'blocks.trainer-form-block': TrainerFormBlock,
  'blocks.certification-cards-block': CertificationCardsBlock,
  'blocks.live-counter-block': LiveCounterBlock,
  'blocks.accreditation-badges-block': AccreditationBadgesBlock,
  'blocks.anchor-links-block': AnchorLinksBlock,
  'blocks.announcement-banner-block': AnnouncementBannerBlock,
  'blocks.before-after-block': BeforeAfterBlock,
  'blocks.blog-posts-grid-block': BlogPostsGridBlock,
  'blocks.breadcrumb-block': BreadcrumbBlock,
  'blocks.comparison-table-block': ComparisonTableBlock,
  'blocks.compliance-badge-block': ComplianceBadgeBlock,
  'blocks.countdown-timer-block': CountdownTimerBlock,
  'blocks.course-preview-block': CoursePreviewBlock,
  'blocks.cpd-calculator-block': CpdCalculatorBlock,
  'blocks.curriculum-outline-block': CurriculumOutlineBlock,
  'blocks.download-resources-block': DownloadResourcesBlock,
  'blocks.image-gallery-block': ImageGalleryBlock,
  'blocks.instructor-spotlight-block': InstructorSpotlightBlock,
  'blocks.learning-outcomes-block': LearningOutcomesBlock,
  'blocks.newsletter-block': NewsletterBlock,
  'blocks.pdf-viewer-block': PdfViewerBlock,
  'blocks.pricing-table-block': PricingTableBlock,
  'blocks.related-pages-block': RelatedPagesBlock,
  'blocks.section-header-block': SectionHeaderBlock,
  'blocks.social-feed-block': SocialFeedBlock,
  'blocks.spacer-block': SpacerBlock,
  'blocks.student-progress-block': StudentProgressBlock,
  'blocks.success-stories-block': SuccessStoriesBlock,
  'blocks.tabs-block': TabsBlock,
  'blocks.timeline-block': TimelineBlock,
  'blocks.treatment-gallery-block': TreatmentGalleryBlock,
  'blocks.upcoming-events-block': UpcomingEventsBlock,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

interface BlockRendererProps {
  blocks: DynamicZoneBlock[];
  sideLoadedData: SideLoadedData;
}

export function BlockRenderer({ blocks, sideLoadedData }: BlockRendererProps) {
  if (!blocks || blocks.length === 0) return null;

  return (
    <>
      {blocks.map((block, index) => {
        const Component = BLOCK_COMPONENTS[block.__component];
        if (!Component) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`Unknown block type: ${block.__component}`);
          }
          return null;
        }

        const visibilityClass =
          block.visibility === 'desktop-only'
            ? 'hidden lg:block'
            : block.visibility === 'mobile-only'
              ? 'block lg:hidden'
              : '';

        return visibilityClass ? (
          <div
            key={`${block.__component}-${block.id}-${index}`}
            className={visibilityClass}
          >
            <Component data={block} sideLoadedData={sideLoadedData} />
          </div>
        ) : (
          <Component
            key={`${block.__component}-${block.id}-${index}`}
            data={block}
            sideLoadedData={sideLoadedData}
          />
        );
      })}
    </>
  );
}
