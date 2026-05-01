import type { Schema, Struct } from '@strapi/strapi';

export interface AdminApiToken extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_api_tokens';
  info: {
    description: '';
    displayName: 'Api Token';
    name: 'Api Token';
    pluralName: 'api-tokens';
    singularName: 'api-token';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Schema.Attribute.DefaultTo<''>;
    encryptedKey: Schema.Attribute.Text &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    expiresAt: Schema.Attribute.DateTime;
    lastUsedAt: Schema.Attribute.DateTime;
    lifespan: Schema.Attribute.BigInteger;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::api-token'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::api-token-permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.Enumeration<['read-only', 'full-access', 'custom']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'read-only'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminApiTokenPermission extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_api_token_permissions';
  info: {
    description: '';
    displayName: 'API Token Permission';
    name: 'API Token Permission';
    pluralName: 'api-token-permissions';
    singularName: 'api-token-permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::api-token-permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    token: Schema.Attribute.Relation<'manyToOne', 'admin::api-token'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminPermission extends Struct.CollectionTypeSchema {
  collectionName: 'admin_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'Permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    actionParameters: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    conditions: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<[]>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::permission'> &
      Schema.Attribute.Private;
    properties: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<'manyToOne', 'admin::role'>;
    subject: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminRole extends Struct.CollectionTypeSchema {
  collectionName: 'admin_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'Role';
    pluralName: 'roles';
    singularName: 'role';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::role'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<'oneToMany', 'admin::permission'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users: Schema.Attribute.Relation<'manyToMany', 'admin::user'>;
  };
}

export interface AdminSession extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_sessions';
  info: {
    description: 'Session Manager storage';
    displayName: 'Session';
    name: 'Session';
    pluralName: 'sessions';
    singularName: 'session';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
    i18n: {
      localized: false;
    };
  };
  attributes: {
    absoluteExpiresAt: Schema.Attribute.DateTime & Schema.Attribute.Private;
    childId: Schema.Attribute.String & Schema.Attribute.Private;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    deviceId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    expiresAt: Schema.Attribute.DateTime &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::session'> &
      Schema.Attribute.Private;
    origin: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    sessionId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique;
    status: Schema.Attribute.String & Schema.Attribute.Private;
    type: Schema.Attribute.String & Schema.Attribute.Private;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    userId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
  };
}

export interface AdminTransferToken extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_transfer_tokens';
  info: {
    description: '';
    displayName: 'Transfer Token';
    name: 'Transfer Token';
    pluralName: 'transfer-tokens';
    singularName: 'transfer-token';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Schema.Attribute.DefaultTo<''>;
    expiresAt: Schema.Attribute.DateTime;
    lastUsedAt: Schema.Attribute.DateTime;
    lifespan: Schema.Attribute.BigInteger;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token-permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminTransferTokenPermission
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_transfer_token_permissions';
  info: {
    description: '';
    displayName: 'Transfer Token Permission';
    name: 'Transfer Token Permission';
    pluralName: 'transfer-token-permissions';
    singularName: 'transfer-token-permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token-permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    token: Schema.Attribute.Relation<'manyToOne', 'admin::transfer-token'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminUser extends Struct.CollectionTypeSchema {
  collectionName: 'admin_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'User';
    pluralName: 'users';
    singularName: 'user';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    blocked: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    firstname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    lastname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::user'> &
      Schema.Attribute.Private;
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    preferedLanguage: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    registrationToken: Schema.Attribute.String & Schema.Attribute.Private;
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private;
    roles: Schema.Attribute.Relation<'manyToMany', 'admin::role'> &
      Schema.Attribute.Private;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String;
  };
}

export interface ApiAboutPageAboutPage extends Struct.SingleTypeSchema {
  collectionName: 'about_pages';
  info: {
    description: 'About page content management';
    displayName: 'About Page';
    pluralName: 'about-pages';
    singularName: 'about-page';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    blocks: Schema.Attribute.DynamicZone<
      [
        'blocks.accordion-block',
        'blocks.accreditation-badges-block',
        'blocks.anchor-links-block',
        'blocks.announcement-banner-block',
        'blocks.before-after-block',
        'blocks.blog-posts-grid-block',
        'blocks.breadcrumb-block',
        'blocks.cards-grid',
        'blocks.certification-cards-block',
        'blocks.comparison-table-block',
        'blocks.compliance-badge-block',
        'blocks.contact-form-block',
        'blocks.countdown-timer-block',
        'blocks.course-preview-block',
        'blocks.cpd-calculator-block',
        'blocks.cta-banner',
        'blocks.curriculum-outline-block',
        'blocks.download-resources-block',
        'blocks.faq-accordion',
        'blocks.featured-courses-grid',
        'blocks.feedback-form-block',
        'blocks.hero-banner',
        'blocks.image-gallery-block',
        'blocks.instructor-spotlight-block',
        'blocks.instructors-grid',
        'blocks.learning-outcomes-block',
        'blocks.live-counter-block',
        'blocks.logo-strip',
        'blocks.newsletter-block',
        'blocks.partners-strip',
        'blocks.pdf-viewer-block',
        'blocks.policy-sections-block',
        'blocks.pricing-table-block',
        'blocks.related-pages-block',
        'blocks.rich-text-block',
        'blocks.section-header-block',
        'blocks.social-feed-block',
        'blocks.spacer-block',
        'blocks.stats-numbers-block',
        'blocks.student-progress-block',
        'blocks.success-stories-block',
        'blocks.tabs-block',
        'blocks.testimonials-carousel',
        'blocks.timeline-block',
        'blocks.trainer-form-block',
        'blocks.treatment-gallery-block',
        'blocks.upcoming-events-block',
        'blocks.image-banner-block',
        'blocks.video-embed',
      ]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    capabilitiesSubtitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    capabilitiesTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    complianceButtonLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    complianceButtonLink: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }>;
    complianceItems: Schema.Attribute.Component<
      'elements.compliance-item',
      true
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    complianceTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    features: Schema.Attribute.Component<'elements.feature-item', true> &
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
    heroExploreButtonLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    heroExploreButtonLink: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }>;
    heroGetStartedButtonLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    heroGetStartedButtonLink: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }>;
    heroImage: Schema.Attribute.Media<'images'>;
    heroImageMobile: Schema.Attribute.Media<'images'>;
    heroTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    learningCards: Schema.Attribute.Component<
      'elements.learning-card-item',
      true
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    learningReadMoreLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    learningSubtitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    learningTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    locale: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::about-page.about-page'
    >;
    metaDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    metaTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    ogImage: Schema.Attribute.Media<'images'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiBecomeTrainerPageBecomeTrainerPage
  extends Struct.SingleTypeSchema {
  collectionName: 'become_trainer_pages';
  info: {
    description: 'Become a Trainer page content management';
    displayName: 'Become Trainer Page';
    pluralName: 'become-trainer-pages';
    singularName: 'become-trainer-page';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
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
    blocks: Schema.Attribute.DynamicZone<
      [
        'blocks.accordion-block',
        'blocks.accreditation-badges-block',
        'blocks.anchor-links-block',
        'blocks.announcement-banner-block',
        'blocks.before-after-block',
        'blocks.blog-posts-grid-block',
        'blocks.breadcrumb-block',
        'blocks.cards-grid',
        'blocks.certification-cards-block',
        'blocks.comparison-table-block',
        'blocks.compliance-badge-block',
        'blocks.contact-form-block',
        'blocks.countdown-timer-block',
        'blocks.course-preview-block',
        'blocks.cpd-calculator-block',
        'blocks.cta-banner',
        'blocks.curriculum-outline-block',
        'blocks.download-resources-block',
        'blocks.faq-accordion',
        'blocks.featured-courses-grid',
        'blocks.feedback-form-block',
        'blocks.hero-banner',
        'blocks.image-gallery-block',
        'blocks.instructor-spotlight-block',
        'blocks.instructors-grid',
        'blocks.learning-outcomes-block',
        'blocks.live-counter-block',
        'blocks.logo-strip',
        'blocks.newsletter-block',
        'blocks.partners-strip',
        'blocks.pdf-viewer-block',
        'blocks.policy-sections-block',
        'blocks.pricing-table-block',
        'blocks.related-pages-block',
        'blocks.rich-text-block',
        'blocks.section-header-block',
        'blocks.social-feed-block',
        'blocks.spacer-block',
        'blocks.stats-numbers-block',
        'blocks.student-progress-block',
        'blocks.success-stories-block',
        'blocks.tabs-block',
        'blocks.testimonials-carousel',
        'blocks.timeline-block',
        'blocks.trainer-form-block',
        'blocks.treatment-gallery-block',
        'blocks.upcoming-events-block',
        'blocks.image-banner-block',
        'blocks.video-embed',
      ]
    > &
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
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::become-trainer-page.become-trainer-page'
    >;
    metaDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    metaTitle: Schema.Attribute.String &
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
    ogImage: Schema.Attribute.Media<'images'>;
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
    publishedAt: Schema.Attribute.DateTime;
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
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    yesButtonLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
  };
}

export interface ApiBlogCategoryBlogCategory
  extends Struct.CollectionTypeSchema {
  collectionName: 'blog_categories';
  info: {
    description: 'Blog post categories';
    displayName: 'Blog Category';
    pluralName: 'blog-categories';
    singularName: 'blog-category';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::blog-category.blog-category'
    >;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiBlogPostBlogPost extends Struct.CollectionTypeSchema {
  collectionName: 'blog_posts';
  info: {
    description: 'Blog posts with rich content';
    displayName: 'Blog Post';
    pluralName: 'blog-posts';
    singularName: 'blog-post';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    authorName: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    category: Schema.Attribute.Relation<
      'manyToOne',
      'api::blog-category.blog-category'
    >;
    content: Schema.Attribute.RichText &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    excerpt: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    featured: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::blog-post.blog-post'
    >;
    mainImage: Schema.Attribute.Media<'images'>;
    order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    publishedDate: Schema.Attribute.Date;
    readTimeMinutes: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<5>;
    slug: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    tags: Schema.Attribute.JSON;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiBlogsPageBlogsPage extends Struct.SingleTypeSchema {
  collectionName: 'blogs_pages';
  info: {
    description: 'Section labels and metadata for the public blogs listing and blog detail pages';
    displayName: 'Blogs Page';
    pluralName: 'blogs-pages';
    singularName: 'blogs-page';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    backToAllPostsLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    blogsSubtitle: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    blogsTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    featuredBlogsSubtitle: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    featuredBlogsTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    latestBlogsSubtitle: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    latestBlogsTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    locale: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::blogs-page.blogs-page'
    >;
    metaDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    metaTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    ogImage: Schema.Attribute.Media<'images'>;
    publishedAt: Schema.Attribute.DateTime;
    publishedByLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCertificationsPageCertificationsPage
  extends Struct.SingleTypeSchema {
  collectionName: 'certifications_pages';
  info: {
    displayName: 'Certifications Page';
    pluralName: 'certifications-pages';
    singularName: 'certifications-page';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    blocks: Schema.Attribute.DynamicZone<
      [
        'blocks.accordion-block',
        'blocks.accreditation-badges-block',
        'blocks.anchor-links-block',
        'blocks.announcement-banner-block',
        'blocks.before-after-block',
        'blocks.blog-posts-grid-block',
        'blocks.breadcrumb-block',
        'blocks.cards-grid',
        'blocks.certification-cards-block',
        'blocks.comparison-table-block',
        'blocks.compliance-badge-block',
        'blocks.contact-form-block',
        'blocks.countdown-timer-block',
        'blocks.course-preview-block',
        'blocks.cpd-calculator-block',
        'blocks.cta-banner',
        'blocks.curriculum-outline-block',
        'blocks.download-resources-block',
        'blocks.faq-accordion',
        'blocks.featured-courses-grid',
        'blocks.feedback-form-block',
        'blocks.hero-banner',
        'blocks.image-gallery-block',
        'blocks.instructor-spotlight-block',
        'blocks.instructors-grid',
        'blocks.learning-outcomes-block',
        'blocks.live-counter-block',
        'blocks.logo-strip',
        'blocks.newsletter-block',
        'blocks.partners-strip',
        'blocks.pdf-viewer-block',
        'blocks.policy-sections-block',
        'blocks.pricing-table-block',
        'blocks.related-pages-block',
        'blocks.rich-text-block',
        'blocks.section-header-block',
        'blocks.social-feed-block',
        'blocks.spacer-block',
        'blocks.stats-numbers-block',
        'blocks.student-progress-block',
        'blocks.success-stories-block',
        'blocks.tabs-block',
        'blocks.testimonials-carousel',
        'blocks.timeline-block',
        'blocks.trainer-form-block',
        'blocks.treatment-gallery-block',
        'blocks.upcoming-events-block',
        'blocks.image-banner-block',
        'blocks.video-embed',
      ]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
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
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    heroButtonLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    heroButtonLink: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
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
    locale: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::certifications-page.certifications-page'
    >;
    metaDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    metaTitle: Schema.Attribute.String &
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
    ogImage: Schema.Attribute.Media<'images'>;
    publishedAt: Schema.Attribute.DateTime;
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
    steps: Schema.Attribute.Component<'elements.certifications-step', true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
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
  };
}

export interface ApiContactPageContactPage extends Struct.SingleTypeSchema {
  collectionName: 'contact_pages';
  info: {
    displayName: 'Contact Page';
    pluralName: 'contact-pages';
    singularName: 'contact-page';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    address: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    blocks: Schema.Attribute.DynamicZone<
      [
        'blocks.accordion-block',
        'blocks.accreditation-badges-block',
        'blocks.anchor-links-block',
        'blocks.announcement-banner-block',
        'blocks.before-after-block',
        'blocks.blog-posts-grid-block',
        'blocks.breadcrumb-block',
        'blocks.cards-grid',
        'blocks.certification-cards-block',
        'blocks.comparison-table-block',
        'blocks.compliance-badge-block',
        'blocks.contact-form-block',
        'blocks.countdown-timer-block',
        'blocks.course-preview-block',
        'blocks.cpd-calculator-block',
        'blocks.cta-banner',
        'blocks.curriculum-outline-block',
        'blocks.download-resources-block',
        'blocks.faq-accordion',
        'blocks.featured-courses-grid',
        'blocks.feedback-form-block',
        'blocks.hero-banner',
        'blocks.image-gallery-block',
        'blocks.instructor-spotlight-block',
        'blocks.instructors-grid',
        'blocks.learning-outcomes-block',
        'blocks.live-counter-block',
        'blocks.logo-strip',
        'blocks.newsletter-block',
        'blocks.partners-strip',
        'blocks.pdf-viewer-block',
        'blocks.policy-sections-block',
        'blocks.pricing-table-block',
        'blocks.related-pages-block',
        'blocks.rich-text-block',
        'blocks.section-header-block',
        'blocks.social-feed-block',
        'blocks.spacer-block',
        'blocks.stats-numbers-block',
        'blocks.student-progress-block',
        'blocks.success-stories-block',
        'blocks.tabs-block',
        'blocks.testimonials-carousel',
        'blocks.timeline-block',
        'blocks.trainer-form-block',
        'blocks.treatment-gallery-block',
        'blocks.upcoming-events-block',
        'blocks.image-banner-block',
        'blocks.video-embed',
      ]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
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
    locale: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::contact-page.contact-page'
    >;
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
    metaDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    metaTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    ogImage: Schema.Attribute.Media<'images'>;
    publishedAt: Schema.Attribute.DateTime;
    showMap: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }> &
      Schema.Attribute.DefaultTo<true>;
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
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCourseDetailPageCourseDetailPage
  extends Struct.SingleTypeSchema {
  collectionName: 'course_detail_pages';
  info: {
    description: 'Global content for all course detail pages (dynamic zone blocks + empty states)';
    displayName: 'Course Detail Page';
    pluralName: 'course-detail-pages';
    singularName: 'course-detail-page';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    blocks: Schema.Attribute.DynamicZone<
      [
        'blocks.accordion-block',
        'blocks.accreditation-badges-block',
        'blocks.anchor-links-block',
        'blocks.announcement-banner-block',
        'blocks.before-after-block',
        'blocks.blog-posts-grid-block',
        'blocks.breadcrumb-block',
        'blocks.cards-grid',
        'blocks.certification-cards-block',
        'blocks.comparison-table-block',
        'blocks.compliance-badge-block',
        'blocks.contact-form-block',
        'blocks.countdown-timer-block',
        'blocks.course-preview-block',
        'blocks.cpd-calculator-block',
        'blocks.cta-banner',
        'blocks.curriculum-outline-block',
        'blocks.download-resources-block',
        'blocks.faq-accordion',
        'blocks.featured-courses-grid',
        'blocks.feedback-form-block',
        'blocks.hero-banner',
        'blocks.image-gallery-block',
        'blocks.instructor-spotlight-block',
        'blocks.instructors-grid',
        'blocks.learning-outcomes-block',
        'blocks.live-counter-block',
        'blocks.logo-strip',
        'blocks.newsletter-block',
        'blocks.partners-strip',
        'blocks.pdf-viewer-block',
        'blocks.policy-sections-block',
        'blocks.pricing-table-block',
        'blocks.related-pages-block',
        'blocks.rich-text-block',
        'blocks.section-header-block',
        'blocks.social-feed-block',
        'blocks.spacer-block',
        'blocks.stats-numbers-block',
        'blocks.student-progress-block',
        'blocks.success-stories-block',
        'blocks.tabs-block',
        'blocks.testimonials-carousel',
        'blocks.timeline-block',
        'blocks.trainer-form-block',
        'blocks.treatment-gallery-block',
        'blocks.upcoming-events-block',
        'blocks.image-banner-block',
        'blocks.video-embed',
      ]
    >;
    contentsHeading: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    courseDetailsHeading: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    featuresHeading: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    locale: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::course-detail-page.course-detail-page'
    >;
    moreContentText: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    noReviewsText: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    noticesHeading: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    objectivesHeading: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    overviewHeading: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    publishedAt: Schema.Attribute.DateTime;
    relatedCoursesSubtitle: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    relatedCoursesTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    requirementsHeading: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    reviewsHeading: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    scheduleHeading: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    targetAudienceHeading: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCoursesPageCoursesPage extends Struct.SingleTypeSchema {
  collectionName: 'courses_pages';
  info: {
    description: 'Content for the public /courses listing page';
    displayName: 'Courses Page';
    pluralName: 'courses-pages';
    singularName: 'courses-page';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    blocks: Schema.Attribute.DynamicZone<
      [
        'blocks.accordion-block',
        'blocks.accreditation-badges-block',
        'blocks.anchor-links-block',
        'blocks.announcement-banner-block',
        'blocks.before-after-block',
        'blocks.blog-posts-grid-block',
        'blocks.breadcrumb-block',
        'blocks.cards-grid',
        'blocks.certification-cards-block',
        'blocks.comparison-table-block',
        'blocks.compliance-badge-block',
        'blocks.contact-form-block',
        'blocks.countdown-timer-block',
        'blocks.course-preview-block',
        'blocks.cpd-calculator-block',
        'blocks.cta-banner',
        'blocks.curriculum-outline-block',
        'blocks.download-resources-block',
        'blocks.faq-accordion',
        'blocks.featured-courses-grid',
        'blocks.feedback-form-block',
        'blocks.hero-banner',
        'blocks.image-gallery-block',
        'blocks.instructor-spotlight-block',
        'blocks.instructors-grid',
        'blocks.learning-outcomes-block',
        'blocks.live-counter-block',
        'blocks.logo-strip',
        'blocks.newsletter-block',
        'blocks.partners-strip',
        'blocks.pdf-viewer-block',
        'blocks.policy-sections-block',
        'blocks.pricing-table-block',
        'blocks.related-pages-block',
        'blocks.rich-text-block',
        'blocks.section-header-block',
        'blocks.social-feed-block',
        'blocks.spacer-block',
        'blocks.stats-numbers-block',
        'blocks.student-progress-block',
        'blocks.success-stories-block',
        'blocks.tabs-block',
        'blocks.testimonials-carousel',
        'blocks.timeline-block',
        'blocks.trainer-form-block',
        'blocks.treatment-gallery-block',
        'blocks.upcoming-events-block',
        'blocks.image-banner-block',
        'blocks.video-embed',
      ]
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    ctaButtonHref: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }>;
    ctaButtonLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    ctaDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    ctaTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    emptyStateMessage: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    emptyStateTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    filterAllLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    filterAvailabilityLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    filterAvailFullLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    filterAvailOpenLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    filterAvailStartingSoonLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    filterBlendedLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    filterDeliveryLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    filterFreeLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    filterLangArLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    filterLangBothLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    filterLangEnLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    filterLanguageLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    filterOnsiteLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    filterPaidLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    filterPricingLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    filterSelfPacedLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    filterSortByLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    filterSortFeaturedLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    filterSortNewestLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    filterSortRatingLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    filterZoomLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    heroSubtitle: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    heroTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    locale: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::courses-page.courses-page'
    >;
    metaDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    metaTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    publishedAt: Schema.Attribute.DateTime;
    searchPlaceholder: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    showAvailabilityFilter: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }> &
      Schema.Attribute.DefaultTo<true>;
    showDeliveryFilter: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }> &
      Schema.Attribute.DefaultTo<true>;
    showLanguageFilter: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }> &
      Schema.Attribute.DefaultTo<true>;
    showPricingFilter: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }> &
      Schema.Attribute.DefaultTo<true>;
    showSearchBar: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }> &
      Schema.Attribute.DefaultTo<true>;
    showSortBy: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }> &
      Schema.Attribute.DefaultTo<true>;
    sidebarFilterTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiFaqPageFaqPage extends Struct.SingleTypeSchema {
  collectionName: 'faq_pages';
  info: {
    description: 'FAQ page content management';
    displayName: 'FAQ Page';
    pluralName: 'faq-pages';
    singularName: 'faq-page';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    blocks: Schema.Attribute.DynamicZone<
      [
        'blocks.accordion-block',
        'blocks.accreditation-badges-block',
        'blocks.anchor-links-block',
        'blocks.announcement-banner-block',
        'blocks.before-after-block',
        'blocks.blog-posts-grid-block',
        'blocks.breadcrumb-block',
        'blocks.cards-grid',
        'blocks.certification-cards-block',
        'blocks.comparison-table-block',
        'blocks.compliance-badge-block',
        'blocks.contact-form-block',
        'blocks.countdown-timer-block',
        'blocks.course-preview-block',
        'blocks.cpd-calculator-block',
        'blocks.cta-banner',
        'blocks.curriculum-outline-block',
        'blocks.download-resources-block',
        'blocks.faq-accordion',
        'blocks.featured-courses-grid',
        'blocks.feedback-form-block',
        'blocks.hero-banner',
        'blocks.image-gallery-block',
        'blocks.instructor-spotlight-block',
        'blocks.instructors-grid',
        'blocks.learning-outcomes-block',
        'blocks.live-counter-block',
        'blocks.logo-strip',
        'blocks.newsletter-block',
        'blocks.partners-strip',
        'blocks.pdf-viewer-block',
        'blocks.policy-sections-block',
        'blocks.pricing-table-block',
        'blocks.related-pages-block',
        'blocks.rich-text-block',
        'blocks.section-header-block',
        'blocks.social-feed-block',
        'blocks.spacer-block',
        'blocks.stats-numbers-block',
        'blocks.student-progress-block',
        'blocks.success-stories-block',
        'blocks.tabs-block',
        'blocks.testimonials-carousel',
        'blocks.timeline-block',
        'blocks.trainer-form-block',
        'blocks.treatment-gallery-block',
        'blocks.upcoming-events-block',
        'blocks.image-banner-block',
        'blocks.video-embed',
      ]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    getInTouchLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    getInTouchLink: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }>;
    items: Schema.Attribute.Component<'shared.faq-item', true>;
    locale: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::faq-page.faq-page'
    >;
    metaDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    metaTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    ogImage: Schema.Attribute.Media<'images'>;
    publishedAt: Schema.Attribute.DateTime;
    subtitle: Schema.Attribute.String &
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
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiFeaturedCourseFeaturedCourse
  extends Struct.CollectionTypeSchema {
  collectionName: 'featured_courses';
  info: {
    description: 'Featured courses on home page';
    displayName: 'Featured Course';
    pluralName: 'featured-courses';
    singularName: 'featured-course';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    cmeHoursLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    courseType: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
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
    hours: Schema.Attribute.Integer & Schema.Attribute.Required;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::featured-course.featured-course'
    >;
    order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    price: Schema.Attribute.Decimal & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
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
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    vectorImage: Schema.Attribute.Media<'images'>;
    viewDetailsLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
  };
}

export interface ApiFeedbackPageFeedbackPage extends Struct.SingleTypeSchema {
  collectionName: 'feedback_pages';
  info: {
    displayName: 'Feedback Page';
    pluralName: 'feedback-pages';
    singularName: 'feedback-page';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    blocks: Schema.Attribute.DynamicZone<
      [
        'blocks.accordion-block',
        'blocks.accreditation-badges-block',
        'blocks.anchor-links-block',
        'blocks.announcement-banner-block',
        'blocks.before-after-block',
        'blocks.blog-posts-grid-block',
        'blocks.breadcrumb-block',
        'blocks.cards-grid',
        'blocks.certification-cards-block',
        'blocks.comparison-table-block',
        'blocks.compliance-badge-block',
        'blocks.contact-form-block',
        'blocks.countdown-timer-block',
        'blocks.course-preview-block',
        'blocks.cpd-calculator-block',
        'blocks.cta-banner',
        'blocks.curriculum-outline-block',
        'blocks.download-resources-block',
        'blocks.faq-accordion',
        'blocks.featured-courses-grid',
        'blocks.feedback-form-block',
        'blocks.hero-banner',
        'blocks.image-gallery-block',
        'blocks.instructor-spotlight-block',
        'blocks.instructors-grid',
        'blocks.learning-outcomes-block',
        'blocks.live-counter-block',
        'blocks.logo-strip',
        'blocks.newsletter-block',
        'blocks.partners-strip',
        'blocks.pdf-viewer-block',
        'blocks.policy-sections-block',
        'blocks.pricing-table-block',
        'blocks.related-pages-block',
        'blocks.rich-text-block',
        'blocks.section-header-block',
        'blocks.social-feed-block',
        'blocks.spacer-block',
        'blocks.stats-numbers-block',
        'blocks.student-progress-block',
        'blocks.success-stories-block',
        'blocks.tabs-block',
        'blocks.testimonials-carousel',
        'blocks.timeline-block',
        'blocks.trainer-form-block',
        'blocks.treatment-gallery-block',
        'blocks.upcoming-events-block',
        'blocks.image-banner-block',
        'blocks.video-embed',
      ]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
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
    locale: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::feedback-page.feedback-page'
    >;
    metaDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    metaTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    ogImage: Schema.Attribute.Media<'images'>;
    publishedAt: Schema.Attribute.DateTime;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiHomePageHomePage extends Struct.SingleTypeSchema {
  collectionName: 'home_pages';
  info: {
    description: 'Home page content management';
    displayName: 'Home Page';
    pluralName: 'home-pages';
    singularName: 'home-page';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    becomeTrainerButtonLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    becomeTrainerButtonLink: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }>;
    becomeTrainerDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    becomeTrainerImage: Schema.Attribute.Media<'images'>;
    becomeTrainerTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    blocks: Schema.Attribute.DynamicZone<
      [
        'blocks.accordion-block',
        'blocks.accreditation-badges-block',
        'blocks.anchor-links-block',
        'blocks.announcement-banner-block',
        'blocks.before-after-block',
        'blocks.blog-posts-grid-block',
        'blocks.breadcrumb-block',
        'blocks.cards-grid',
        'blocks.certification-cards-block',
        'blocks.comparison-table-block',
        'blocks.compliance-badge-block',
        'blocks.contact-form-block',
        'blocks.countdown-timer-block',
        'blocks.course-preview-block',
        'blocks.cpd-calculator-block',
        'blocks.cta-banner',
        'blocks.curriculum-outline-block',
        'blocks.download-resources-block',
        'blocks.faq-accordion',
        'blocks.featured-courses-grid',
        'blocks.feedback-form-block',
        'blocks.hero-banner',
        'blocks.image-gallery-block',
        'blocks.instructor-spotlight-block',
        'blocks.instructors-grid',
        'blocks.learning-outcomes-block',
        'blocks.live-counter-block',
        'blocks.logo-strip',
        'blocks.newsletter-block',
        'blocks.partners-strip',
        'blocks.pdf-viewer-block',
        'blocks.policy-sections-block',
        'blocks.pricing-table-block',
        'blocks.related-pages-block',
        'blocks.rich-text-block',
        'blocks.section-header-block',
        'blocks.social-feed-block',
        'blocks.spacer-block',
        'blocks.stats-numbers-block',
        'blocks.student-progress-block',
        'blocks.success-stories-block',
        'blocks.tabs-block',
        'blocks.testimonials-carousel',
        'blocks.timeline-block',
        'blocks.trainer-form-block',
        'blocks.treatment-gallery-block',
        'blocks.upcoming-events-block',
        'blocks.image-banner-block',
        'blocks.video-embed',
      ]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    ctaBackgroundImage: Schema.Attribute.Media<'images'>;
    ctaButtonLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    ctaButtonLink: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }>;
    ctaDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    ctaTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    featuredCoursesDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    featuredCoursesTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    featuredCoursesViewAllLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    heroButton1Label: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    heroButton1Link: Schema.Attribute.String;
    heroButton2Label: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    heroButton2Link: Schema.Attribute.String;
    heroDescription: Schema.Attribute.Text &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    heroPartnerLogos: Schema.Attribute.Media<'images', true>;
    heroTitle: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    heroTitleLine2: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    heroTitleMobile: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    heroVideo: Schema.Attribute.Media<'videos'> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    heroVideoMode: Schema.Attribute.Enumeration<
      ['banner', 'widescreen', 'fullFit']
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }> &
      Schema.Attribute.DefaultTo<'banner'>;
    instructorsDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    instructorsTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    locale: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::home-page.home-page'
    >;
    metaDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    metaTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    ogImage: Schema.Attribute.Media<'images'>;
    partnersSectionTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    publishedAt: Schema.Attribute.DateTime;
    testimonialsDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    testimonialsTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiInstructorInstructor extends Struct.CollectionTypeSchema {
  collectionName: 'instructors';
  info: {
    description: 'Instructor profiles';
    displayName: 'Instructor';
    pluralName: 'instructors';
    singularName: 'instructor';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    avatar: Schema.Attribute.Media<'images'>;
    bio: Schema.Attribute.RichText &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::instructor.instructor'
    >;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    section: Schema.Attribute.Enumeration<['expert', 'minds']> &
      Schema.Attribute.DefaultTo<'expert'>;
    showOnHomepage: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiInstructorsPageInstructorsPage
  extends Struct.SingleTypeSchema {
  collectionName: 'instructors_pages';
  info: {
    description: 'Instructors page content management';
    displayName: 'Instructors Page';
    pluralName: 'instructors-pages';
    singularName: 'instructors-page';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    blocks: Schema.Attribute.DynamicZone<
      [
        'blocks.accordion-block',
        'blocks.accreditation-badges-block',
        'blocks.anchor-links-block',
        'blocks.announcement-banner-block',
        'blocks.before-after-block',
        'blocks.blog-posts-grid-block',
        'blocks.breadcrumb-block',
        'blocks.cards-grid',
        'blocks.certification-cards-block',
        'blocks.comparison-table-block',
        'blocks.compliance-badge-block',
        'blocks.contact-form-block',
        'blocks.countdown-timer-block',
        'blocks.course-preview-block',
        'blocks.cpd-calculator-block',
        'blocks.cta-banner',
        'blocks.curriculum-outline-block',
        'blocks.download-resources-block',
        'blocks.faq-accordion',
        'blocks.featured-courses-grid',
        'blocks.feedback-form-block',
        'blocks.hero-banner',
        'blocks.image-gallery-block',
        'blocks.instructor-spotlight-block',
        'blocks.instructors-grid',
        'blocks.learning-outcomes-block',
        'blocks.live-counter-block',
        'blocks.logo-strip',
        'blocks.newsletter-block',
        'blocks.partners-strip',
        'blocks.pdf-viewer-block',
        'blocks.policy-sections-block',
        'blocks.pricing-table-block',
        'blocks.related-pages-block',
        'blocks.rich-text-block',
        'blocks.section-header-block',
        'blocks.social-feed-block',
        'blocks.spacer-block',
        'blocks.stats-numbers-block',
        'blocks.student-progress-block',
        'blocks.success-stories-block',
        'blocks.tabs-block',
        'blocks.testimonials-carousel',
        'blocks.timeline-block',
        'blocks.trainer-form-block',
        'blocks.treatment-gallery-block',
        'blocks.upcoming-events-block',
        'blocks.image-banner-block',
        'blocks.video-embed',
      ]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::instructors-page.instructors-page'
    >;
    meetExpertsTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    metaDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    metaTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    mindsBehindTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    ogImage: Schema.Attribute.Media<'images'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiLearningPoliciesPageLearningPoliciesPage
  extends Struct.SingleTypeSchema {
  collectionName: 'learning_policies_pages';
  info: {
    description: 'Learning policies page content management';
    displayName: 'Learning Policies Page';
    pluralName: 'learning-policies-pages';
    singularName: 'learning-policies-page';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    blocks: Schema.Attribute.DynamicZone<
      [
        'blocks.accordion-block',
        'blocks.accreditation-badges-block',
        'blocks.anchor-links-block',
        'blocks.announcement-banner-block',
        'blocks.before-after-block',
        'blocks.blog-posts-grid-block',
        'blocks.breadcrumb-block',
        'blocks.cards-grid',
        'blocks.certification-cards-block',
        'blocks.comparison-table-block',
        'blocks.compliance-badge-block',
        'blocks.contact-form-block',
        'blocks.countdown-timer-block',
        'blocks.course-preview-block',
        'blocks.cpd-calculator-block',
        'blocks.cta-banner',
        'blocks.curriculum-outline-block',
        'blocks.download-resources-block',
        'blocks.faq-accordion',
        'blocks.featured-courses-grid',
        'blocks.feedback-form-block',
        'blocks.hero-banner',
        'blocks.image-gallery-block',
        'blocks.instructor-spotlight-block',
        'blocks.instructors-grid',
        'blocks.learning-outcomes-block',
        'blocks.live-counter-block',
        'blocks.logo-strip',
        'blocks.newsletter-block',
        'blocks.partners-strip',
        'blocks.pdf-viewer-block',
        'blocks.policy-sections-block',
        'blocks.pricing-table-block',
        'blocks.related-pages-block',
        'blocks.rich-text-block',
        'blocks.section-header-block',
        'blocks.social-feed-block',
        'blocks.spacer-block',
        'blocks.stats-numbers-block',
        'blocks.student-progress-block',
        'blocks.success-stories-block',
        'blocks.tabs-block',
        'blocks.testimonials-carousel',
        'blocks.timeline-block',
        'blocks.trainer-form-block',
        'blocks.treatment-gallery-block',
        'blocks.upcoming-events-block',
        'blocks.image-banner-block',
        'blocks.video-embed',
      ]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    lastUpdated: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    locale: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::learning-policies-page.learning-policies-page'
    >;
    metaDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    metaTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    ogImage: Schema.Attribute.Media<'images'>;
    publishedAt: Schema.Attribute.DateTime;
    sections: Schema.Attribute.Component<'shared.policy-section', true> &
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
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiNavigationLinkNavigationLink
  extends Struct.CollectionTypeSchema {
  collectionName: 'navigation_links';
  info: {
    description: 'Navigation and footer links';
    displayName: 'Navigation Link';
    pluralName: 'navigation-links';
    singularName: 'navigation-link';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    hasDropdown: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    label: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    locale: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::navigation-link.navigation-link'
    >;
    location: Schema.Attribute.Enumeration<
      ['navbar', 'footer-platform', 'footer-organization', 'footer-support']
    > &
      Schema.Attribute.Required;
    openInNewTab: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    url: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ApiNelcPageNelcPage extends Struct.SingleTypeSchema {
  collectionName: 'nelc_pages';
  info: {
    displayName: 'NELC Page';
    pluralName: 'nelc-pages';
    singularName: 'nelc-page';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    blocks: Schema.Attribute.DynamicZone<
      [
        'blocks.accordion-block',
        'blocks.accreditation-badges-block',
        'blocks.anchor-links-block',
        'blocks.announcement-banner-block',
        'blocks.before-after-block',
        'blocks.blog-posts-grid-block',
        'blocks.breadcrumb-block',
        'blocks.cards-grid',
        'blocks.certification-cards-block',
        'blocks.comparison-table-block',
        'blocks.compliance-badge-block',
        'blocks.contact-form-block',
        'blocks.countdown-timer-block',
        'blocks.course-preview-block',
        'blocks.cpd-calculator-block',
        'blocks.cta-banner',
        'blocks.curriculum-outline-block',
        'blocks.download-resources-block',
        'blocks.faq-accordion',
        'blocks.featured-courses-grid',
        'blocks.feedback-form-block',
        'blocks.hero-banner',
        'blocks.image-gallery-block',
        'blocks.instructor-spotlight-block',
        'blocks.instructors-grid',
        'blocks.learning-outcomes-block',
        'blocks.live-counter-block',
        'blocks.logo-strip',
        'blocks.newsletter-block',
        'blocks.partners-strip',
        'blocks.pdf-viewer-block',
        'blocks.policy-sections-block',
        'blocks.pricing-table-block',
        'blocks.related-pages-block',
        'blocks.rich-text-block',
        'blocks.section-header-block',
        'blocks.social-feed-block',
        'blocks.spacer-block',
        'blocks.stats-numbers-block',
        'blocks.student-progress-block',
        'blocks.success-stories-block',
        'blocks.tabs-block',
        'blocks.testimonials-carousel',
        'blocks.timeline-block',
        'blocks.trainer-form-block',
        'blocks.treatment-gallery-block',
        'blocks.upcoming-events-block',
        'blocks.image-banner-block',
        'blocks.video-embed',
      ]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    complianceCards: Schema.Attribute.Component<
      'elements.compliance-card',
      true
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    complianceDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    complianceTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
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
    infoBadges: Schema.Attribute.Component<'elements.info-badge', true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    locale: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::nelc-page.nelc-page'
    >;
    metaDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    metaTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    nelcLogo: Schema.Attribute.Media<'images'>;
    ogImage: Schema.Attribute.Media<'images'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiPagePage extends Struct.CollectionTypeSchema {
  collectionName: 'pages';
  info: {
    description: 'Dynamic pages created from the CMS';
    displayName: 'Page';
    pluralName: 'pages';
    singularName: 'page';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    blocks: Schema.Attribute.DynamicZone<
      [
        'blocks.accordion-block',
        'blocks.accreditation-badges-block',
        'blocks.anchor-links-block',
        'blocks.announcement-banner-block',
        'blocks.before-after-block',
        'blocks.blog-posts-grid-block',
        'blocks.breadcrumb-block',
        'blocks.cards-grid',
        'blocks.certification-cards-block',
        'blocks.comparison-table-block',
        'blocks.compliance-badge-block',
        'blocks.contact-form-block',
        'blocks.countdown-timer-block',
        'blocks.course-preview-block',
        'blocks.cpd-calculator-block',
        'blocks.cta-banner',
        'blocks.curriculum-outline-block',
        'blocks.download-resources-block',
        'blocks.faq-accordion',
        'blocks.featured-courses-grid',
        'blocks.feedback-form-block',
        'blocks.hero-banner',
        'blocks.image-gallery-block',
        'blocks.instructor-spotlight-block',
        'blocks.instructors-grid',
        'blocks.learning-outcomes-block',
        'blocks.live-counter-block',
        'blocks.logo-strip',
        'blocks.newsletter-block',
        'blocks.partners-strip',
        'blocks.pdf-viewer-block',
        'blocks.policy-sections-block',
        'blocks.pricing-table-block',
        'blocks.related-pages-block',
        'blocks.rich-text-block',
        'blocks.section-header-block',
        'blocks.social-feed-block',
        'blocks.spacer-block',
        'blocks.stats-numbers-block',
        'blocks.student-progress-block',
        'blocks.success-stories-block',
        'blocks.tabs-block',
        'blocks.testimonials-carousel',
        'blocks.timeline-block',
        'blocks.trainer-form-block',
        'blocks.treatment-gallery-block',
        'blocks.upcoming-events-block',
        'blocks.image-banner-block',
        'blocks.video-embed',
      ]
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::page.page'>;
    metaDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    metaTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID<'title'> & Schema.Attribute.Required;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiPartnerPartner extends Struct.CollectionTypeSchema {
  collectionName: 'partners';
  info: {
    description: 'Partner logos and information';
    displayName: 'Partner';
    pluralName: 'partners';
    singularName: 'partner';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::partner.partner'
    >;
    logo: Schema.Attribute.Media<'images'>;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    url: Schema.Attribute.String;
  };
}

export interface ApiPartnersPagePartnersPage extends Struct.SingleTypeSchema {
  collectionName: 'partners_pages';
  info: {
    description: 'Partners page content management';
    displayName: 'Partners Page';
    pluralName: 'partners-pages';
    singularName: 'partners-page';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    blocks: Schema.Attribute.DynamicZone<
      [
        'blocks.accordion-block',
        'blocks.accreditation-badges-block',
        'blocks.anchor-links-block',
        'blocks.announcement-banner-block',
        'blocks.before-after-block',
        'blocks.blog-posts-grid-block',
        'blocks.breadcrumb-block',
        'blocks.cards-grid',
        'blocks.certification-cards-block',
        'blocks.comparison-table-block',
        'blocks.compliance-badge-block',
        'blocks.contact-form-block',
        'blocks.countdown-timer-block',
        'blocks.course-preview-block',
        'blocks.cpd-calculator-block',
        'blocks.cta-banner',
        'blocks.curriculum-outline-block',
        'blocks.download-resources-block',
        'blocks.faq-accordion',
        'blocks.featured-courses-grid',
        'blocks.feedback-form-block',
        'blocks.hero-banner',
        'blocks.image-gallery-block',
        'blocks.instructor-spotlight-block',
        'blocks.instructors-grid',
        'blocks.learning-outcomes-block',
        'blocks.live-counter-block',
        'blocks.logo-strip',
        'blocks.newsletter-block',
        'blocks.partners-strip',
        'blocks.pdf-viewer-block',
        'blocks.policy-sections-block',
        'blocks.pricing-table-block',
        'blocks.related-pages-block',
        'blocks.rich-text-block',
        'blocks.section-header-block',
        'blocks.social-feed-block',
        'blocks.spacer-block',
        'blocks.stats-numbers-block',
        'blocks.student-progress-block',
        'blocks.success-stories-block',
        'blocks.tabs-block',
        'blocks.testimonials-carousel',
        'blocks.timeline-block',
        'blocks.trainer-form-block',
        'blocks.treatment-gallery-block',
        'blocks.upcoming-events-block',
        'blocks.image-banner-block',
        'blocks.video-embed',
      ]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::partners-page.partners-page'
    >;
    metaDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    metaTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    ogImage: Schema.Attribute.Media<'images'>;
    publishedAt: Schema.Attribute.DateTime;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiPrivacyPolicyPagePrivacyPolicyPage
  extends Struct.SingleTypeSchema {
  collectionName: 'privacy_policy_pages';
  info: {
    description: 'Privacy policy page content management';
    displayName: 'Privacy Policy Page';
    pluralName: 'privacy-policy-pages';
    singularName: 'privacy-policy-page';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    blocks: Schema.Attribute.DynamicZone<
      [
        'blocks.accordion-block',
        'blocks.accreditation-badges-block',
        'blocks.anchor-links-block',
        'blocks.announcement-banner-block',
        'blocks.before-after-block',
        'blocks.blog-posts-grid-block',
        'blocks.breadcrumb-block',
        'blocks.cards-grid',
        'blocks.certification-cards-block',
        'blocks.comparison-table-block',
        'blocks.compliance-badge-block',
        'blocks.contact-form-block',
        'blocks.countdown-timer-block',
        'blocks.course-preview-block',
        'blocks.cpd-calculator-block',
        'blocks.cta-banner',
        'blocks.curriculum-outline-block',
        'blocks.download-resources-block',
        'blocks.faq-accordion',
        'blocks.featured-courses-grid',
        'blocks.feedback-form-block',
        'blocks.hero-banner',
        'blocks.image-gallery-block',
        'blocks.instructor-spotlight-block',
        'blocks.instructors-grid',
        'blocks.learning-outcomes-block',
        'blocks.live-counter-block',
        'blocks.logo-strip',
        'blocks.newsletter-block',
        'blocks.partners-strip',
        'blocks.pdf-viewer-block',
        'blocks.policy-sections-block',
        'blocks.pricing-table-block',
        'blocks.related-pages-block',
        'blocks.rich-text-block',
        'blocks.section-header-block',
        'blocks.social-feed-block',
        'blocks.spacer-block',
        'blocks.stats-numbers-block',
        'blocks.student-progress-block',
        'blocks.success-stories-block',
        'blocks.tabs-block',
        'blocks.testimonials-carousel',
        'blocks.timeline-block',
        'blocks.trainer-form-block',
        'blocks.treatment-gallery-block',
        'blocks.upcoming-events-block',
        'blocks.image-banner-block',
        'blocks.video-embed',
      ]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    lastUpdated: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    locale: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::privacy-policy-page.privacy-policy-page'
    >;
    metaDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    metaTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    ogImage: Schema.Attribute.Media<'images'>;
    publishedAt: Schema.Attribute.DateTime;
    sections: Schema.Attribute.Component<'shared.policy-section', true> &
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
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSearchPageSearchPage extends Struct.SingleTypeSchema {
  collectionName: 'search_pages';
  info: {
    description: 'Search page text content (hero, search bar, popular searches)';
    displayName: 'Search Page';
    pluralName: 'search-pages';
    singularName: 'search-page';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    filterResultsLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    heroSubtitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    heroTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    locale: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::search-page.search-page'
    >;
    noResultsDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    noResultsTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    popularSearchesLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    popularSearchTerms: Schema.Attribute.Component<'shared.search-term', true>;
    publishedAt: Schema.Attribute.DateTime;
    searchPlaceholder: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    searchPlaceholderMobile: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSiteSettingSiteSetting extends Struct.SingleTypeSchema {
  collectionName: 'site_settings';
  info: {
    description: 'Global site settings';
    displayName: 'Site Settings';
    pluralName: 'site-settings';
    singularName: 'site-setting';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    copyrightText: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    facebookUrl: Schema.Attribute.String;
    footerDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    footerMenuTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    footerOrganizationTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    footerPlatformTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    footerSupportTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    instagramUrl: Schema.Attribute.String;
    linkedinUrl: Schema.Attribute.String;
    locale: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::site-setting.site-setting'
    >;
    logo: Schema.Attribute.Media<'images'>;
    paymentMethods: Schema.Attribute.Component<
      'elements.payment-method-item',
      true
    >;
    publishedAt: Schema.Attribute.DateTime;
    showSearchBar: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }> &
      Schema.Attribute.DefaultTo<true>;
    showWhatsappButton: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }> &
      Schema.Attribute.DefaultTo<false>;
    siteName: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    themeBorderColor: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }> &
      Schema.Attribute.DefaultTo<'#e5e7eb'>;
    themeBorderSubtle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }> &
      Schema.Attribute.DefaultTo<'#C8D5E1'>;
    themeButtonText: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }> &
      Schema.Attribute.DefaultTo<'#ffffff'>;
    themeFooterBackground: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }> &
      Schema.Attribute.DefaultTo<'#ffffff'>;
    themeFooterHeading: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }> &
      Schema.Attribute.DefaultTo<'#171717'>;
    themeFooterText: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }> &
      Schema.Attribute.DefaultTo<'#171717'>;
    themeIconColor: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }> &
      Schema.Attribute.DefaultTo<'#737373'>;
    themeNavbarBackground: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }> &
      Schema.Attribute.DefaultTo<'#EEF3F7'>;
    themeNavbarText: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }> &
      Schema.Attribute.DefaultTo<'#171717'>;
    themePrimaryColor: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }> &
      Schema.Attribute.DefaultTo<'#a37f49'>;
    themePrimaryDark: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }> &
      Schema.Attribute.DefaultTo<'#6b4e24'>;
    themeStarBorder: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }> &
      Schema.Attribute.DefaultTo<'#E5E7EB'>;
    themeStarColor: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }> &
      Schema.Attribute.DefaultTo<'#F59E0B'>;
    themeSurfaceCard: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }> &
      Schema.Attribute.DefaultTo<'#e5edf4'>;
    themeSurfacePage: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }> &
      Schema.Attribute.DefaultTo<'#EEF3F7'>;
    themeTextPrimary: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }> &
      Schema.Attribute.DefaultTo<'#171717'>;
    themeTextSecondary: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }> &
      Schema.Attribute.DefaultTo<'#737373'>;
    twitterUrl: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    whatsappCompanyName: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    whatsappGreeting: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    whatsappNumber: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false;
        };
      }>;
    whatsappReplyTime: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
  };
}

export interface ApiTermsPageTermsPage extends Struct.SingleTypeSchema {
  collectionName: 'terms_pages';
  info: {
    description: 'Terms and conditions page content management';
    displayName: 'Terms Page';
    pluralName: 'terms-pages';
    singularName: 'terms-page';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    blocks: Schema.Attribute.DynamicZone<
      [
        'blocks.accordion-block',
        'blocks.accreditation-badges-block',
        'blocks.anchor-links-block',
        'blocks.announcement-banner-block',
        'blocks.before-after-block',
        'blocks.blog-posts-grid-block',
        'blocks.breadcrumb-block',
        'blocks.cards-grid',
        'blocks.certification-cards-block',
        'blocks.comparison-table-block',
        'blocks.compliance-badge-block',
        'blocks.contact-form-block',
        'blocks.countdown-timer-block',
        'blocks.course-preview-block',
        'blocks.cpd-calculator-block',
        'blocks.cta-banner',
        'blocks.curriculum-outline-block',
        'blocks.download-resources-block',
        'blocks.faq-accordion',
        'blocks.featured-courses-grid',
        'blocks.feedback-form-block',
        'blocks.hero-banner',
        'blocks.image-gallery-block',
        'blocks.instructor-spotlight-block',
        'blocks.instructors-grid',
        'blocks.learning-outcomes-block',
        'blocks.live-counter-block',
        'blocks.logo-strip',
        'blocks.newsletter-block',
        'blocks.partners-strip',
        'blocks.pdf-viewer-block',
        'blocks.policy-sections-block',
        'blocks.pricing-table-block',
        'blocks.related-pages-block',
        'blocks.rich-text-block',
        'blocks.section-header-block',
        'blocks.social-feed-block',
        'blocks.spacer-block',
        'blocks.stats-numbers-block',
        'blocks.student-progress-block',
        'blocks.success-stories-block',
        'blocks.tabs-block',
        'blocks.testimonials-carousel',
        'blocks.timeline-block',
        'blocks.trainer-form-block',
        'blocks.treatment-gallery-block',
        'blocks.upcoming-events-block',
        'blocks.image-banner-block',
        'blocks.video-embed',
      ]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    lastUpdated: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    locale: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::terms-page.terms-page'
    >;
    metaDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    metaTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    ogImage: Schema.Attribute.Media<'images'>;
    publishedAt: Schema.Attribute.DateTime;
    sections: Schema.Attribute.Component<'shared.policy-section', true> &
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
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiTestimonialTestimonial extends Struct.CollectionTypeSchema {
  collectionName: 'testimonials';
  info: {
    description: 'Customer testimonials';
    displayName: 'Testimonial';
    pluralName: 'testimonials';
    singularName: 'testimonial';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    authorImage: Schema.Attribute.Media<'images'>;
    authorName: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    authorRole: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::testimonial.testimonial'
    >;
    order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    quote: Schema.Attribute.Text &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginContentReleasesRelease
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_releases';
  info: {
    displayName: 'Release';
    pluralName: 'releases';
    singularName: 'release';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    actions: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release-action'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    releasedAt: Schema.Attribute.DateTime;
    scheduledAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      ['ready', 'blocked', 'failed', 'done', 'empty']
    > &
      Schema.Attribute.Required;
    timezone: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginContentReleasesReleaseAction
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_release_actions';
  info: {
    displayName: 'Release Action';
    pluralName: 'release-actions';
    singularName: 'release-action';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    contentType: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    entryDocumentId: Schema.Attribute.String;
    isEntryValid: Schema.Attribute.Boolean;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release-action'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    release: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::content-releases.release'
    >;
    type: Schema.Attribute.Enumeration<['publish', 'unpublish']> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginI18NLocale extends Struct.CollectionTypeSchema {
  collectionName: 'i18n_locale';
  info: {
    collectionName: 'locales';
    description: '';
    displayName: 'Locale';
    pluralName: 'locales';
    singularName: 'locale';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::i18n.locale'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.SetMinMax<
        {
          max: 50;
          min: 1;
        },
        number
      >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginReviewWorkflowsWorkflow
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_workflows';
  info: {
    description: '';
    displayName: 'Workflow';
    name: 'Workflow';
    pluralName: 'workflows';
    singularName: 'workflow';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    contentTypes: Schema.Attribute.JSON &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'[]'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    stageRequiredToPublish: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::review-workflows.workflow-stage'
    >;
    stages: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow-stage'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginReviewWorkflowsWorkflowStage
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_workflows_stages';
  info: {
    description: '';
    displayName: 'Stages';
    name: 'Workflow Stage';
    pluralName: 'workflow-stages';
    singularName: 'workflow-stage';
  };
  options: {
    draftAndPublish: false;
    version: '1.1.0';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    color: Schema.Attribute.String & Schema.Attribute.DefaultTo<'#4945FF'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow-stage'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    permissions: Schema.Attribute.Relation<'manyToMany', 'admin::permission'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workflow: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::review-workflows.workflow'
    >;
  };
}

export interface PluginUploadFile extends Struct.CollectionTypeSchema {
  collectionName: 'files';
  info: {
    description: '';
    displayName: 'File';
    pluralName: 'files';
    singularName: 'file';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    alternativeText: Schema.Attribute.Text;
    caption: Schema.Attribute.Text;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    ext: Schema.Attribute.String;
    focalPoint: Schema.Attribute.JSON;
    folder: Schema.Attribute.Relation<'manyToOne', 'plugin::upload.folder'> &
      Schema.Attribute.Private;
    folderPath: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    formats: Schema.Attribute.JSON;
    hash: Schema.Attribute.String & Schema.Attribute.Required;
    height: Schema.Attribute.Integer;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::upload.file'
    > &
      Schema.Attribute.Private;
    mime: Schema.Attribute.String & Schema.Attribute.Required;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    previewUrl: Schema.Attribute.Text;
    provider: Schema.Attribute.String & Schema.Attribute.Required;
    provider_metadata: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    related: Schema.Attribute.Relation<'morphToMany'>;
    size: Schema.Attribute.Decimal & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    url: Schema.Attribute.Text & Schema.Attribute.Required;
    width: Schema.Attribute.Integer;
  };
}

export interface PluginUploadFolder extends Struct.CollectionTypeSchema {
  collectionName: 'upload_folders';
  info: {
    displayName: 'Folder';
    pluralName: 'folders';
    singularName: 'folder';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    children: Schema.Attribute.Relation<'oneToMany', 'plugin::upload.folder'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    files: Schema.Attribute.Relation<'oneToMany', 'plugin::upload.file'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::upload.folder'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    parent: Schema.Attribute.Relation<'manyToOne', 'plugin::upload.folder'>;
    path: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    pathId: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginUsersPermissionsPermission
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginUsersPermissionsRole
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'role';
    pluralName: 'roles';
    singularName: 'role';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.role'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.String & Schema.Attribute.Unique;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    >;
  };
}

export interface PluginUsersPermissionsUser
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'user';
    pluralName: 'users';
    singularName: 'user';
  };
  options: {
    draftAndPublish: false;
    timestamps: true;
  };
  attributes: {
    blocked: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    confirmationToken: Schema.Attribute.String & Schema.Attribute.Private;
    confirmed: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Private;
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    provider: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private;
    role: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ContentTypeSchemas {
      'admin::api-token': AdminApiToken;
      'admin::api-token-permission': AdminApiTokenPermission;
      'admin::permission': AdminPermission;
      'admin::role': AdminRole;
      'admin::session': AdminSession;
      'admin::transfer-token': AdminTransferToken;
      'admin::transfer-token-permission': AdminTransferTokenPermission;
      'admin::user': AdminUser;
      'api::about-page.about-page': ApiAboutPageAboutPage;
      'api::become-trainer-page.become-trainer-page': ApiBecomeTrainerPageBecomeTrainerPage;
      'api::blog-category.blog-category': ApiBlogCategoryBlogCategory;
      'api::blog-post.blog-post': ApiBlogPostBlogPost;
      'api::blogs-page.blogs-page': ApiBlogsPageBlogsPage;
      'api::certifications-page.certifications-page': ApiCertificationsPageCertificationsPage;
      'api::contact-page.contact-page': ApiContactPageContactPage;
      'api::course-detail-page.course-detail-page': ApiCourseDetailPageCourseDetailPage;
      'api::courses-page.courses-page': ApiCoursesPageCoursesPage;
      'api::faq-page.faq-page': ApiFaqPageFaqPage;
      'api::featured-course.featured-course': ApiFeaturedCourseFeaturedCourse;
      'api::feedback-page.feedback-page': ApiFeedbackPageFeedbackPage;
      'api::home-page.home-page': ApiHomePageHomePage;
      'api::instructor.instructor': ApiInstructorInstructor;
      'api::instructors-page.instructors-page': ApiInstructorsPageInstructorsPage;
      'api::learning-policies-page.learning-policies-page': ApiLearningPoliciesPageLearningPoliciesPage;
      'api::navigation-link.navigation-link': ApiNavigationLinkNavigationLink;
      'api::nelc-page.nelc-page': ApiNelcPageNelcPage;
      'api::page.page': ApiPagePage;
      'api::partner.partner': ApiPartnerPartner;
      'api::partners-page.partners-page': ApiPartnersPagePartnersPage;
      'api::privacy-policy-page.privacy-policy-page': ApiPrivacyPolicyPagePrivacyPolicyPage;
      'api::search-page.search-page': ApiSearchPageSearchPage;
      'api::site-setting.site-setting': ApiSiteSettingSiteSetting;
      'api::terms-page.terms-page': ApiTermsPageTermsPage;
      'api::testimonial.testimonial': ApiTestimonialTestimonial;
      'plugin::content-releases.release': PluginContentReleasesRelease;
      'plugin::content-releases.release-action': PluginContentReleasesReleaseAction;
      'plugin::i18n.locale': PluginI18NLocale;
      'plugin::review-workflows.workflow': PluginReviewWorkflowsWorkflow;
      'plugin::review-workflows.workflow-stage': PluginReviewWorkflowsWorkflowStage;
      'plugin::upload.file': PluginUploadFile;
      'plugin::upload.folder': PluginUploadFolder;
      'plugin::users-permissions.permission': PluginUsersPermissionsPermission;
      'plugin::users-permissions.role': PluginUsersPermissionsRole;
      'plugin::users-permissions.user': PluginUsersPermissionsUser;
    }
  }
}
