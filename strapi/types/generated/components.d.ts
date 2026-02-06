import type { Schema, Struct } from '@strapi/strapi';

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
      'shared.faq-item': SharedFaqItem;
      'shared.policy-section': SharedPolicySection;
    }
  }
}
