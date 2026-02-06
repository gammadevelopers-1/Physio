import type { Schema, Struct } from '@strapi/strapi';

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
      'shared.policy-section': SharedPolicySection;
    }
  }
}
