# Strapi CMS Integration Plan

## Overview

Replace Sanity CMS with Strapi for full content management of the PhysioGuidance platform with bilingual support (English/Arabic).

---

## Project Structure (After Integration)

```
D:/physioguidance/
├── frontend/           # Next.js application (existing)
├── strapi/             # NEW: Strapi CMS backend
├── studio/             # Sanity (to be removed after migration)
├── backends/           # Future backend services
└── README.md
```

---

## Phase 1: Strapi Setup & Configuration

### 1.1 Initialize Strapi Project
- Create `strapi/` folder at project root
- Initialize Strapi with TypeScript
- Configure SQLite for development, PostgreSQL for production
- Set up environment variables

### 1.2 Enable Internationalization (i18n)
- Enable Strapi i18n plugin
- Configure locales:
  - `en` (English) - Default
  - `ar` (Arabic)
- All content types will support both languages

### 1.3 Configure Media Library
- Set up media upload provider
- Configure image optimization settings
- Organize media into folders (partners, instructors, courses, etc.)

### 1.4 API & Permissions
- Configure public API access for content reading
- Set up API tokens for frontend
- Configure CORS for frontend domain

---

## Phase 2: Content Types for Home Page

### 2.1 Single Types (One instance only)

#### `home-page`
Manages all home page sections in one place.

| Field | Type | Localized | Description |
|-------|------|-----------|-------------|
| `heroVideo` | Media | No | Background video |
| `heroTitle` | String | Yes | Main title |
| `heroTitleLine2` | String | Yes | Second line of title |
| `heroTitleMobile` | String | Yes | Mobile title (single line) |
| `heroDescription` | Text | Yes | Hero description |
| `heroButton1Label` | String | Yes | "Explore Training Programs" |
| `heroButton2Label` | String | Yes | "Get Started" |
| `partnersSectionTitle` | String | Yes | "Our Trusted Partners" |
| `featuredCoursesTitle` | String | Yes | "Featured Programs" |
| `featuredCoursesDescription` | Text | Yes | Section description |
| `featuredCoursesViewAllLabel` | String | Yes | "View All Programs" |
| `becomeTrainerTitle` | String | Yes | "Become a Trainer" |
| `becomeTrainerDescription` | Text | Yes | Section description |
| `becomeTrainerButtonLabel` | String | Yes | "Get Started" |
| `becomeTrainerImage` | Media | No | Trainer image |
| `instructorsTitle` | String | Yes | "Led by Expert Healthcare Instructors" |
| `instructorsDescription` | Text | Yes | Section description |
| `testimonialsTitle` | String | Yes | "What Healthcare Professionals Say" |
| `testimonialsDescription` | Text | Yes | Section description |
| `ctaTitle` | String | Yes | "Start Your Healthcare Learning Journey" |
| `ctaDescription` | Text | Yes | Section description |
| `ctaButtonLabel` | String | Yes | "Get Started" |
| `ctaBackgroundImage` | Media | No | Background image |

#### `site-settings`
Global settings used across all pages.

| Field | Type | Localized | Description |
|-------|------|-----------|-------------|
| `siteName` | String | Yes | "PhysioGuidance" |
| `logo` | Media | No | Site logo |
| `footerDescription` | Text | Yes | Company description |
| `copyrightText` | String | Yes | "2025, PhysioGuidance" |
| `whatsappNumber` | String | No | "+966920035022" |
| `socialLinks` | Component (repeatable) | No | Social media links |

### 2.2 Collection Types (Multiple entries)

#### `partners`
| Field | Type | Localized | Description |
|-------|------|-----------|-------------|
| `name` | String | Yes | Partner name |
| `logo` | Media | No | Partner logo |
| `url` | String | No | Partner website |
| `order` | Number | No | Display order |
| `isActive` | Boolean | No | Show/hide |

#### `featured-courses`
| Field | Type | Localized | Description |
|-------|------|-----------|-------------|
| `title` | String | Yes | Course title |
| `description` | Text | Yes | Short description |
| `date` | String | Yes | "11 Jan 2026" |
| `hours` | Number | No | CME hours |
| `price` | Number | No | Price in SAR |
| `vectorImage` | Media | No | Decorative SVG |
| `slug` | String | No | URL slug |
| `courseType` | String | Yes | "Live Online" |
| `order` | Number | No | Display order |
| `isActive` | Boolean | No | Show/hide |

#### `instructors`
| Field | Type | Localized | Description |
|-------|------|-----------|-------------|
| `name` | String | Yes | Instructor name |
| `title` | String | Yes | Professional title |
| `bio` | RichText | Yes | Biography |
| `avatar` | Media | No | Profile image |
| `order` | Number | No | Display order |
| `showOnHomepage` | Boolean | No | Show on home page |

#### `testimonials`
| Field | Type | Localized | Description |
|-------|------|-----------|-------------|
| `quote` | Text | Yes | Testimonial text |
| `authorName` | String | Yes | Person's name |
| `authorRole` | String | Yes | Job title/role |
| `authorImage` | Media | No | Optional photo |
| `order` | Number | No | Display order |
| `isActive` | Boolean | No | Show/hide |

#### `navigation-links`
| Field | Type | Localized | Description |
|-------|------|-----------|-------------|
| `label` | String | Yes | Link text |
| `url` | String | No | URL path |
| `location` | Enum | No | navbar/footer-platform/footer-org/footer-support |
| `order` | Number | No | Display order |
| `isActive` | Boolean | No | Show/hide |
| `hasDropdown` | Boolean | No | Has submenu |
| `dropdownItems` | Component (repeatable) | Yes | Submenu items |

#### `payment-methods`
| Field | Type | Localized | Description |
|-------|------|-----------|-------------|
| `name` | String | No | "Visa", "Mastercard", etc. |
| `icon` | Media | No | Payment icon |
| `order` | Number | No | Display order |
| `isActive` | Boolean | No | Show/hide |

---

## Phase 3: Frontend Integration

### 3.1 Create Strapi Client
Create utility for fetching data from Strapi API.

**File:** `frontend/src/lib/strapi/client.ts`
```typescript
// Strapi API client configuration
// - Base URL from environment variable
// - API token authentication
// - Error handling
// - Response transformation
```

### 3.2 Create Data Fetching Functions

**File:** `frontend/src/lib/strapi/api.ts`
```typescript
// Server-side data fetching functions
// - getHomePage(locale)
// - getSiteSettings(locale)
// - getPartners(locale)
// - getFeaturedCourses(locale)
// - getInstructors(locale)
// - getTestimonials(locale)
// - getNavigationLinks(locale)
// - getPaymentMethods()
```

### 3.3 Create TypeScript Types

**File:** `frontend/src/lib/strapi/types.ts`
```typescript
// Type definitions for all Strapi content types
// - HomePage
// - SiteSettings
// - Partner
// - FeaturedCourse
// - Instructor
// - Testimonial
// - NavigationLink
// - PaymentMethod
```

### 3.4 Update Components

Update each component to receive data as props instead of using translation files:

| Component | Changes |
|-----------|---------|
| `Navbar.tsx` | Receive nav links from Strapi |
| `Hero.tsx` | Receive hero content from Strapi |
| `Partners.tsx` | Receive partners array from Strapi |
| `FeaturedCourses.tsx` | Receive courses array from Strapi |
| `BecomeTrainer.tsx` | Receive section content from Strapi |
| `ExpertInstructors.tsx` | Receive instructors from Strapi |
| `Testimonials.tsx` | Receive testimonials from Strapi |
| `CTASection.tsx` | Receive CTA content from Strapi |
| `Footer.tsx` | Receive footer content from Strapi |

### 3.5 Update Home Page

**File:** `frontend/src/app/[locale]/page.tsx`
```typescript
// Fetch all home page data server-side
// Pass data to components as props
// Handle loading states
// Implement error boundaries
```

### 3.6 Configure Next.js

**File:** `frontend/next.config.ts`
- Add Strapi domain to remote image patterns
- Configure revalidation for ISR (Incremental Static Regeneration)

### 3.7 Environment Variables

**File:** `frontend/.env.local`
```
NEXT_PUBLIC_STRAPI_URL=http://localhost:1337
STRAPI_API_TOKEN=your-api-token
```

---

## Phase 4: Content Migration

### 4.1 Migrate Static Content
1. Extract all text from translation files (`messages/en.json`, `messages/ar.json`)
2. Upload all images to Strapi media library
3. Create content entries in Strapi admin panel

### 4.2 Migrate Blog Content (from Sanity)
1. Export existing blog posts from Sanity
2. Create `blog-posts` and `blog-categories` content types in Strapi
3. Import content to Strapi
4. Update blog pages to fetch from Strapi

### 4.3 Remove Sanity
1. Remove Sanity dependencies from `package.json`
2. Delete `frontend/src/lib/sanity/` folder
3. Delete `studio/` folder
4. Remove Sanity environment variables

---

## Phase 5: Additional Pages (After Home Page)

Once home page is complete, extend to other pages:

### Marketing Pages
| Page | Content Types Needed |
|------|---------------------|
| `/about` | `about-page` (single type) |
| `/courses` | `courses` (collection), `course-page` (single) |
| `/courses/[slug]` | Uses `courses` collection |
| `/blogs` | `blog-posts`, `blog-categories` (collections) |
| `/blogs/[slug]` | Uses `blog-posts` collection |
| `/instructors` | Uses `instructors` collection |
| `/partners` | Uses `partners` collection |
| `/certifications` | `certifications-page` (single), `certifications` (collection) |
| `/contact` | `contact-page` (single) |
| `/faq` | `faq-page` (single), `faq-items` (collection) |
| `/policies` | `policies-page` (single) |
| `/privacy` | `privacy-page` (single) |
| `/terms` | `terms-page` (single) |
| `/nelc` | `nelc-page` (single) |
| `/become-trainer` | `become-trainer-page` (single) |
| `/feedback` | `feedback-page` (single) |

### Student Dashboard
Dashboard pages may use different content types or remain static depending on requirements.

---

## Implementation Order

### Week 1: Foundation
- [x] Create plan (this document)
- [ ] Set up Strapi project in `strapi/` folder
- [ ] Configure i18n (English/Arabic)
- [ ] Create all content types for home page
- [ ] Set up API permissions

### Week 2: Frontend Integration
- [ ] Create Strapi client utilities
- [ ] Create TypeScript types
- [ ] Create data fetching functions
- [ ] Update Navbar component
- [ ] Update Hero component
- [ ] Update Partners component

### Week 3: Complete Home Page
- [ ] Update FeaturedCourses component
- [ ] Update BecomeTrainer component
- [ ] Update ExpertInstructors component
- [ ] Update Testimonials component
- [ ] Update CTASection component
- [ ] Update Footer component
- [ ] Test bilingual content switching

### Week 4: Content Migration & Cleanup
- [ ] Upload all media to Strapi
- [ ] Enter all content in Strapi admin
- [ ] Test home page end-to-end
- [ ] Begin blog migration from Sanity

### Subsequent Weeks: Extend to Other Pages
- [ ] About page
- [ ] Courses pages
- [ ] Blog pages
- [ ] Other marketing pages
- [ ] Remove Sanity completely

---

## Technical Notes

### Strapi API Response Format
```json
{
  "data": {
    "id": 1,
    "attributes": {
      "heroTitle": "Health Training &",
      "localizations": {
        "data": [{
          "attributes": {
            "heroTitle": "التدريب الصحي و",
            "locale": "ar"
          }
        }]
      }
    }
  }
}
```

### Fetching Localized Content
```typescript
// Fetch with locale parameter
const response = await fetch(
  `${STRAPI_URL}/api/home-page?locale=${locale}&populate=*`
);
```

### Image URL Construction
```typescript
// Strapi media URL
const imageUrl = `${STRAPI_URL}${image.data.attributes.url}`;
```

---

## Questions Before Starting

1. **Database preference**: SQLite (simpler) or PostgreSQL (production-ready)?
2. **Hosting**: Where will Strapi be deployed? (Local, VPS, Railway, Render, etc.)
3. **Media storage**: Local uploads or cloud storage (Cloudinary, AWS S3)?
4. **Preview mode**: Do you need draft/preview functionality before publishing?

---

## Ready to Proceed?

Once you approve this plan, I will:
1. Create the `strapi/` folder and initialize Strapi
2. Configure internationalization
3. Create all content types for the home page
4. Set up the frontend integration utilities
5. Update the home page components one by one

Let me know if you'd like any modifications to this plan!
