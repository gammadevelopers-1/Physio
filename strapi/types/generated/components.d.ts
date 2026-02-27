import type { Schema, Struct } from '@strapi/strapi';

export interface BlocksCardsGrid extends Struct.ComponentSchema {
  collectionName: 'components_blocks_cards_grids';
  info: {
    description: 'Grid of content cards';
    displayName: 'Cards Grid';
    icon: 'grid';
  };
  attributes: {
    cards: Schema.Attribute.Component<'elements.card-item', true>;
    columns: Schema.Attribute.Enumeration<['2', '3', '4']> &
      Schema.Attribute.DefaultTo<'3'>;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

export interface BlocksCertificationCardsBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_certification_cards_blocks';
  info: {
    description: 'NELC and SCFHS certification cards with verification';
    displayName: 'Certification Cards Block';
    icon: 'certificate';
  };
  attributes: {
    breadcrumb: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    certificateImage: Schema.Attribute.Media<'images'>;
    claimCMETitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    heroButtonLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    heroDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    heroTitle: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    nelcDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    nelcLicenseLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    nelcLicenseNumber: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }>;
    nelcLogo: Schema.Attribute.Media<'images'>;
    nelcTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    scfhsAccreditationLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    scfhsAccreditationNumber: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }>;
    scfhsDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    scfhsLogo: Schema.Attribute.Media<'images'>;
    scfhsTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    step1Description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    step1Title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    step2Description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    step2Title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    step3Description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    step3Title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    verificationButtonLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    verificationPlaceholder: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }>;
    verificationSubtitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    verificationTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

export interface BlocksContactFormBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_contact_form_blocks';
  info: {
    description: 'Contact form with issue types, contact info, and map';
    displayName: 'Contact Form Block';
    icon: 'envelope';
  };
  attributes: {
    address: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    formCharactersLeftLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    formDescriptionLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    formEmailLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    formFullNameLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    formIssueTypeLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    formPhoneLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    formSelectOptionLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    formSubjectLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    formSubmitLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    generalInquiryEmail: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }>;
    generalInquiryLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    getDirectionsLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    issueTypeBillingIssue: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    issueTypeCourseInquiry: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    issueTypeOther: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    issueTypePartnership: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    issueTypeTechnicalSupport: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    loadingMapText: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    mapLatitude: Schema.Attribute.Float &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }>;
    mapLongitude: Schema.Attribute.Float &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }>;
    mapPopupText: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    subtitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    technicalSupportLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    technicalSupportPhone: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }>;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

export interface BlocksCtaBanner extends Struct.ComponentSchema {
  collectionName: 'components_blocks_cta_banners';
  info: {
    description: 'Call-to-action section with text, image, and button';
    displayName: 'CTA Banner';
    icon: 'megaphone';
  };
  attributes: {
    backgroundImage: Schema.Attribute.Media<'images'>;
    buttons: Schema.Attribute.Component<'elements.button-link', true>;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    image: Schema.Attribute.Media<'images'>;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    variant: Schema.Attribute.Enumeration<
      ['centered', 'image-left', 'image-right']
    > &
      Schema.Attribute.DefaultTo<'centered'>;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

export interface BlocksFaqAccordion extends Struct.ComponentSchema {
  collectionName: 'components_blocks_faq_accordions';
  info: {
    description: 'Frequently asked questions accordion';
    displayName: 'FAQ Accordion';
    icon: 'question-circle';
  };
  attributes: {
    items: Schema.Attribute.Component<'shared.faq-item', true>;
    subtitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

export interface BlocksFeaturedCoursesGrid extends Struct.ComponentSchema {
  collectionName: 'components_blocks_featured_courses_grids';
  info: {
    description: 'Grid display of featured courses from collection';
    displayName: 'Featured Courses Grid';
    icon: 'book';
  };
  attributes: {
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    maxItems: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<4>;
    title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    viewAllLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    viewAllLink: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'/courses'>;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

export interface BlocksFeedbackFormBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_feedback_form_blocks';
  info: {
    description: 'Feedback submission form with configurable labels';
    displayName: 'Feedback Form Block';
    icon: 'comment';
  };
  attributes: {
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    formCharactersLeftPrefix: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    formCharactersLeftSuffix: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    formDescriptionLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    formEmailLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    formFullNameLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    formSubjectLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    formSubmitLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

export interface BlocksHeroBanner extends Struct.ComponentSchema {
  collectionName: 'components_blocks_hero_banners';
  info: {
    description: 'Full-width hero section with video/image background';
    displayName: 'Hero Banner';
    icon: 'star';
  };
  attributes: {
    backgroundImage: Schema.Attribute.Media<'images'>;
    backgroundVideo: Schema.Attribute.Media<'videos'>;
    buttons: Schema.Attribute.Component<'elements.button-link', true>;
    description: Schema.Attribute.Text &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    partnerLogos: Schema.Attribute.Media<'images', true>;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    titleLine2: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    titleMobile: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

export interface BlocksInstructorsGrid extends Struct.ComponentSchema {
  collectionName: 'components_blocks_instructors_grids';
  info: {
    description: 'Grid of instructor avatars from Instructors collection';
    displayName: 'Instructors Grid';
    icon: 'users';
  };
  attributes: {
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    filterSection: Schema.Attribute.Enumeration<['all', 'expert', 'minds']> &
      Schema.Attribute.DefaultTo<'all'>;
    showHomepageOnly: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

export interface BlocksLogoStrip extends Struct.ComponentSchema {
  collectionName: 'components_blocks_logo_strips';
  info: {
    description: 'A strip of logo images in grid or marquee';
    displayName: 'Logo Strip';
    icon: 'image';
  };
  attributes: {
    enableMarquee: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    logos: Schema.Attribute.Media<'images', true>;
    title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

export interface BlocksPartnersStrip extends Struct.ComponentSchema {
  collectionName: 'components_blocks_partners_strips';
  info: {
    description: 'Marquee carousel of partner logos from Partners collection';
    displayName: 'Partners Strip';
    icon: 'handshake';
  };
  attributes: {
    title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

export interface BlocksPolicySectionsBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_policy_sections_blocks';
  info: {
    description: 'Policy page with sidebar navigation and rich text sections';
    displayName: 'Policy Sections Block';
    icon: 'file-text';
  };
  attributes: {
    lastUpdated: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    sections: Schema.Attribute.Component<'shared.policy-section', true>;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

export interface BlocksRichTextBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_rich_text_blocks';
  info: {
    description: 'Free-form rich text content section';
    displayName: 'Rich Text Block';
    icon: 'file-text';
  };
  attributes: {
    content: Schema.Attribute.RichText &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    maxWidth: Schema.Attribute.Enumeration<['narrow', 'medium', 'full']> &
      Schema.Attribute.DefaultTo<'medium'>;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

export interface BlocksStatsNumbersBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_stats_numbers_blocks';
  info: {
    description: 'Display statistics or key numbers';
    displayName: 'Stats / Numbers Block';
    icon: 'chart-bar';
  };
  attributes: {
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    items: Schema.Attribute.Component<'elements.stat-item', true>;
    title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

export interface BlocksTestimonialsCarousel extends Struct.ComponentSchema {
  collectionName: 'components_blocks_testimonials_carousels';
  info: {
    description: 'Carousel of customer testimonials from collection';
    displayName: 'Testimonials Carousel';
    icon: 'quote';
  };
  attributes: {
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

export interface BlocksTrainerFormBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_trainer_form_blocks';
  info: {
    description: 'Become a Trainer registration form with configurable labels';
    displayName: 'Trainer Form Block';
    icon: 'user-plus';
  };
  attributes: {
    bankAccountHolderLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    bankAccountSectionTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    bankIbanLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    bankNameLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    cancelButtonLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    noButtonLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    pageTitle: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    profileAttachCVLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    profileEmailLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    profileFullNameArabicPlaceholder: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    profileFullNameEnglishPlaceholder: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    profileFullNameLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    profileGenderLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    profileLinkedInLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    profileMobileLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    profileNationalIdLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    profileNationalityLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    profilePhotoLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    profileProfessionLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    profileQualificationLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    profileRankLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    profileScfhsQuestion: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    profileSectionTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    profileSpecialityLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    profileTwitterLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    resumeClickToUploadLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    resumeCreateLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    resumeDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    resumeEducationLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    resumeOrDragDropLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    resumePdfMaxSizeLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    resumeProfessionalSkillsLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    resumeScientificResearchesLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    resumeSectionTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    resumeTrainingExperienceLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    resumeUploadLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    saveButtonLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
    yesButtonLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
  };
}

export interface BlocksVideoEmbed extends Struct.ComponentSchema {
  collectionName: 'components_blocks_video_embeds';
  info: {
    description: 'Embedded video section with optional title';
    displayName: 'Video Embed';
    icon: 'play';
  };
  attributes: {
    autoplay: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    videoFile: Schema.Attribute.Media<'videos'>;
    videoUrl: Schema.Attribute.String;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

export interface ElementsButtonLink extends Struct.ComponentSchema {
  collectionName: 'components_elements_button_links';
  info: {
    description: 'A clickable button with a link';
    displayName: 'Button Link';
  };
  attributes: {
    label: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    openInNewTab: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    url: Schema.Attribute.String & Schema.Attribute.Required;
    variant: Schema.Attribute.Enumeration<['primary', 'secondary', 'outline']> &
      Schema.Attribute.DefaultTo<'primary'>;
  };
}

export interface ElementsCardItem extends Struct.ComponentSchema {
  collectionName: 'components_elements_card_items';
  info: {
    description: 'A content card with title, description, and optional image';
    displayName: 'Card Item';
  };
  attributes: {
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    image: Schema.Attribute.Media<'images'>;
    linkLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    linkUrl: Schema.Attribute.String;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
  };
}

export interface ElementsStatItem extends Struct.ComponentSchema {
  collectionName: 'components_elements_stat_items';
  info: {
    description: 'A statistic with value and label';
    displayName: 'Stat Item';
  };
  attributes: {
    label: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    suffix: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    value: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
  };
}

export interface SharedFaqItem extends Struct.ComponentSchema {
  collectionName: 'components_shared_faq_items';
  info: {
    displayName: 'FAQ Item';
  };
  attributes: {
    answer: Schema.Attribute.Text & Schema.Attribute.Required;
    question: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedPolicySection extends Struct.ComponentSchema {
  collectionName: 'components_shared_policy_sections';
  info: {
    displayName: 'Policy Section';
  };
  attributes: {
    content: Schema.Attribute.RichText & Schema.Attribute.Required;
    sectionId: Schema.Attribute.String & Schema.Attribute.Required;
    sidebarLabel: Schema.Attribute.String & Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'blocks.cards-grid': BlocksCardsGrid;
      'blocks.certification-cards-block': BlocksCertificationCardsBlock;
      'blocks.contact-form-block': BlocksContactFormBlock;
      'blocks.cta-banner': BlocksCtaBanner;
      'blocks.faq-accordion': BlocksFaqAccordion;
      'blocks.featured-courses-grid': BlocksFeaturedCoursesGrid;
      'blocks.feedback-form-block': BlocksFeedbackFormBlock;
      'blocks.hero-banner': BlocksHeroBanner;
      'blocks.instructors-grid': BlocksInstructorsGrid;
      'blocks.logo-strip': BlocksLogoStrip;
      'blocks.partners-strip': BlocksPartnersStrip;
      'blocks.policy-sections-block': BlocksPolicySectionsBlock;
      'blocks.rich-text-block': BlocksRichTextBlock;
      'blocks.stats-numbers-block': BlocksStatsNumbersBlock;
      'blocks.testimonials-carousel': BlocksTestimonialsCarousel;
      'blocks.trainer-form-block': BlocksTrainerFormBlock;
      'blocks.video-embed': BlocksVideoEmbed;
      'elements.button-link': ElementsButtonLink;
      'elements.card-item': ElementsCardItem;
      'elements.stat-item': ElementsStatItem;
      'shared.faq-item': SharedFaqItem;
      'shared.policy-section': SharedPolicySection;
    }
  }
}
