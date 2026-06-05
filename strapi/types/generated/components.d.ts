import type { Schema, Struct } from '@strapi/strapi';

export interface BlocksAccordionBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_accordion_blocks';
  info: {
    description: 'Generic collapsible sections with rich text content';
    displayName: 'Accordion Block';
    icon: 'list';
  };
  attributes: {
    allowMultipleOpen: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    items: Schema.Attribute.Component<'elements.accordion-item', true>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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

export interface BlocksAccreditationBadgesBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_accreditation_badges_blocks';
  info: {
    description: 'Row of certification and accreditation logos with links';
    displayName: 'Accreditation Badges Block';
    icon: 'shield-alt';
  };
  attributes: {
    badgeLinks: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }>;
    badges: Schema.Attribute.Media<'images', true>;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    variant: Schema.Attribute.Enumeration<['row', 'grid']> &
      Schema.Attribute.DefaultTo<'row'>;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

export interface BlocksAnchorLinksBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_anchor_links_blocks';
  info: {
    description: 'In-page navigation with anchor links';
    displayName: 'Anchor Links Block';
    icon: 'anchor';
  };
  attributes: {
    links: Schema.Attribute.Component<'elements.anchor-link-item', true>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    sticky: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    variant: Schema.Attribute.Enumeration<['horizontal', 'vertical']> &
      Schema.Attribute.DefaultTo<'horizontal'>;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

export interface BlocksAnnouncementBannerBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_announcement_banner_blocks';
  info: {
    description: 'Dismissible announcement or promotion banner';
    displayName: 'Announcement Banner Block';
    icon: 'bullhorn';
  };
  attributes: {
    backgroundColor: Schema.Attribute.String;
    dismissible: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    linkLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    linkUrl: Schema.Attribute.String;
    message: Schema.Attribute.Text &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    textColor: Schema.Attribute.String;
    variant: Schema.Attribute.Enumeration<
      ['info', 'warning', 'success', 'promotion']
    > &
      Schema.Attribute.DefaultTo<'info'>;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

export interface BlocksBeforeAfterBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_before_after_blocks';
  info: {
    description: 'Before/after image comparison slider';
    displayName: 'Before After Block';
    icon: 'arrows-alt-h';
  };
  attributes: {
    afterImage: Schema.Attribute.Media<'images'> & Schema.Attribute.Required;
    afterLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }> &
      Schema.Attribute.DefaultTo<'After'>;
    beforeImage: Schema.Attribute.Media<'images'> & Schema.Attribute.Required;
    beforeLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }> &
      Schema.Attribute.DefaultTo<'Before'>;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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

export interface BlocksBlogPostsGridBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_blog_posts_grid_blocks';
  info: {
    description: 'Grid of recent blog posts from Blog Post collection';
    displayName: 'Blog Posts Grid Block';
    icon: 'newspaper';
  };
  attributes: {
    columns: Schema.Attribute.Enumeration<['2', '3']> &
      Schema.Attribute.DefaultTo<'3'>;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    filterByCategory: Schema.Attribute.String;
    maxItems: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<6>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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
    viewAllUrl: Schema.Attribute.String & Schema.Attribute.DefaultTo<'/blog'>;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

export interface BlocksBreadcrumbBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_breadcrumb_blocks';
  info: {
    description: 'Custom breadcrumb trail navigation';
    displayName: 'Breadcrumb Block';
    icon: 'ellipsis-h';
  };
  attributes: {
    items: Schema.Attribute.Component<'elements.button-link', true>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    separator: Schema.Attribute.String & Schema.Attribute.DefaultTo<'/'>;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

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
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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

export interface BlocksComparisonTableBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_comparison_table_blocks';
  info: {
    description: 'Side-by-side plan, course, or certification comparison';
    displayName: 'Comparison Table Block';
    icon: 'columns';
  };
  attributes: {
    columns: Schema.Attribute.Component<'elements.comparison-column', true>;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    featureLabels: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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

export interface BlocksComplianceBadgeBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_compliance_badge_blocks';
  info: {
    description: 'NELC/SCFHS/MOH regulatory compliance visual indicators';
    displayName: 'Compliance Badge Block';
    icon: 'check-double';
  };
  attributes: {
    badges: Schema.Attribute.Component<'elements.compliance-badge-item', true>;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    variant: Schema.Attribute.Enumeration<['row', 'grid', 'detailed']> &
      Schema.Attribute.DefaultTo<'row'>;
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
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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

export interface BlocksCountdownTimerBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_countdown_timer_blocks';
  info: {
    description: 'Countdown timer for deadlines, events, or offers';
    displayName: 'Countdown Timer Block';
    icon: 'hourglass-half';
  };
  attributes: {
    buttons: Schema.Attribute.Component<'elements.button-link', true>;
    daysLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }> &
      Schema.Attribute.DefaultTo<'Days'>;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    expiredMessage: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    hoursLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }> &
      Schema.Attribute.DefaultTo<'Hours'>;
    minutesLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }> &
      Schema.Attribute.DefaultTo<'Minutes'>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    secondsLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }> &
      Schema.Attribute.DefaultTo<'Seconds'>;
    targetDate: Schema.Attribute.DateTime & Schema.Attribute.Required;
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

export interface BlocksCoursePreviewBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_course_preview_blocks';
  info: {
    description: 'Featured single course preview with video, description, and enroll CTA';
    displayName: 'Course Preview Block';
    icon: 'graduation-cap';
  };
  attributes: {
    courseHighlights: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    duration: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    enrollLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    enrollUrl: Schema.Attribute.String;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    previewImage: Schema.Attribute.Media<'images'>;
    previewVideo: Schema.Attribute.Media<'videos'>;
    previewVideoUrl: Schema.Attribute.String;
    price: Schema.Attribute.String &
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

export interface BlocksCpdCalculatorBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_cpd_calculator_blocks';
  info: {
    description: 'Interactive CPD/CME points calculator';
    displayName: 'CPD Calculator Block';
    icon: 'calculator';
  };
  attributes: {
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    disclaimerText: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    pointsLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    tiers: Schema.Attribute.Component<'elements.cpd-tier', true>;
    title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    totalLabel: Schema.Attribute.String &
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
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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

export interface BlocksCurriculumOutlineBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_curriculum_outline_blocks';
  info: {
    description: 'Expandable module and lesson structure';
    displayName: 'Curriculum Outline Block';
    icon: 'sitemap';
  };
  attributes: {
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    modules: Schema.Attribute.Component<'elements.curriculum-module', true>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    totalDuration: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    totalLessons: Schema.Attribute.Integer;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

export interface BlocksDownloadResourcesBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_download_resources_blocks';
  info: {
    description: 'Grid of downloadable files, guides, and whitepapers';
    displayName: 'Download Resources Block';
    icon: 'download';
  };
  attributes: {
    columns: Schema.Attribute.Enumeration<['2', '3', '4']> &
      Schema.Attribute.DefaultTo<'3'>;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    resources: Schema.Attribute.Component<'elements.download-item', true>;
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

export interface BlocksFaQs extends Struct.ComponentSchema {
  collectionName: 'components_blocks_fa_qs';
  info: {
    displayName: 'FAQs';
    icon: 'attachment';
  };
  attributes: {
    faqs: Schema.Attribute.Component<'blocks.faqs', true>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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

export interface BlocksFaqs extends Struct.ComponentSchema {
  collectionName: 'components_blocks_faqs';
  info: {
    displayName: 'FAQS';
  };
  attributes: {
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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

export interface BlocksFeaturedSectionBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_featured_section_blocks';
  info: {
    description: 'Two-column layout: title + description + CTA on one side, image carousel on the other';
    displayName: 'Featured Section Block';
    icon: 'rocket';
  };
  attributes: {
    autoPlay: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    ctaButton: Schema.Attribute.Component<'elements.button-link', false>;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    imagePosition: Schema.Attribute.Enumeration<['left', 'right']> &
      Schema.Attribute.DefaultTo<'right'>;
    images: Schema.Attribute.Media<'images', true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    showArrows: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    showDots: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
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
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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

export interface BlocksImageBannerBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_image_banner_blocks';
  info: {
    description: 'Centered image with an optional button beneath it';
    displayName: 'Image Banner Block';
    icon: 'picture';
  };
  attributes: {
    alignment: Schema.Attribute.Enumeration<['left', 'center', 'right']> &
      Schema.Attribute.DefaultTo<'center'>;
    button: Schema.Attribute.Component<'elements.button-link', false>;
    image: Schema.Attribute.Media<'images'> &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    imageAlt: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    maxWidth: Schema.Attribute.Enumeration<
      ['small', 'medium', 'large', 'full']
    > &
      Schema.Attribute.DefaultTo<'large'>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

export interface BlocksImageGalleryBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_image_gallery_blocks';
  info: {
    description: 'Image gallery with grid or carousel layout';
    displayName: 'Image Gallery Block';
    icon: 'images';
  };
  attributes: {
    columns: Schema.Attribute.Enumeration<['2', '3', '4']> &
      Schema.Attribute.DefaultTo<'3'>;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    enableLightbox: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    images: Schema.Attribute.Media<'images', true> & Schema.Attribute.Required;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    variant: Schema.Attribute.Enumeration<['grid', 'carousel', 'masonry']> &
      Schema.Attribute.DefaultTo<'grid'>;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

export interface BlocksInstructorReviewsBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_instructor_reviews_blocks';
  info: {
    description: 'Shuffled, round-robin sample of approved instructor reviews across all instructors. Limit configurable; fresh shuffle on every page load.';
    displayName: 'Instructor Reviews Block';
    icon: 'user-friends';
  };
  attributes: {
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    limit: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 20;
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<6>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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

export interface BlocksInstructorSpotlightBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_instructor_spotlight_blocks';
  info: {
    description: 'Featured single instructor with bio, credentials, and photo';
    displayName: 'Instructor Spotlight Block';
    icon: 'user-tie';
  };
  attributes: {
    bio: Schema.Attribute.RichText &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    credentials: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    instructorName: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    instructorRole: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    photo: Schema.Attribute.Media<'images'>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    socialLinks: Schema.Attribute.Text;
    title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    variant: Schema.Attribute.Enumeration<['side-by-side', 'centered']> &
      Schema.Attribute.DefaultTo<'side-by-side'>;
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
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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

export interface BlocksLearningOutcomesBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_learning_outcomes_blocks';
  info: {
    description: 'Checkmark list of what students will learn';
    displayName: 'Learning Outcomes Block';
    icon: 'check-circle';
  };
  attributes: {
    columns: Schema.Attribute.Enumeration<['1', '2']> &
      Schema.Attribute.DefaultTo<'2'>;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    icon: Schema.Attribute.Enumeration<
      ['checkmark', 'star', 'arrow', 'bullet']
    > &
      Schema.Attribute.DefaultTo<'checkmark'>;
    outcomes: Schema.Attribute.Component<
      'elements.learning-outcome-item',
      true
    >;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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

export interface BlocksLiveCounterBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_live_counter_blocks';
  info: {
    description: 'Animated counters for key metrics';
    displayName: 'Live Counter Block';
    icon: 'sort-numeric-up';
  };
  attributes: {
    animationDuration: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<2000>;
    backgroundColor: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'#ffffff'>;
    counters: Schema.Attribute.Component<'elements.counter-item', true>;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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

export interface BlocksNewsletterBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_newsletter_blocks';
  info: {
    description: 'Email newsletter signup form with CTA';
    displayName: 'Newsletter Block';
    icon: 'envelope-open';
  };
  attributes: {
    backgroundColor: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'#f8f9fa'>;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    emailPlaceholder: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    privacyNote: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    submitLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    successMessage: Schema.Attribute.String &
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

export interface BlocksPartnersStrip extends Struct.ComponentSchema {
  collectionName: 'components_blocks_partners_strips';
  info: {
    description: 'Marquee carousel of partner logos from Partners collection';
    displayName: 'Partners Strip';
    icon: 'handshake';
  };
  attributes: {
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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

export interface BlocksPdfViewerBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_pdf_viewer_blocks';
  info: {
    description: 'Embedded PDF viewer with download option';
    displayName: 'PDF Viewer Block';
    icon: 'file-pdf';
  };
  attributes: {
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    downloadLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    height: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<600>;
    pdfFile: Schema.Attribute.Media<'files'> & Schema.Attribute.Required;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    showDownloadButton: Schema.Attribute.Boolean &
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
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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

export interface BlocksPricingTableBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_pricing_table_blocks';
  info: {
    description: 'Pricing plans comparison table';
    displayName: 'Pricing Table Block';
    icon: 'tag';
  };
  attributes: {
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    plans: Schema.Attribute.Component<'elements.comparison-column', true>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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

export interface BlocksRelatedPagesBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_related_pages_blocks';
  info: {
    description: 'Curated grid of internal page links with thumbnails';
    displayName: 'Related Pages Block';
    icon: 'th-large';
  };
  attributes: {
    columns: Schema.Attribute.Enumeration<['2', '3', '4']> &
      Schema.Attribute.DefaultTo<'3'>;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    pages: Schema.Attribute.Component<'elements.related-page-item', true>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

export interface BlocksSectionHeaderBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_section_header_blocks';
  info: {
    description: 'Styled section divider with title and subtitle';
    displayName: 'Section Header Block';
    icon: 'heading';
  };
  attributes: {
    alignment: Schema.Attribute.Enumeration<['left', 'center', 'right']> &
      Schema.Attribute.DefaultTo<'center'>;
    anchorId: Schema.Attribute.String;
    headingLevel: Schema.Attribute.Enumeration<['h1', 'h2', 'h3', 'h4']> &
      Schema.Attribute.DefaultTo<'h2'>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    showDivider: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    subtitle: Schema.Attribute.Text &
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

export interface BlocksSocialFeedBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_social_feed_blocks';
  info: {
    description: 'Embedded social media posts feed';
    displayName: 'Social Feed Block';
    icon: 'share-alt';
  };
  attributes: {
    columns: Schema.Attribute.Enumeration<['2', '3', '4']> &
      Schema.Attribute.DefaultTo<'3'>;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    posts: Schema.Attribute.Component<'elements.social-link', true>;
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

export interface BlocksSpacerBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_spacer_blocks';
  info: {
    description: 'Visual spacing or divider between blocks';
    displayName: 'Spacer Block';
    icon: 'arrows-alt-v';
  };
  attributes: {
    dividerColor: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'#e5e7eb'>;
    height: Schema.Attribute.Enumeration<
      ['small', 'medium', 'large', 'extra-large']
    > &
      Schema.Attribute.DefaultTo<'medium'>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    showDivider: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
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
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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

export interface BlocksStudentProgressBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_student_progress_blocks';
  info: {
    description: 'Visual display of student completion rates and pass rates';
    displayName: 'Student Progress Block';
    icon: 'chart-line';
  };
  attributes: {
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    metrics: Schema.Attribute.Component<'elements.progress-metric', true>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    variant: Schema.Attribute.Enumeration<['bars', 'circles', 'numbers']> &
      Schema.Attribute.DefaultTo<'bars'>;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

export interface BlocksSuccessStoriesBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_success_stories_blocks';
  info: {
    description: 'Student/patient case studies and success stories';
    displayName: 'Success Stories Block';
    icon: 'trophy';
  };
  attributes: {
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    stories: Schema.Attribute.Component<'elements.success-story-item', true>;
    title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    variant: Schema.Attribute.Enumeration<['grid', 'carousel']> &
      Schema.Attribute.DefaultTo<'grid'>;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
  };
}

export interface BlocksTabsBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_tabs_blocks';
  info: {
    description: 'Tabbed content sections';
    displayName: 'Tabs Block';
    icon: 'folder';
  };
  attributes: {
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    tabs: Schema.Attribute.Component<'elements.tab-item', true>;
    title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    variant: Schema.Attribute.Enumeration<['horizontal', 'vertical']> &
      Schema.Attribute.DefaultTo<'horizontal'>;
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
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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

export interface BlocksTimelineBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_timeline_blocks';
  info: {
    description: 'Step-by-step timeline or roadmap visualization';
    displayName: 'Timeline Block';
    icon: 'clock';
  };
  attributes: {
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    steps: Schema.Attribute.Component<'elements.timeline-item', true>;
    title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    variant: Schema.Attribute.Enumeration<['vertical', 'horizontal']> &
      Schema.Attribute.DefaultTo<'vertical'>;
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
    bankOptions: Schema.Attribute.Component<'elements.dropdown-option', true>;
    cancelButtonLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    countryCodeOptions: Schema.Attribute.Component<
      'elements.dropdown-option',
      true
    >;
    nationalityOptions: Schema.Attribute.Component<
      'elements.dropdown-option',
      true
    >;
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
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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
    qualificationOptions: Schema.Attribute.Component<
      'elements.dropdown-option',
      true
    >;
    rankOptions: Schema.Attribute.Component<'elements.dropdown-option', true>;
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
    showAcademicRank: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    showBankSection: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    showEmail: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    showFullNameArabic: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    showFullNameEnglish: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    showGender: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    showLinkedIn: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    showMobileNumber: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    showNationalIqamaId: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    showNationality: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    showPhoto: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    showProfession: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    showProfileSection: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    showQualification: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    showResumeSection: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    showScfhsToggle: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    showSpecialty: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    showTwitter: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
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

export interface BlocksTreatmentGalleryBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_treatment_gallery_blocks';
  info: {
    description: 'Categorized visual reference of physiotherapy techniques';
    displayName: 'Treatment Gallery Block';
    icon: 'images';
  };
  attributes: {
    columns: Schema.Attribute.Enumeration<['2', '3', '4']> &
      Schema.Attribute.DefaultTo<'3'>;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    filterByCategory: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    techniques: Schema.Attribute.Component<
      'elements.treatment-technique-item',
      true
    >;
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

export interface BlocksUpcomingEventsBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_upcoming_events_blocks';
  info: {
    description: 'List of upcoming events, webinars, and workshops';
    displayName: 'Upcoming Events Block';
    icon: 'calendar-alt';
  };
  attributes: {
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    emptyMessage: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    events: Schema.Attribute.Component<'elements.event-item', true>;
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    variant: Schema.Attribute.Enumeration<['list', 'grid', 'calendar']> &
      Schema.Attribute.DefaultTo<'list'>;
    viewAllLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    viewAllUrl: Schema.Attribute.String;
    visibility: Schema.Attribute.Enumeration<
      ['all', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'all'>;
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
    position: Schema.Attribute.Enumeration<
      [
        'top',
        'after-section-1',
        'after-section-2',
        'after-section-3',
        'after-section-4',
        'after-section-5',
        'after-section-6',
        'bottom',
      ]
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
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

export interface ElementsAccordionItem extends Struct.ComponentSchema {
  collectionName: 'components_elements_accordion_items';
  info: {
    description: 'A collapsible content section with title and rich text body';
    displayName: 'Accordion Item';
  };
  attributes: {
    content: Schema.Attribute.RichText &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    defaultOpen: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
  };
}

export interface ElementsAnchorLinkItem extends Struct.ComponentSchema {
  collectionName: 'components_elements_anchor_link_items';
  info: {
    description: 'An anchor link for in-page navigation';
    displayName: 'Anchor Link Item';
  };
  attributes: {
    anchorId: Schema.Attribute.String & Schema.Attribute.Required;
    label: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
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

export interface ElementsCertificationsStep extends Struct.ComponentSchema {
  collectionName: 'components_elements_certifications_steps';
  info: {
    description: "A single step in the 'How to Claim CME Hours' flow with icon, title, and description";
    displayName: 'Certifications Step';
  };
  attributes: {
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    icon: Schema.Attribute.Media<'images' | 'files'>;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
  };
}

export interface ElementsComparisonColumn extends Struct.ComponentSchema {
  collectionName: 'components_elements_comparison_columns';
  info: {
    description: 'A column in a comparison table';
    displayName: 'Comparison Column';
  };
  attributes: {
    buttonLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    buttonUrl: Schema.Attribute.String;
    features: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    heading: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    highlighted: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    price: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
  };
}

export interface ElementsComplianceBadgeItem extends Struct.ComponentSchema {
  collectionName: 'components_elements_compliance_badge_items';
  info: {
    description: 'A regulatory compliance badge';
    displayName: 'Compliance Badge Item';
  };
  attributes: {
    badgeImage: Schema.Attribute.Media<'images'>;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    status: Schema.Attribute.Enumeration<['active', 'pending', 'expired']> &
      Schema.Attribute.DefaultTo<'active'>;
    verificationUrl: Schema.Attribute.String;
  };
}

export interface ElementsComplianceCard extends Struct.ComponentSchema {
  collectionName: 'components_elements_compliance_cards';
  info: {
    description: 'A card describing a compliance pillar with image, title, and description';
    displayName: 'Compliance Card';
  };
  attributes: {
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
  };
}

export interface ElementsComplianceItem extends Struct.ComponentSchema {
  collectionName: 'components_elements_compliance_items';
  info: {
    description: 'A single compliance/standard bullet point';
    displayName: 'Compliance Item';
  };
  attributes: {
    text: Schema.Attribute.Text &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
  };
}

export interface ElementsCounterItem extends Struct.ComponentSchema {
  collectionName: 'components_elements_counter_items';
  info: {
    description: 'An animated counter with value, label, and optional suffix';
    displayName: 'Counter Item';
  };
  attributes: {
    icon: Schema.Attribute.String;
    label: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    liveSource: Schema.Attribute.Enumeration<
      ['totalStudents', 'totalCourses', 'totalInstructors']
    >;
    prefix: Schema.Attribute.String &
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
    value: Schema.Attribute.Integer;
  };
}

export interface ElementsCpdTier extends Struct.ComponentSchema {
  collectionName: 'components_elements_cpd_tiers';
  info: {
    description: 'A CPD points tier/category';
    displayName: 'CPD Tier';
  };
  attributes: {
    category: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    points: Schema.Attribute.Integer & Schema.Attribute.Required;
  };
}

export interface ElementsCurriculumModule extends Struct.ComponentSchema {
  collectionName: 'components_elements_curriculum_modules';
  info: {
    description: 'A module in a curriculum outline with lessons';
    displayName: 'Curriculum Module';
  };
  attributes: {
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    duration: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    lessons: Schema.Attribute.Text &
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
  };
}

export interface ElementsDownloadItem extends Struct.ComponentSchema {
  collectionName: 'components_elements_download_items';
  info: {
    description: 'A downloadable resource file';
    displayName: 'Download Item';
  };
  attributes: {
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    file: Schema.Attribute.Media<'files' | 'images'> &
      Schema.Attribute.Required;
    icon: Schema.Attribute.String;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
  };
}

export interface ElementsDropdownOption extends Struct.ComponentSchema {
  collectionName: 'components_elements_dropdown_options';
  info: {
    description: 'A single selectable option for a form dropdown';
    displayName: 'Dropdown Option';
  };
  attributes: {
    label: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    value: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ElementsEventItem extends Struct.ComponentSchema {
  collectionName: 'components_elements_event_items';
  info: {
    description: 'An upcoming event or webinar entry';
    displayName: 'Event Item';
  };
  attributes: {
    date: Schema.Attribute.DateTime & Schema.Attribute.Required;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    endDate: Schema.Attribute.DateTime;
    image: Schema.Attribute.Media<'images'>;
    location: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    registrationUrl: Schema.Attribute.String;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
  };
}

export interface ElementsFeatureItem extends Struct.ComponentSchema {
  collectionName: 'components_elements_feature_items';
  info: {
    description: 'A feature with icon, title, and description';
    displayName: 'Feature Item';
  };
  attributes: {
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    icon: Schema.Attribute.Media<'images' | 'files'>;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
  };
}

export interface ElementsInfoBadge extends Struct.ComponentSchema {
  collectionName: 'components_elements_info_badges';
  info: {
    description: 'A compact label/value pair (e.g., License Number, Status, Valid Through)';
    displayName: 'Info Badge';
  };
  attributes: {
    label: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    value: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
  };
}

export interface ElementsLearningCardItem extends Struct.ComponentSchema {
  collectionName: 'components_elements_learning_card_items';
  info: {
    description: 'A learning experience card with image, title, and optional link';
    displayName: 'Learning Card Item';
  };
  attributes: {
    image: Schema.Attribute.Media<'images'>;
    imageMobile: Schema.Attribute.Media<'images'>;
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

export interface ElementsLearningOutcomeItem extends Struct.ComponentSchema {
  collectionName: 'components_elements_learning_outcome_items';
  info: {
    description: 'A single learning outcome with checkmark';
    displayName: 'Learning Outcome Item';
  };
  attributes: {
    icon: Schema.Attribute.String;
    text: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
  };
}

export interface ElementsPaymentMethodItem extends Struct.ComponentSchema {
  collectionName: 'components_elements_payment_method_items';
  info: {
    description: 'A payment method icon (Visa, Mastercard, etc.)';
    displayName: 'Payment Method';
  };
  attributes: {
    icon: Schema.Attribute.Media<'images'> & Schema.Attribute.Required;
    name: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ElementsProgressMetric extends Struct.ComponentSchema {
  collectionName: 'components_elements_progress_metrics';
  info: {
    description: 'A student progress metric with label and percentage';
    displayName: 'Progress Metric';
  };
  attributes: {
    label: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    maxValue: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<100>;
    suffix: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }> &
      Schema.Attribute.DefaultTo<'%'>;
    value: Schema.Attribute.Integer & Schema.Attribute.Required;
  };
}

export interface ElementsRelatedPageItem extends Struct.ComponentSchema {
  collectionName: 'components_elements_related_page_items';
  info: {
    description: 'A link to a related page with optional thumbnail';
    displayName: 'Related Page Item';
  };
  attributes: {
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    thumbnail: Schema.Attribute.Media<'images'>;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    url: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ElementsSocialLink extends Struct.ComponentSchema {
  collectionName: 'components_elements_social_links';
  info: {
    description: 'A social media embed link';
    displayName: 'Social Link';
  };
  attributes: {
    caption: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    embedUrl: Schema.Attribute.String & Schema.Attribute.Required;
    platform: Schema.Attribute.Enumeration<
      ['instagram', 'twitter', 'linkedin', 'facebook', 'youtube', 'tiktok']
    > &
      Schema.Attribute.Required;
  };
}

export interface ElementsSpecialtyOption extends Struct.ComponentSchema {
  collectionName: 'components_elements_specialty_options';
  info: {
    description: 'A specialty under a profession (e.g. Cardiology under Medicine)';
    displayName: 'Specialty Option';
  };
  attributes: {
    label: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    value: Schema.Attribute.String & Schema.Attribute.Required;
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

export interface ElementsSuccessStoryItem extends Struct.ComponentSchema {
  collectionName: 'components_elements_success_story_items';
  info: {
    description: 'A case study or success story entry';
    displayName: 'Success Story Item';
  };
  attributes: {
    image: Schema.Attribute.Media<'images'>;
    metric: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    metricValue: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    role: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    story: Schema.Attribute.Text &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
  };
}

export interface ElementsTabItem extends Struct.ComponentSchema {
  collectionName: 'components_elements_tab_items';
  info: {
    description: 'A tab with label and rich text content';
    displayName: 'Tab Item';
  };
  attributes: {
    content: Schema.Attribute.RichText &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    icon: Schema.Attribute.String;
    label: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
  };
}

export interface ElementsTimelineItem extends Struct.ComponentSchema {
  collectionName: 'components_elements_timeline_items';
  info: {
    description: 'A step in a timeline or roadmap';
    displayName: 'Timeline Item';
  };
  attributes: {
    date: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    icon: Schema.Attribute.String;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
  };
}

export interface ElementsTreatmentTechniqueItem extends Struct.ComponentSchema {
  collectionName: 'components_elements_treatment_technique_items';
  info: {
    description: 'A physiotherapy treatment technique';
    displayName: 'Treatment Technique Item';
  };
  attributes: {
    category: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    image: Schema.Attribute.Media<'images'>;
    name: Schema.Attribute.String &
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

export interface SharedSearchTerm extends Struct.ComponentSchema {
  collectionName: 'components_shared_search_terms';
  info: {
    description: 'A single popular search term';
    displayName: 'Search Term';
  };
  attributes: {
    term: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedSeo extends Struct.ComponentSchema {
  collectionName: 'components_shared_seos';
  info: {
    description: 'Per-page SEO metadata, Open Graph, Twitter card, canonical URL, and robots noindex toggle';
    displayName: 'SEO';
  };
  attributes: {
    canonicalUrl: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    keywords: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    metaDescription: Schema.Attribute.Text &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 300;
      }>;
    metaTitle: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    noindex: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    ogDescription: Schema.Attribute.Text &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 300;
      }>;
    ogImage: Schema.Attribute.Media<'images'>;
    ogTitle: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    twitterCard: Schema.Attribute.Enumeration<
      ['summary', 'summary_large_image']
    > &
      Schema.Attribute.DefaultTo<'summary_large_image'>;
  };
}

export interface SharedSupportCategory extends Struct.ComponentSchema {
  collectionName: 'components_shared_support_categories';
  info: {
    description: 'A single support-issue category card on the public support page';
    displayName: 'Support Category';
  };
  attributes: {
    backendValue: Schema.Attribute.Enumeration<
      ['technical', 'login', 'billing', 'certificate', 'content', 'other']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'other'>;
    colorClass: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'bg-gray-100 text-gray-600'>;
    description: Schema.Attribute.String;
    iconName: Schema.Attribute.Enumeration<
      [
        'Video',
        'KeyRound',
        'CreditCard',
        'Award',
        'BookOpen',
        'Wrench',
        'HelpCircle',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'HelpCircle'>;
    label: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'blocks.accordion-block': BlocksAccordionBlock;
      'blocks.accreditation-badges-block': BlocksAccreditationBadgesBlock;
      'blocks.anchor-links-block': BlocksAnchorLinksBlock;
      'blocks.announcement-banner-block': BlocksAnnouncementBannerBlock;
      'blocks.before-after-block': BlocksBeforeAfterBlock;
      'blocks.blog-posts-grid-block': BlocksBlogPostsGridBlock;
      'blocks.breadcrumb-block': BlocksBreadcrumbBlock;
      'blocks.cards-grid': BlocksCardsGrid;
      'blocks.certification-cards-block': BlocksCertificationCardsBlock;
      'blocks.comparison-table-block': BlocksComparisonTableBlock;
      'blocks.compliance-badge-block': BlocksComplianceBadgeBlock;
      'blocks.contact-form-block': BlocksContactFormBlock;
      'blocks.countdown-timer-block': BlocksCountdownTimerBlock;
      'blocks.course-preview-block': BlocksCoursePreviewBlock;
      'blocks.cpd-calculator-block': BlocksCpdCalculatorBlock;
      'blocks.cta-banner': BlocksCtaBanner;
      'blocks.curriculum-outline-block': BlocksCurriculumOutlineBlock;
      'blocks.download-resources-block': BlocksDownloadResourcesBlock;
      'blocks.fa-qs': BlocksFaQs;
      'blocks.faq-accordion': BlocksFaqAccordion;
      'blocks.faqs': BlocksFaqs;
      'blocks.featured-courses-grid': BlocksFeaturedCoursesGrid;
      'blocks.featured-section-block': BlocksFeaturedSectionBlock;
      'blocks.feedback-form-block': BlocksFeedbackFormBlock;
      'blocks.hero-banner': BlocksHeroBanner;
      'blocks.image-banner-block': BlocksImageBannerBlock;
      'blocks.image-gallery-block': BlocksImageGalleryBlock;
      'blocks.instructor-reviews-block': BlocksInstructorReviewsBlock;
      'blocks.instructor-spotlight-block': BlocksInstructorSpotlightBlock;
      'blocks.instructors-grid': BlocksInstructorsGrid;
      'blocks.learning-outcomes-block': BlocksLearningOutcomesBlock;
      'blocks.live-counter-block': BlocksLiveCounterBlock;
      'blocks.logo-strip': BlocksLogoStrip;
      'blocks.newsletter-block': BlocksNewsletterBlock;
      'blocks.partners-strip': BlocksPartnersStrip;
      'blocks.pdf-viewer-block': BlocksPdfViewerBlock;
      'blocks.policy-sections-block': BlocksPolicySectionsBlock;
      'blocks.pricing-table-block': BlocksPricingTableBlock;
      'blocks.related-pages-block': BlocksRelatedPagesBlock;
      'blocks.rich-text-block': BlocksRichTextBlock;
      'blocks.section-header-block': BlocksSectionHeaderBlock;
      'blocks.social-feed-block': BlocksSocialFeedBlock;
      'blocks.spacer-block': BlocksSpacerBlock;
      'blocks.stats-numbers-block': BlocksStatsNumbersBlock;
      'blocks.student-progress-block': BlocksStudentProgressBlock;
      'blocks.success-stories-block': BlocksSuccessStoriesBlock;
      'blocks.tabs-block': BlocksTabsBlock;
      'blocks.testimonials-carousel': BlocksTestimonialsCarousel;
      'blocks.timeline-block': BlocksTimelineBlock;
      'blocks.trainer-form-block': BlocksTrainerFormBlock;
      'blocks.treatment-gallery-block': BlocksTreatmentGalleryBlock;
      'blocks.upcoming-events-block': BlocksUpcomingEventsBlock;
      'blocks.video-embed': BlocksVideoEmbed;
      'elements.accordion-item': ElementsAccordionItem;
      'elements.anchor-link-item': ElementsAnchorLinkItem;
      'elements.button-link': ElementsButtonLink;
      'elements.card-item': ElementsCardItem;
      'elements.certifications-step': ElementsCertificationsStep;
      'elements.comparison-column': ElementsComparisonColumn;
      'elements.compliance-badge-item': ElementsComplianceBadgeItem;
      'elements.compliance-card': ElementsComplianceCard;
      'elements.compliance-item': ElementsComplianceItem;
      'elements.counter-item': ElementsCounterItem;
      'elements.cpd-tier': ElementsCpdTier;
      'elements.curriculum-module': ElementsCurriculumModule;
      'elements.download-item': ElementsDownloadItem;
      'elements.dropdown-option': ElementsDropdownOption;
      'elements.event-item': ElementsEventItem;
      'elements.feature-item': ElementsFeatureItem;
      'elements.info-badge': ElementsInfoBadge;
      'elements.learning-card-item': ElementsLearningCardItem;
      'elements.learning-outcome-item': ElementsLearningOutcomeItem;
      'elements.payment-method-item': ElementsPaymentMethodItem;
      'elements.progress-metric': ElementsProgressMetric;
      'elements.related-page-item': ElementsRelatedPageItem;
      'elements.social-link': ElementsSocialLink;
      'elements.specialty-option': ElementsSpecialtyOption;
      'elements.stat-item': ElementsStatItem;
      'elements.success-story-item': ElementsSuccessStoryItem;
      'elements.tab-item': ElementsTabItem;
      'elements.timeline-item': ElementsTimelineItem;
      'elements.treatment-technique-item': ElementsTreatmentTechniqueItem;
      'shared.faq-item': SharedFaqItem;
      'shared.policy-section': SharedPolicySection;
      'shared.search-term': SharedSearchTerm;
      'shared.seo': SharedSeo;
      'shared.support-category': SharedSupportCategory;
    }
  }
}
