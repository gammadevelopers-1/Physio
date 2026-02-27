import type { DynamicZoneBlock, SideLoadedData } from '@/lib/strapi/types';
import { HeroBannerBlock } from './HeroBannerBlock';
import { PartnersStripBlock } from './PartnersStripBlock';
import { FeaturedCoursesGridBlock } from './FeaturedCoursesGridBlock';
import { CTABannerBlock } from './CTABannerBlock';
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

/* eslint-disable @typescript-eslint/no-explicit-any */
const BLOCK_COMPONENTS: Record<string, React.ComponentType<any>> = {
  'blocks.hero-banner': HeroBannerBlock,
  'blocks.partners-strip': PartnersStripBlock,
  'blocks.featured-courses-grid': FeaturedCoursesGridBlock,
  'blocks.cta-banner': CTABannerBlock,
  'blocks.instructors-grid': InstructorsGridBlock,
  'blocks.testimonials-carousel': TestimonialsCarouselBlock,
  'blocks.rich-text-block': RichTextBlock,
  'blocks.stats-numbers-block': StatsNumbersBlock,
  'blocks.cards-grid': CardsGridBlock,
  'blocks.video-embed': VideoEmbedBlock,
  'blocks.logo-strip': LogoStripBlock,
  'blocks.faq-accordion': FAQAccordionBlock,
  'blocks.policy-sections-block': PolicySectionsBlock,
  'blocks.contact-form-block': ContactFormBlock,
  'blocks.feedback-form-block': FeedbackFormBlock,
  'blocks.trainer-form-block': TrainerFormBlock,
  'blocks.certification-cards-block': CertificationCardsBlock,
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
