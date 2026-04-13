/**
 * Strapi Dynamic Zone Blocks Seeder
 *
 * Seeds the `blocks` dynamic zone field on all 13 CMS pages.
 * Companion to seed-content.js — run that first for flat fields, then this for blocks.
 *
 * Usage:
 *   1. Make sure Strapi is running (npm run develop)
 *   2. Create an API token in Strapi Admin > Settings > API Tokens (with full access)
 *   3. Run: STRAPI_API_TOKEN=your_token node scripts/seed-blocks.js
 */

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || '';

if (!STRAPI_API_TOKEN) {
  console.error('Error: STRAPI_API_TOKEN environment variable is required.');
  console.error('Usage: STRAPI_API_TOKEN=your_token node scripts/seed-blocks.js');
  process.exit(1);
}

// ─── API Helpers ─────────────────────────────────────────────

async function apiRequest(endpoint, method = 'GET', data = null) {
  const url = `${STRAPI_URL}/api${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${STRAPI_API_TOKEN}`
    }
  };
  if (data) {
    options.body = JSON.stringify({ data });
  }
  const response = await fetch(url, options);
  const text = await response.text();
  let result;
  try {
    result = text ? JSON.parse(text) : { data: null };
  } catch {
    if (!response.ok) throw new Error(`API request failed: ${response.status} - ${text}`);
    return { data: null };
  }
  if (!response.ok) {
    console.error(`API Error for ${endpoint}:`, result);
    throw new Error(`API request failed: ${response.status}`);
  }
  return result;
}

async function publishSingleType(endpoint, locale, label) {
  try {
    await apiRequest(`${endpoint}/actions/publish?locale=${locale}`, 'POST');
    console.log(`  Published ${label} (${locale})`);
  } catch (error) {
    console.error(`  Failed to publish ${label} (${locale}):`, error.message);
  }
}

async function seedSingleType(endpoint, locale, data, label) {
  console.log(`\nSeeding blocks for ${label} (${locale})...`);
  try {
    await apiRequest(`${endpoint}?locale=${locale}`, 'PUT', data);
    console.log(`  Saved ${label} (${locale})`);
    await publishSingleType(endpoint, locale, label);
  } catch (error) {
    console.error(`  Failed to seed ${label} (${locale}):`, error.message);
  }
}

// ─── Block Builder Helpers ───────────────────────────────────

const B = {
  heroBanner: (opts) => ({ __component: 'blocks.hero-banner', visibility: 'all', ...opts }),
  partnersStrip: (opts) => ({ __component: 'blocks.partners-strip', visibility: 'all', ...opts }),
  featuredCoursesGrid: (opts) => ({ __component: 'blocks.featured-courses-grid', visibility: 'all', ...opts }),
  ctaBanner: (opts) => ({ __component: 'blocks.cta-banner', visibility: 'all', ...opts }),
  instructorsGrid: (opts) => ({ __component: 'blocks.instructors-grid', visibility: 'all', ...opts }),
  testimonialsCarousel: (opts) => ({ __component: 'blocks.testimonials-carousel', visibility: 'all', ...opts }),
  richTextBlock: (opts) => ({ __component: 'blocks.rich-text-block', visibility: 'all', ...opts }),
  cardsGrid: (opts) => ({ __component: 'blocks.cards-grid', visibility: 'all', ...opts }),
  statsNumbersBlock: (opts) => ({ __component: 'blocks.stats-numbers-block', visibility: 'all', ...opts }),
  faqAccordion: (opts) => ({ __component: 'blocks.faq-accordion', visibility: 'all', ...opts }),
  policySectionsBlock: (opts) => ({ __component: 'blocks.policy-sections-block', visibility: 'all', ...opts }),
  contactFormBlock: (opts) => ({ __component: 'blocks.contact-form-block', visibility: 'all', ...opts }),
  feedbackFormBlock: (opts) => ({ __component: 'blocks.feedback-form-block', visibility: 'all', ...opts }),
  trainerFormBlock: (opts) => ({ __component: 'blocks.trainer-form-block', visibility: 'all', ...opts }),
  certificationCardsBlock: (opts) => ({ __component: 'blocks.certification-cards-block', visibility: 'all', ...opts }),
};

// ─── Page Seeders ────────────────────────────────────────────
// Each function returns { blocks, metaTitle, metaDescription }

function getHomePage(locale) {
  const en = locale === 'en';
  return {
    blocks: [
      B.heroBanner({
        title: en ? 'Health Training &' : '\u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0627\u0644\u0635\u062d\u064a',
        titleLine2: en ? 'eLearning Courses' : '\u0648\u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a',
        titleMobile: en ? 'Health Training & eLearning Courses' : '\u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0627\u0644\u0635\u062d\u064a \u0648\u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a',
        description: en
          ? 'Delivering NELC-compliant training, accredited programs, and live learning experiences for the health sector \u2014 all in one secure platform.'
          : '\u0646\u0642\u062f\u0645 \u062a\u062f\u0631\u064a\u0628\u064b\u0627 \u0645\u062a\u0648\u0627\u0641\u0642\u064b\u0627 \u0645\u0639 \u0627\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u0648\u0637\u0646\u064a \u0644\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a \u0648\u0628\u0631\u0627\u0645\u062c \u0645\u0639\u062a\u0645\u062f\u0629 \u0648\u062a\u062c\u0627\u0631\u0628 \u062a\u0639\u0644\u0645 \u0645\u0628\u0627\u0634\u0631\u0629 \u0644\u0644\u0642\u0637\u0627\u0639 \u0627\u0644\u0635\u062d\u064a - \u0643\u0644 \u0630\u0644\u0643 \u0641\u064a \u0645\u0646\u0635\u0629 \u0648\u0627\u062d\u062f\u0629 \u0622\u0645\u0646\u0629.',
        buttons: [
          { label: en ? 'Explore Training Programs' : '\u0627\u0633\u062a\u0643\u0634\u0641 \u0627\u0644\u0628\u0631\u0627\u0645\u062c \u0627\u0644\u062a\u062f\u0631\u064a\u0628\u064a\u0629', url: en ? '/en/courses' : '/ar/courses', variant: 'primary' },
          { label: en ? 'Get Started' : '\u0627\u0628\u062f\u0623 \u0627\u0644\u0622\u0646', url: en ? '/en/register' : '/ar/register', variant: 'secondary' },
        ],
      }),
      B.partnersStrip({
        title: en ? 'Our Trusted Partners' : '\u0634\u0631\u0643\u0627\u0624\u0646\u0627 \u0627\u0644\u0645\u0648\u062b\u0648\u0642\u0648\u0646',
      }),
      B.featuredCoursesGrid({
        title: en ? 'Featured Programs' : '\u0627\u0644\u0628\u0631\u0627\u0645\u062c \u0627\u0644\u0645\u0645\u064a\u0632\u0629',
        description: en ? 'Accredited, evidence-based healthcare training programs.' : '\u0628\u0631\u0627\u0645\u062c \u062a\u062f\u0631\u064a\u0628 \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629 \u0627\u0644\u0645\u0639\u062a\u0645\u062f\u0629 \u0648\u0627\u0644\u0645\u0628\u0646\u064a\u0629 \u0639\u0644\u0649 \u0627\u0644\u0623\u062f\u0644\u0629.',
        viewAllLabel: en ? 'View All Programs' : '\u0639\u0631\u0636 \u062c\u0645\u064a\u0639 \u0627\u0644\u0628\u0631\u0627\u0645\u062c',
        viewAllLink: en ? '/en/courses' : '/ar/courses',
        maxItems: 4,
      }),
      B.ctaBanner({
        title: en ? 'Become a Trainer' : '\u0643\u0646 \u0645\u062f\u0631\u0628\u064b\u0627',
        description: en
          ? 'Join a network of accredited trainers delivering NELC-aligned healthcare education nationwide.'
          : '\u0627\u0646\u0636\u0645 \u0625\u0644\u0649 \u0634\u0628\u0643\u0629 \u0645\u0646 \u0627\u0644\u0645\u062f\u0631\u0628\u064a\u0646 \u0627\u0644\u0645\u0639\u062a\u0645\u062f\u064a\u0646 \u0627\u0644\u0630\u064a\u0646 \u064a\u0642\u062f\u0645\u0648\u0646 \u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629 \u0627\u0644\u0645\u062a\u0648\u0627\u0641\u0642 \u0645\u0639 \u0627\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u0648\u0637\u0646\u064a \u0639\u0644\u0649 \u0645\u0633\u062a\u0648\u0649 \u0627\u0644\u0645\u0645\u0644\u0643\u0629.',
        variant: 'image-left',
        buttons: [
          { label: en ? 'Get Started' : '\u0627\u0628\u062f\u0623 \u0627\u0644\u0622\u0646', url: en ? '/en/become-trainer' : '/ar/become-trainer', variant: 'primary' },
        ],
      }),
      B.instructorsGrid({
        title: en ? 'Led by Expert Healthcare Instructors' : '\u0628\u0642\u064a\u0627\u062f\u0629 \u062e\u0628\u0631\u0627\u0621 \u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0627\u0644\u0635\u062d\u064a',
        description: en
          ? 'Learn from experienced clinicians, certified trainers, and subject-matter experts who deliver nationally aligned, evidence-based healthcare education.'
          : '\u062a\u0639\u0644\u0645 \u0645\u0646 \u0623\u0637\u0628\u0627\u0621 \u0630\u0648\u064a \u062e\u0628\u0631\u0629 \u0648\u0645\u062f\u0631\u0628\u064a\u0646 \u0645\u0639\u062a\u0645\u062f\u064a\u0646 \u0648\u062e\u0628\u0631\u0627\u0621 \u0645\u062a\u062e\u0635\u0635\u064a\u0646 \u064a\u0642\u062f\u0645\u0648\u0646 \u062a\u0639\u0644\u064a\u0645\u064b\u0627 \u0635\u062d\u064a\u064b\u0627 \u0642\u0627\u0626\u0645\u064b\u0627 \u0639\u0644\u0649 \u0627\u0644\u0623\u062f\u0644\u0629 \u0648\u0645\u062a\u0648\u0627\u0641\u0642\u064b\u0627 \u0648\u0637\u0646\u064a\u064b\u0627.',
        filterSection: 'all',
        showHomepageOnly: true,
      }),
      B.testimonialsCarousel({
        title: en ? 'What Healthcare Professionals Say' : '\u0622\u0631\u0627\u0621 \u0627\u0644\u0645\u062a\u062e\u0635\u0635\u064a\u0646 \u0641\u064a \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629',
        description: en
          ? 'Feedback from healthcare professionals and institutions who have participated in our accredited training programs.'
          : '\u062a\u0639\u0644\u064a\u0642\u0627\u062a \u0645\u0646 \u0645\u062a\u062e\u0635\u0635\u064a \u0648\u0645\u0624\u0633\u0633\u0627\u062a \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629 \u0627\u0644\u0630\u064a\u0646 \u0634\u0627\u0631\u0643\u0648\u0627 \u0641\u064a \u0628\u0631\u0627\u0645\u062c\u0646\u0627 \u0627\u0644\u062a\u062f\u0631\u064a\u0628\u064a\u0629 \u0627\u0644\u0645\u0639\u062a\u0645\u062f\u0629.',
      }),
      B.ctaBanner({
        title: en ? 'Start Your Healthcare Learning Journey' : '\u0627\u0628\u062f\u0623 \u0631\u062d\u0644\u062a\u0643 \u0627\u0644\u062a\u0639\u0644\u064a\u0645\u064a\u0629 \u0641\u064a \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629',
        description: en
          ? 'Access accredited, NELC-aligned training programs designed for healthcare professionals and institutions.'
          : '\u0627\u062d\u0635\u0644 \u0639\u0644\u0649 \u0628\u0631\u0627\u0645\u062c \u062a\u062f\u0631\u064a\u0628\u064a\u0629 \u0645\u0639\u062a\u0645\u062f\u0629 \u0648\u0645\u062a\u0648\u0627\u0641\u0642\u0629 \u0645\u0639 \u0627\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u0648\u0637\u0646\u064a \u0644\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a \u0645\u0635\u0645\u0645\u0629 \u0644\u0645\u062a\u062e\u0635\u0635\u064a \u0648\u0645\u0624\u0633\u0633\u0627\u062a \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629.',
        variant: 'centered',
        buttons: [
          { label: en ? 'Get Started' : '\u0627\u0628\u062f\u0623 \u0627\u0644\u0622\u0646', url: en ? '/en/courses' : '/ar/courses', variant: 'primary' },
        ],
      }),
    ],
    metaTitle: en ? 'Home - PhysioGuidance' : '\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629 - \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633',
    metaDescription: en
      ? 'NELC-compliant healthcare eLearning and training platform.'
      : '\u0645\u0646\u0635\u0629 \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a \u0648\u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0627\u0644\u0635\u062d\u064a \u0627\u0644\u0645\u062a\u0648\u0627\u0641\u0642\u0629 \u0645\u0639 NELC.',
  };
}

function getAboutPage(locale) {
  const en = locale === 'en';
  const complianceContent = en
    ? '- Fully aligned with NELC eLearning standards for the health sector\n- Structured learning objectives, assessments, and certification workflows\n- Comprehensive compliance documentation and audit readiness\n- Secure data handling and learner privacy controls'
    : '- \u0645\u062a\u0648\u0627\u0641\u0642 \u062a\u0645\u0627\u0645\u064b\u0627 \u0645\u0639 \u0645\u0639\u0627\u064a\u064a\u0631 NELC \u0644\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a \u0644\u0642\u0637\u0627\u0639 \u0627\u0644\u0635\u062d\u0629\n- \u0623\u0647\u062f\u0627\u0641 \u0627\u0644\u062a\u0639\u0644\u0645 \u0627\u0644\u0645\u0646\u0638\u0645\u0629 \u0648\u0627\u0644\u062a\u0642\u064a\u064a\u0645\u0627\u062a \u0648\u0633\u064a\u0631 \u0639\u0645\u0644 \u0627\u0644\u0634\u0647\u0627\u062f\u0627\u062a\n- \u0648\u062b\u0627\u0626\u0642 \u0627\u0644\u0627\u0645\u062a\u062b\u0627\u0644 \u0627\u0644\u0634\u0627\u0645\u0644\u0629 \u0648\u0627\u0644\u0627\u0633\u062a\u0639\u062f\u0627\u062f \u0644\u0644\u062a\u062f\u0642\u064a\u0642\n- \u0627\u0644\u062a\u0639\u0627\u0645\u0644 \u0627\u0644\u0622\u0645\u0646 \u0645\u0639 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0648\u0636\u0648\u0627\u0628\u0637 \u062e\u0635\u0648\u0635\u064a\u0629 \u0627\u0644\u0645\u062a\u0639\u0644\u0645';
  return {
    blocks: [
      B.heroBanner({
        title: en ? 'About Us' : '\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0639\u0646\u0627',
        description: en
          ? 'Our platform is a fully NELC-compliant digital learning ecosystem designed specifically for the health sector.'
          : '\u0645\u0646\u0635\u062a\u0646\u0627 \u0647\u064a \u0646\u0638\u0627\u0645 \u062a\u0639\u0644\u0645 \u0631\u0642\u0645\u064a \u0645\u062a\u0648\u0627\u0641\u0642 \u062a\u0645\u0627\u0645\u064b\u0627 \u0645\u0639 NELC \u0645\u0635\u0645\u0645 \u062e\u0635\u064a\u0635\u064b\u0627 \u0644\u0644\u0642\u0637\u0627\u0639 \u0627\u0644\u0635\u062d\u064a.',
        buttons: [
          { label: en ? 'Explore Training Programs' : '\u0627\u0633\u062a\u0643\u0634\u0641 \u0628\u0631\u0627\u0645\u062c \u0627\u0644\u062a\u062f\u0631\u064a\u0628', url: en ? '/en/courses' : '/ar/courses', variant: 'primary' },
          { label: en ? 'Get Started' : '\u0627\u0628\u062f\u0623 \u0627\u0644\u0622\u0646', url: en ? '/en/register' : '/ar/register', variant: 'secondary' },
        ],
      }),
      B.richTextBlock({
        content: `## ${en ? 'Compliance & Standards' : '\u0627\u0644\u0627\u0645\u062a\u062b\u0627\u0644 \u0648\u0627\u0644\u0645\u0639\u0627\u064a\u064a\u0631'}\n\n${complianceContent}`,
        maxWidth: 'medium',
      }),
      B.cardsGrid({
        title: en ? 'Learning Experience' : '\u062a\u062c\u0631\u0628\u0629 \u0627\u0644\u062a\u0639\u0644\u0645',
        description: en ? 'Flexible Learning for Modern Healthcare Professionals' : '\u0627\u0644\u062a\u0639\u0644\u0645 \u0627\u0644\u0645\u0631\u0646 \u0644\u0645\u062a\u062e\u0635\u0635\u064a \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629 \u0627\u0644\u062d\u062f\u064a\u062b\u0629',
        columns: '3',
        cards: [
          { title: en ? 'Self-paced accredited courses' : '\u062f\u0648\u0631\u0627\u062a \u0645\u0639\u062a\u0645\u062f\u0629 \u0630\u0627\u062a\u064a\u0629 \u0627\u0644\u0633\u0631\u0639\u0629' },
          { title: en ? 'Zoom-based live lectures and workshops' : '\u0645\u062d\u0627\u0636\u0631\u0627\u062a \u0648\u0648\u0631\u0634 \u0639\u0645\u0644 \u062d\u064a\u0629 \u062a\u0639\u062a\u0645\u062f \u0639\u0644\u0649 \u0628\u0631\u0646\u0627\u0645\u062c Zoom' },
          { title: en ? 'Digital certificates upon completion' : '\u0627\u0644\u0634\u0647\u0627\u062f\u0627\u062a \u0627\u0644\u0631\u0642\u0645\u064a\u0629 \u0639\u0646\u062f \u0627\u0644\u0627\u0646\u062a\u0647\u0627\u0621' },
        ],
      }),
      B.cardsGrid({
        title: en ? 'Platform Capabilities' : '\u0642\u062f\u0631\u0627\u062a \u0627\u0644\u0645\u0646\u0635\u0629',
        description: en ? 'Powerful Tools for Learners and Administrators' : '\u0623\u062f\u0648\u0627\u062a \u0642\u0648\u064a\u0629 \u0644\u0644\u0645\u062a\u0639\u0644\u0645\u064a\u0646 \u0648\u0627\u0644\u0625\u062f\u0627\u0631\u064a\u064a\u0646',
        columns: '3',
        cards: [
          { title: en ? 'Bilingual Interface' : '\u0648\u0627\u062c\u0647\u0629 \u062b\u0646\u0627\u0626\u064a\u0629 \u0627\u0644\u0644\u063a\u0629', description: en ? 'Seamless Arabic and English language support' : '\u062f\u0639\u0645 \u0633\u0644\u0633 \u0644\u0644\u063a\u062a\u064a\u0646 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0648\u0627\u0644\u0625\u0646\u062c\u0644\u064a\u0632\u064a\u0629' },
          { title: en ? 'Advanced Dashboards' : '\u0644\u0648\u062d\u0627\u062a \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u0645\u062a\u0642\u062f\u0645\u0629', description: en ? 'Track learner progress, performance, and engagement' : '\u062a\u062a\u0628\u0639 \u062a\u0642\u062f\u0645 \u0627\u0644\u0645\u062a\u0639\u0644\u0645 \u0648\u0623\u062f\u0627\u0626\u0647 \u0648\u0645\u0634\u0627\u0631\u0643\u062a\u0647' },
          { title: en ? 'Secure Payments' : '\u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0627\u062a \u0627\u0644\u0622\u0645\u0646\u0629', description: en ? 'Encrypted transactions and controlled access' : '\u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0627\u062a \u0627\u0644\u0645\u0634\u0641\u0631\u0629 \u0648\u0627\u0644\u062a\u062d\u0643\u0645 \u0641\u064a \u0627\u0644\u0648\u0635\u0648\u0644' },
          { title: en ? 'Instructor Management' : '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0639\u0644\u0645\u064a\u0646', description: en ? 'Manage trainers, schedules, and course delivery' : '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u062f\u0631\u0628\u064a\u0646 \u0648\u0627\u0644\u062c\u062f\u0627\u0648\u0644 \u0627\u0644\u0632\u0645\u0646\u064a\u0629 \u0648\u062a\u0642\u062f\u064a\u0645 \u0627\u0644\u062f\u0648\u0631\u0629' },
          { title: en ? 'Reporting & Analytics' : '\u0627\u0644\u062a\u0642\u0627\u0631\u064a\u0631 \u0648\u0627\u0644\u062a\u062d\u0644\u064a\u0644\u0627\u062a', description: en ? 'Exportable reports aligned with NELC requirements' : '\u062a\u0642\u0627\u0631\u064a\u0631 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u062a\u0635\u062f\u064a\u0631 \u062a\u062a\u0645\u0627\u0634\u0649 \u0645\u0639 \u0645\u062a\u0637\u0644\u0628\u0627\u062a NELC' },
          { title: en ? 'Role-based Access' : '\u0627\u0644\u0648\u0635\u0648\u0644 \u0627\u0644\u0642\u0627\u0626\u0645 \u0639\u0644\u0649 \u0627\u0644\u062f\u0648\u0631', description: en ? 'Controlled permissions for learners, instructors, and admins' : '\u0623\u0630\u0648\u0646\u0627\u062a \u062e\u0627\u0636\u0639\u0629 \u0644\u0644\u0631\u0642\u0627\u0628\u0629 \u0644\u0644\u0645\u062a\u0639\u0644\u0645\u064a\u0646 \u0648\u0627\u0644\u0645\u062f\u0631\u0633\u064a\u0646 \u0648\u0627\u0644\u0645\u0633\u0624\u0648\u0644\u064a\u0646' },
        ],
      }),
    ],
    metaTitle: en ? 'About - PhysioGuidance' : '\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0639\u0646\u0627 - \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633',
    metaDescription: en ? 'About PhysioGuidance - NELC-compliant healthcare eLearning platform.' : '\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0639\u0646 \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633.',
  };
}

function getCertificationsPage(locale) {
  const en = locale === 'en';
  return {
    blocks: [
      B.certificationCardsBlock({
        breadcrumb: en ? 'Certifications and CME' : '\u0627\u0644\u0634\u0647\u0627\u062f\u0627\u062a \u0648 \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631',
        heroTitle: en ? 'Certified Continuing Medical Education (CME)' : '\u0634\u0647\u0627\u062f\u0629 \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631 (CME)',
        heroDescription: en
          ? 'Fully accredited by the Saudi Commission for Health Specialties (SCFHS) and the National eLearning Center (NELC). Earn recognized hours to renew your professional license.'
          : '\u0645\u0639\u062a\u0645\u062f\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0647\u064a\u0626\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0644\u0644\u062a\u062e\u0635\u0635\u0627\u062a \u0627\u0644\u0635\u062d\u064a\u0629 (SCFHS) \u0648\u0627\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u0648\u0637\u0646\u064a \u0644\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a (NELC). \u0627\u062d\u0635\u0644 \u0639\u0644\u0649 \u0633\u0627\u0639\u0627\u062a \u0645\u0639\u062a\u0631\u0641 \u0628\u0647\u0627 \u0644\u062a\u062c\u062f\u064a\u062f \u0631\u062e\u0635\u062a\u0643 \u0627\u0644\u0645\u0647\u0646\u064a\u0629.',
        heroButtonLabel: en ? 'Browse Accredited Courses' : '\u062a\u0635\u0641\u062d \u0627\u0644\u062f\u0648\u0631\u0627\u062a \u0627\u0644\u0645\u0639\u062a\u0645\u062f\u0629',
        nelcTitle: en ? 'NELC Licensed' : '\u0645\u0631\u062e\u0635 \u0645\u0646 NELC',
        nelcDescription: en
          ? 'PhysioGuidance is officially licensed by the National eLearning Center of Saudi Arabia, ensuring the highest standards of digital education quality and compliance.'
          : 'PhysioGuidance \u0645\u0631\u062e\u0635 \u0631\u0633\u0645\u064a\u064b\u0627 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u0648\u0637\u0646\u064a \u0644\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a \u0641\u064a \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629.',
        nelcLicenseLabel: en ? 'License No:' : '\u0631\u0642\u0645 \u0627\u0644\u062a\u0631\u062e\u064a\u0635:',
        nelcLicenseNumber: '123456789',
        scfhsTitle: en ? 'SCFHS Approved' : '\u062a\u0645\u062a \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u064a\u0647 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0647\u064a\u0626\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0644\u0644\u062a\u062e\u0635\u0635\u0627\u062a \u0627\u0644\u0635\u062d\u064a\u0629 (SCFHS)',
        scfhsDescription: en
          ? 'Our medical courses are accredited by the Saudi Commission for Health Specialties. All completion certificates are valid for professional classification and registration renewal via Mumaris Plus.'
          : '\u062f\u0648\u0631\u0627\u062a\u0646\u0627 \u0627\u0644\u0637\u0628\u064a\u0629 \u0645\u0639\u062a\u0645\u062f\u0629 \u0645\u0646 \u0627\u0644\u0647\u064a\u0626\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0644\u0644\u062a\u062e\u0635\u0635\u0627\u062a \u0627\u0644\u0635\u062d\u064a\u0629. \u062c\u0645\u064a\u0639 \u0634\u0647\u0627\u062f\u0627\u062a \u0627\u0644\u0625\u0646\u062c\u0627\u0632 \u0635\u0627\u0644\u062d\u0629 \u0644\u0644\u062a\u0635\u0646\u064a\u0641 \u0627\u0644\u0645\u0647\u0646\u064a \u0648\u062a\u062c\u062f\u064a\u062f \u0627\u0644\u062a\u0633\u062c\u064a\u0644 \u0639\u0628\u0631 Mumaris Plus.',
        scfhsAccreditationLabel: en ? 'Accreditation No:' : '\u0631\u0642\u0645 \u0627\u0644\u0627\u0639\u062a\u0645\u0627\u062f:',
        scfhsAccreditationNumber: '123456789',
        verificationTitle: en ? 'Verify Certificate' : '\u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0634\u0647\u0627\u062f\u0629',
        verificationSubtitle: en ? 'Enter your certificate ID to verify' : '\u0623\u062f\u062e\u0644 \u0645\u0639\u0631\u0641 \u0627\u0644\u0634\u0647\u0627\u062f\u0629 \u0644\u0644\u062a\u062d\u0642\u0642',
        verificationPlaceholder: 'PG-2025-X82910',
        verificationButtonLabel: en ? 'Verify' : '\u062a\u062d\u0642\u0642',
        claimCMETitle: en ? 'How to Claim Your CME Hours' : '\u0643\u064a\u0641\u064a\u0629 \u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0629 \u0628\u0633\u0627\u0639\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631 \u0627\u0644\u062e\u0627\u0635\u0629 \u0628\u0643',
        step1Title: en ? 'Complete the Course' : '\u0623\u0643\u0645\u0644 \u0627\u0644\u062f\u0648\u0631\u0629',
        step1Description: en ? 'Watch all required modules and attend 80% of live webinar sessions (if applicable).' : '\u0634\u0627\u0647\u062f \u062c\u0645\u064a\u0639 \u0627\u0644\u0648\u062d\u062f\u0627\u062a \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u0648\u0627\u062d\u0636\u0631 80% \u0645\u0646 \u062c\u0644\u0633\u0627\u062a \u0627\u0644\u0646\u062f\u0648\u0627\u062a \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629 \u0639\u0628\u0631 \u0627\u0644\u0648\u064a\u0628 (\u0625\u0646 \u0623\u0645\u0643\u0646).',
        step2Title: en ? 'Pass the Assessment' : '\u0627\u062c\u062a\u064a\u0627\u0632 \u0627\u0644\u062a\u0642\u064a\u064a\u0645',
        step2Description: en ? 'Achieve a passing score of 70% or higher on the final evaluation quiz.' : '\u062d\u0642\u0642 \u062f\u0631\u062c\u0629 \u0627\u0644\u0646\u062c\u0627\u062d 70% \u0623\u0648 \u0623\u0639\u0644\u0649 \u0641\u064a \u0627\u062e\u062a\u0628\u0627\u0631 \u0627\u0644\u062a\u0642\u064a\u064a\u0645 \u0627\u0644\u0646\u0647\u0627\u0626\u064a.',
        step3Title: en ? 'Upload CME Hours' : '\u062a\u062d\u0645\u064a\u0644 \u0633\u0627\u0639\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631',
        step3Description: en ? 'Download your certificate instantly and upload the unique ID directly to your Mumaris Plus dashboard.' : '\u0642\u0645 \u0628\u062a\u0646\u0632\u064a\u0644 \u0634\u0647\u0627\u062f\u062a\u0643 \u0639\u0644\u0649 \u0627\u0644\u0641\u0648\u0631 \u0648\u0642\u0645 \u0628\u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0645\u0639\u0631\u0641 \u0627\u0644\u0641\u0631\u064a\u062f \u0645\u0628\u0627\u0634\u0631\u0629 \u0625\u0644\u0649 \u0644\u0648\u062d\u0629 \u0645\u0639\u0644\u0648\u0645\u0627\u062a Mumaris Plus \u0627\u0644\u062e\u0627\u0635\u0629 \u0628\u0643.',
      }),
    ],
    metaTitle: en ? 'Certifications & CME - PhysioGuidance' : '\u0627\u0644\u0634\u0647\u0627\u062f\u0627\u062a \u0648\u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631 - \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633',
    metaDescription: en ? 'SCFHS and NELC accredited CME certifications.' : '\u0634\u0647\u0627\u062f\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631 \u0627\u0644\u0645\u0639\u062a\u0645\u062f\u0629.',
  };
}

function getNelcPage(locale) {
  const en = locale === 'en';
  return {
    blocks: [
      B.heroBanner({
        title: en ? 'Committed to National Quality Standards' : '\u0645\u0644\u062a\u0632\u0645\u0648\u0646 \u0628\u0645\u0639\u0627\u064a\u064a\u0631 \u0627\u0644\u062c\u0648\u062f\u0629 \u0627\u0644\u0648\u0637\u0646\u064a\u0629',
        description: en
          ? 'PhysioGuidance is a fully licensed provider under the National eLearning Center (NELC) of Saudi Arabia.'
          : 'PhysioGuidance \u0647\u0648 \u0645\u0632\u0648\u062f \u0645\u0631\u062e\u0635 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0628\u0645\u0648\u062c\u0628 \u0627\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u0648\u0637\u0646\u064a \u0644\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a (NELC) \u0641\u064a \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629.',
      }),
      B.statsNumbersBlock({
        items: [
          { value: en ? 'Al Madinah Al Munawwarah' : '\u0627\u0644\u0645\u062f\u064a\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629', label: en ? 'License Number' : '\u0631\u0642\u0645 \u0627\u0644\u062a\u0631\u062e\u064a\u0635' },
          { value: en ? 'eLearning Training Facility' : '\u0645\u0631\u0641\u0642 \u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0639\u0644\u0649 \u0627\u0644\u062a\u0639\u0644\u0645 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a', label: en ? 'License Type' : '\u0646\u0648\u0639 \u0627\u0644\u062a\u0631\u062e\u064a\u0635' },
          { value: en ? 'Active' : '\u0646\u0634\u064a\u0637', label: en ? 'Status' : '\u062d\u0627\u0644\u0629' },
        ],
      }),
      B.cardsGrid({
        title: en ? 'Our Compliance' : '\u0627\u0645\u062a\u062b\u0627\u0644\u0646\u0627',
        description: en ? 'We adhere strictly to the NELC\'s operational standards to ensure a premium educational experience' : '\u0646\u062d\u0646 \u0646\u0644\u062a\u0632\u0645 \u0628\u0634\u0643\u0644 \u0635\u0627\u0631\u0645 \u0628\u0627\u0644\u0645\u0639\u0627\u064a\u064a\u0631 \u0627\u0644\u062a\u0634\u063a\u064a\u0644\u064a\u0629 \u0644\u0640 NELC \u0644\u0636\u0645\u0627\u0646 \u062a\u062c\u0631\u0628\u0629 \u062a\u0639\u0644\u064a\u0645\u064a\u0629 \u0645\u062a\u0645\u064a\u0632\u0629',
        columns: '3',
        cards: [
          { title: en ? 'Governance' : '\u0627\u0644\u062d\u0643\u0645', description: en ? 'Transparent policies for attendance, grading, and grievances.' : '\u0633\u064a\u0627\u0633\u0627\u062a \u0634\u0641\u0627\u0641\u0629 \u0644\u0644\u062d\u0636\u0648\u0631 \u0648\u0648\u0636\u0639 \u0627\u0644\u062f\u0631\u062c\u0627\u062a \u0648\u0627\u0644\u062a\u0638\u0644\u0645\u0627\u062a.' },
          { title: en ? 'Technology' : '\u062a\u0643\u0646\u0648\u0644\u0648\u062c\u064a\u0627', description: en ? 'A secure, accessible platform that protects learner data and intellectual property.' : '\u0646\u0638\u0627\u0645 \u0623\u0633\u0627\u0633\u064a \u0622\u0645\u0646 \u064a\u0633\u0647\u0644 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u064a\u0647 \u0648\u064a\u062d\u0645\u064a \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0645\u062a\u0639\u0644\u0645 \u0648\u0627\u0644\u0645\u0644\u0643\u064a\u0629 \u0627\u0644\u0641\u0643\u0631\u064a\u0629.' },
          { title: en ? 'Instruction' : '\u062a\u0639\u0644\u064a\u0645\u0627\u062a', description: en ? 'All courses are designed by subject matter experts and undergo rigorous quality review before publication.' : '\u062a\u0645 \u062a\u0635\u0645\u064a\u0645 \u062c\u0645\u064a\u0639 \u0627\u0644\u062f\u0648\u0631\u0627\u062a \u0627\u0644\u062a\u062f\u0631\u064a\u0628\u064a\u0629 \u0645\u0646 \u0642\u0628\u0644 \u062e\u0628\u0631\u0627\u0621 \u0641\u064a \u0627\u0644\u0645\u0648\u0636\u0648\u0639 \u0648\u062a\u062e\u0636\u0639 \u0644\u0645\u0631\u0627\u062c\u0639\u0629 \u0635\u0627\u0631\u0645\u0629 \u0644\u0644\u062c\u0648\u062f\u0629 \u0642\u0628\u0644 \u0627\u0644\u0646\u0634\u0631.' },
        ],
      }),
    ],
    metaTitle: en ? 'NELC Alignment - PhysioGuidance' : '\u0627\u0644\u062a\u0648\u0627\u0641\u0642 \u0645\u0639 NELC - \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633',
    metaDescription: en ? 'NELC licensed eLearning training facility.' : '\u0645\u0631\u0641\u0642 \u062a\u062f\u0631\u064a\u0628 \u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a \u0645\u0631\u062e\u0635 \u0645\u0646 NELC.',
  };
}

function getPartnersPage(locale) {
  const en = locale === 'en';
  return {
    blocks: [
      B.partnersStrip({
        title: en ? 'Collaborating with Leaders in Healthcare' : '\u0627\u0644\u062a\u0639\u0627\u0648\u0646 \u0645\u0639 \u0627\u0644\u0642\u0627\u062f\u0629 \u0641\u064a \u0645\u062c\u0627\u0644 \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629',
      }),
    ],
    metaTitle: en ? 'Partners - PhysioGuidance' : '\u0627\u0644\u0634\u0631\u0643\u0627\u0621 - \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633',
    metaDescription: en ? 'Our trusted academic and healthcare partners.' : '\u0634\u0631\u0643\u0627\u0624\u0646\u0627 \u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a\u0648\u0646 \u0648\u0627\u0644\u0635\u062d\u064a\u0648\u0646 \u0627\u0644\u0645\u0648\u062b\u0648\u0642\u0648\u0646.',
  };
}

function getInstructorsPage(locale) {
  const en = locale === 'en';
  return {
    blocks: [
      B.instructorsGrid({
        title: en ? 'Meet the experts' : '\u062a\u0639\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u062e\u0628\u0631\u0627\u0621',
        filterSection: 'expert',
      }),
      B.instructorsGrid({
        title: en ? 'Minds Behind Physioguidance' : '\u0627\u0644\u0639\u0642\u0648\u0644 \u0648\u0631\u0627\u0621 \u0627\u0644\u062a\u0648\u062c\u064a\u0647 \u0627\u0644\u0637\u0628\u064a\u0639\u064a',
        filterSection: 'minds',
      }),
    ],
    metaTitle: en ? 'Instructors - PhysioGuidance' : '\u0627\u0644\u0645\u062f\u0631\u0628\u0648\u0646 - \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633',
    metaDescription: en ? 'Expert healthcare instructors and faculty.' : '\u062e\u0628\u0631\u0627\u0621 \u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0627\u0644\u0635\u062d\u064a \u0648\u0623\u0639\u0636\u0627\u0621 \u0647\u064a\u0626\u0629 \u0627\u0644\u062a\u062f\u0631\u064a\u0633.',
  };
}

function getFaqPage(locale) {
  const en = locale === 'en';
  return {
    blocks: [
      B.faqAccordion({
        title: en ? 'FAQs' : '\u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u0634\u0627\u0626\u0639\u0629',
        subtitle: en ? 'Still have any questions?' : '\u0644\u0627 \u064a\u0632\u0627\u0644 \u0644\u062f\u064a\u0643 \u0623\u064a \u0623\u0633\u0626\u0644\u0629\u061f',
        items: [
          {
            question: en ? 'Is PhysioGuidance accredited by SCFHS?' : '\u0647\u0644 PhysioGuidance \u0645\u0639\u062a\u0645\u062f \u0645\u0646 \u0627\u0644\u0647\u064a\u0626\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0644\u0644\u062a\u062e\u0635\u0635\u0627\u062a \u0627\u0644\u0635\u062d\u064a\u0629 (SCFHS)\u061f',
            answer: en ? 'Yes, we are a fully accredited provider. All our CME courses are recognized by the Saudi Commission for Health Specialties.' : '\u0646\u0639\u0645\u060c \u0646\u062d\u0646 \u0645\u0632\u0648\u062f \u0645\u0639\u062a\u0645\u062f \u0628\u0627\u0644\u0643\u0627\u0645\u0644. \u062c\u0645\u064a\u0639 \u062f\u0648\u0631\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631 \u0644\u062f\u064a\u0646\u0627 \u0645\u0639\u062a\u0631\u0641 \u0628\u0647\u0627 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0647\u064a\u0626\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0644\u0644\u062a\u062e\u0635\u0635\u0627\u062a \u0627\u0644\u0635\u062d\u064a\u0629.',
          },
          {
            question: en ? 'How do I upload my CME hours to Mumaris Plus?' : '\u0643\u064a\u0641 \u064a\u0645\u0643\u0646\u0646\u064a \u062a\u062d\u0645\u064a\u0644 \u0633\u0627\u0639\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631 \u0627\u0644\u062e\u0627\u0635\u0629 \u0628\u064a \u0625\u0644\u0649 Mumaris Plus\u061f',
            answer: en ? 'We handle this for you! Once you pass the course, our system automatically reports your hours to Mumaris Plus within 48 hours.' : '\u0646\u062d\u0646 \u0646\u062a\u0639\u0627\u0645\u0644 \u0645\u0639 \u0647\u0630\u0627 \u0645\u0646 \u0623\u062c\u0644\u0643! \u0628\u0645\u062c\u0631\u062f \u0627\u062c\u062a\u064a\u0627\u0632\u0643 \u0627\u0644\u062f\u0648\u0631\u0629\u060c \u064a\u0642\u0648\u0645 \u0646\u0638\u0627\u0645\u0646\u0627 \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b \u0628\u0625\u0628\u0644\u0627\u063a \u0633\u0627\u0639\u0627\u062a\u0643 \u0625\u0644\u0649 Mumaris Plus \u062e\u0644\u0627\u0644 48 \u0633\u0627\u0639\u0629.',
          },
          {
            question: en ? 'My name is spelled wrong on my certificate. How do I fix it?' : '\u0627\u0633\u0645\u064a \u0645\u0643\u062a\u0648\u0628 \u0628\u0634\u0643\u0644 \u062e\u0627\u0637\u0626 \u0641\u064a \u0634\u0647\u0627\u062f\u062a\u064a. \u0643\u064a\u0641 \u064a\u0645\u0643\u0646\u0646\u064a \u0627\u0635\u0644\u0627\u062d\u0647\u0627\u061f',
            answer: en ? 'Your certificate uses the name exactly as it appears in your profile. You can edit your profile settings before generating the certificate. If it\'s already generated, please contact support.' : '\u062a\u0633\u062a\u062e\u062f\u0645 \u0634\u0647\u0627\u062f\u062a\u0643 \u0627\u0644\u0627\u0633\u0645 \u062a\u0645\u0627\u0645\u0627\u064b \u0643\u0645\u0627 \u064a\u0638\u0647\u0631 \u0641\u064a \u0645\u0644\u0641 \u0627\u0644\u062a\u0639\u0631\u064a\u0641 \u0627\u0644\u062e\u0627\u0635 \u0628\u0643. \u0625\u0630\u0627 \u062a\u0645 \u0625\u0646\u0634\u0627\u0624\u0647 \u0628\u0627\u0644\u0641\u0639\u0644\u060c \u0641\u064a\u0631\u062c\u0649 \u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u0628\u0627\u0644\u062f\u0639\u0645.',
          },
        ],
      }),
    ],
    metaTitle: en ? 'FAQ - PhysioGuidance' : '\u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u0634\u0627\u0626\u0639\u0629 - \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633',
    metaDescription: en ? 'Frequently asked questions about PhysioGuidance.' : '\u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u0634\u0627\u0626\u0639\u0629 \u062d\u0648\u0644 \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633.',
  };
}

function getContactPage(locale) {
  const en = locale === 'en';
  return {
    blocks: [
      B.contactFormBlock({
        title: en ? 'Contact Us' : '\u0627\u062a\u0635\u0644 \u0628\u0646\u0627',
        subtitle: en ? 'We are always ready to answer your questions and inquiries.' : '\u0646\u062d\u0646 \u062f\u0627\u0626\u0645\u0627 \u062c\u0627\u0647\u0632\u0648\u0646 \u0644\u0644\u0631\u062f \u0639\u0644\u0649 \u0623\u0633\u0626\u0644\u062a\u0643\u0645 \u0648\u0627\u0633\u062a\u0641\u0633\u0627\u0631\u0627\u062a\u0643\u0645.',
        formFullNameLabel: en ? 'Full Name' : '\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0643\u0627\u0645\u0644',
        formEmailLabel: en ? 'Email address' : '\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a',
        formIssueTypeLabel: en ? 'Select issue type' : '\u062d\u062f\u062f \u0646\u0648\u0639 \u0627\u0644\u0645\u0634\u0643\u0644\u0629',
        formSelectOptionLabel: en ? 'Select an option' : '\u062d\u062f\u062f \u062e\u064a\u0627\u0631\u064b\u0627',
        formPhoneLabel: en ? 'Phone number' : '\u0631\u0642\u0645 \u0627\u0644\u062a\u0644\u064a\u0641\u0648\u0646',
        formSubjectLabel: en ? 'Subject' : '\u0645\u0648\u0636\u0648\u0639',
        formDescriptionLabel: en ? 'Description' : '\u0648\u0635\u0641',
        formCharactersLeftLabel: en ? 'characters left' : '\u062d\u0631\u0641\u0627 \u0628\u0642\u064a',
        formSubmitLabel: en ? 'Submit' : '\u0625\u0631\u0633\u0627\u0644',
        issueTypeTechnicalSupport: en ? 'Technical Support' : '\u0627\u0644\u062f\u0639\u0645 \u0627\u0644\u0641\u0646\u064a',
        issueTypeBillingIssue: en ? 'Billing Issue' : '\u0645\u0634\u0643\u0644\u0629 \u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631',
        issueTypeCourseInquiry: en ? 'Course Inquiry' : '\u0627\u0633\u062a\u0641\u0633\u0627\u0631 \u0639\u0646 \u0627\u0644\u062f\u0648\u0631\u0629',
        issueTypePartnership: en ? 'Partnership' : '\u0634\u0631\u0627\u0643\u0629',
        issueTypeOther: en ? 'Other' : '\u0623\u062e\u0631\u0649',
        generalInquiryLabel: en ? 'General Inquiry' : '\u0627\u0633\u062a\u0641\u0633\u0627\u0631 \u0639\u0627\u0645',
        generalInquiryEmail: 'inquiry@physioguidance.org',
        technicalSupportLabel: en ? 'Technical Support' : '\u0627\u0644\u062f\u0639\u0645 \u0627\u0644\u0641\u0646\u064a',
        technicalSupportPhone: '+966 920035022',
        address: en ? 'Xyz, Saudi Arabia' : '\u0625\u0643\u0633\u064a\u0632\u060c \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629',
        getDirectionsLabel: en ? 'Get Directions' : '\u0627\u0644\u062d\u0635\u0648\u0644 \u0639\u0644\u0649 \u0627\u0644\u0627\u062a\u062c\u0627\u0647\u0627\u062a',
        loadingMapText: en ? 'Loading map...' : '\u062c\u0627\u0631\u064a \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u062e\u0631\u064a\u0637\u0629...',
        mapLatitude: 24.4539,
        mapLongitude: 39.6142,
        mapPopupText: en ? 'PhysioGuidance - Saudi Arabia' : 'PhysioGuidance - \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629',
      }),
    ],
    metaTitle: en ? 'Contact Us - PhysioGuidance' : '\u0627\u062a\u0635\u0644 \u0628\u0646\u0627 - \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633',
    metaDescription: en ? 'Contact PhysioGuidance for support and inquiries.' : '\u062a\u0648\u0627\u0635\u0644 \u0645\u0639 \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633 \u0644\u0644\u062f\u0639\u0645 \u0648\u0627\u0644\u0627\u0633\u062a\u0641\u0633\u0627\u0631\u0627\u062a.',
  };
}

function getFeedbackPage(locale) {
  const en = locale === 'en';
  return {
    blocks: [
      B.feedbackFormBlock({
        title: en ? 'We Value Your Opinion' : '\u0646\u062d\u0646 \u0646\u0642\u062f\u0631 \u0631\u0623\u064a\u0643',
        description: en ? 'Help us improve medical education in the Kingdom. Your feedback goes directly to our Quality Assurance team.' : '\u0633\u0627\u0639\u062f\u0646\u0627 \u0641\u064a \u062a\u062d\u0633\u064a\u0646 \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0641\u064a \u0627\u0644\u0645\u0645\u0644\u0643\u0629. \u064a\u062a\u0645 \u0625\u0631\u0633\u0627\u0644 \u062a\u0639\u0644\u064a\u0642\u0627\u062a\u0643 \u0645\u0628\u0627\u0634\u0631\u0629\u064b \u0625\u0644\u0649 \u0641\u0631\u064a\u0642 \u0636\u0645\u0627\u0646 \u0627\u0644\u062c\u0648\u062f\u0629 \u0644\u062f\u064a\u0646\u0627.',
        formFullNameLabel: en ? 'Full Name' : '\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0643\u0627\u0645\u0644',
        formEmailLabel: en ? 'Email address' : '\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a',
        formSubjectLabel: en ? 'Subject' : '\u0645\u0648\u0636\u0648\u0639',
        formDescriptionLabel: en ? 'Description' : '\u0648\u0635\u0641',
        formCharactersLeftPrefix: en ? '' : '\u0628\u0642\u064a',
        formCharactersLeftSuffix: en ? 'characters left' : '\u062d\u0631\u0641\u0627',
        formSubmitLabel: en ? 'Submit' : '\u064a\u0642\u062f\u0645',
      }),
    ],
    metaTitle: en ? 'Feedback - PhysioGuidance' : '\u0627\u0644\u0645\u0644\u0627\u062d\u0638\u0627\u062a - \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633',
    metaDescription: en ? 'Share your feedback to help us improve.' : '\u0634\u0627\u0631\u0643\u0646\u0627 \u0645\u0644\u0627\u062d\u0638\u0627\u062a\u0643 \u0644\u0645\u0633\u0627\u0639\u062f\u062a\u0646\u0627 \u0641\u064a \u0627\u0644\u062a\u062d\u0633\u064a\u0646.',
  };
}

function getBecomeTrainerPage(locale) {
  const en = locale === 'en';
  return {
    blocks: [
      B.trainerFormBlock({
        pageTitle: en ? 'Become a trainer' : '\u0643\u0646 \u0645\u062f\u0631\u0628\u064b\u0627',
        profileSectionTitle: en ? 'Profile' : '\u062d\u0633\u0627\u0628\u0643 \u062a\u0639\u0631\u064a\u0641\u064a',
        profilePhotoLabel: en ? 'Photo' : '\u0627\u0644\u0635\u0648\u0631\u0629',
        profileAttachCVLabel: en ? 'Attach CV' : '\u0625\u0631\u0641\u0627\u0642 \u0627\u0644\u0633\u064a\u0631\u0629 \u0627\u0644\u0630\u0627\u062a\u064a\u0629',
        profileFullNameLabel: en ? 'Full Name' : '\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0643\u0627\u0645\u0644',
        profileFullNameArabicPlaceholder: en ? 'Arabic (As appears in the certificates)' : '\u0628\u0627\u0644\u0639\u0631\u0628\u064a\u0629 (\u0643\u0645\u0627 \u064a\u0638\u0647\u0631 \u0641\u064a \u0627\u0644\u0634\u0647\u0627\u062f\u0627\u062a)',
        profileFullNameEnglishPlaceholder: en ? 'English (As appears in the certificates)' : '\u0628\u0627\u0644\u0625\u0646\u062c\u0644\u064a\u0632\u064a\u0629 (\u0643\u0645\u0627 \u064a\u0638\u0647\u0631 \u0641\u064a \u0627\u0644\u0634\u0647\u0627\u062f\u0627\u062a)',
        profileEmailLabel: en ? 'Email address' : '\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a',
        profileMobileLabel: en ? 'Mobile Number' : '\u0631\u0642\u0645 \u0627\u0644\u062c\u0648\u0627\u0644',
        profileGenderLabel: en ? 'Gender' : '\u0627\u0644\u062c\u0646\u0633',
        profileNationalityLabel: en ? 'Nationality' : '\u0627\u0644\u062c\u0646\u0633\u064a\u0629',
        profileNationalIdLabel: en ? 'National/Iqama ID' : '\u0631\u0642\u0645 \u0627\u0644\u0647\u0648\u064a\u0629/\u0627\u0644\u0625\u0642\u0627\u0645\u0629',
        profileProfessionLabel: en ? 'Profession' : '\u0627\u0644\u0645\u0647\u0646\u0629',
        profileSpecialityLabel: en ? 'Speciality' : '\u0627\u0644\u062a\u062e\u0635\u0635',
        profileQualificationLabel: en ? 'Qualification' : '\u0627\u0644\u0645\u0624\u0647\u0644 \u0627\u0644\u0639\u0644\u0645\u064a',
        profileRankLabel: en ? 'Rank' : '\u0627\u0644\u0631\u062a\u0628\u0629',
        profileScfhsQuestion: en ? 'Do you have a classification number from scfhs?' : '\u0647\u0644 \u0644\u062f\u064a\u0643 \u0631\u0642\u0645 \u062a\u0635\u0646\u064a\u0641 \u0645\u0646 \u0627\u0644\u0647\u064a\u0626\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0644\u0644\u062a\u062e\u0635\u0635\u0627\u062a \u0627\u0644\u0635\u062d\u064a\u0629\u061f',
        profileTwitterLabel: en ? 'Twitter' : '\u062a\u0648\u064a\u062a\u0631',
        profileLinkedInLabel: en ? 'LinkedIn' : '\u0644\u064a\u0646\u0643\u062f \u0625\u0646',
        resumeSectionTitle: en ? 'Resume' : '\u0627\u0644\u0633\u064a\u0631\u0629 \u0627\u0644\u0630\u0627\u062a\u064a\u0629',
        resumeDescription: en
          ? "Select how you'd like to submit your Resume: either create one directly within the app or upload an existing Resume file."
          : '\u062d\u062f\u062f \u0627\u0644\u0637\u0631\u064a\u0642\u0629 \u0627\u0644\u062a\u064a \u062a\u0641\u0636\u0644\u0647\u0627 \u0644\u062a\u0642\u062f\u064a\u0645 \u0633\u064a\u0631\u062a\u0643 \u0627\u0644\u0630\u0627\u062a\u064a\u0629: \u0625\u0645\u0627 \u0625\u0646\u0634\u0627\u0621 \u0648\u0627\u062d\u062f\u0629 \u0645\u0628\u0627\u0634\u0631\u0629 \u062f\u0627\u062e\u0644 \u0627\u0644\u062a\u0637\u0628\u064a\u0642 \u0623\u0648 \u062a\u062d\u0645\u064a\u0644 \u0645\u0644\u0641 \u0633\u064a\u0631\u0629 \u0630\u0627\u062a\u064a\u0629 \u0645\u0648\u062c\u0648\u062f.',
        resumeUploadLabel: en ? 'Upload your resume' : '\u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0633\u064a\u0631\u0629 \u0627\u0644\u0630\u0627\u062a\u064a\u0629',
        resumeCreateLabel: en ? 'Create your resume' : '\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0633\u064a\u0631\u0629 \u0627\u0644\u0630\u0627\u062a\u064a\u0629',
        resumeEducationLabel: en ? 'Education' : '\u0627\u0644\u062a\u0639\u0644\u064a\u0645',
        resumeProfessionalSkillsLabel: en ? 'Professional Skills' : '\u0627\u0644\u0645\u0647\u0627\u0631\u0627\u062a \u0627\u0644\u0645\u0647\u0646\u064a\u0629',
        resumeScientificResearchesLabel: en ? 'Scientific Researches' : '\u0627\u0644\u0623\u0628\u062d\u0627\u062b \u0627\u0644\u0639\u0644\u0645\u064a\u0629',
        resumeTrainingExperienceLabel: en ? 'Training Experience' : '\u0627\u0644\u062e\u0628\u0631\u0629 \u0627\u0644\u062a\u062f\u0631\u064a\u0628\u064a\u0629',
        resumeClickToUploadLabel: en ? 'Click to upload' : '\u0627\u0646\u0642\u0631 \u0644\u0644\u062a\u062d\u0645\u064a\u0644',
        resumeOrDragDropLabel: en ? 'or drag and drop' : '\u0623\u0648 \u0627\u0633\u062d\u0628 \u0648\u0623\u0641\u0644\u062a',
        resumePdfMaxSizeLabel: en ? 'PDF (max. 10MB)' : 'PDF (\u0627\u0644\u062d\u062f \u0627\u0644\u0623\u0642\u0635\u0649 10 \u0645\u064a\u062c\u0627\u0628\u0627\u064a\u062a)',
        bankAccountSectionTitle: en ? 'Bank Account' : '\u0627\u0644\u062d\u0633\u0627\u0628 \u0627\u0644\u0628\u0646\u0643\u064a',
        bankAccountHolderLabel: en ? 'Account Holder Name' : '\u0627\u0633\u0645 \u0635\u0627\u062d\u0628 \u0627\u0644\u062d\u0633\u0627\u0628',
        bankNameLabel: en ? 'Bank Name' : '\u0627\u0633\u0645 \u0627\u0644\u0628\u0646\u0643',
        bankIbanLabel: en ? 'IBAN' : '\u0631\u0642\u0645 \u0627\u0644\u0622\u064a\u0628\u0627\u0646',
        cancelButtonLabel: en ? 'Cancel' : '\u0625\u0644\u063a\u0627\u0621',
        saveButtonLabel: en ? 'Save' : '\u062d\u0641\u0638',
        yesButtonLabel: en ? 'Yes' : '\u0646\u0639\u0645',
        noButtonLabel: en ? 'No' : '\u0644\u0627',
      }),
    ],
    metaTitle: en ? 'Become a Trainer - PhysioGuidance' : '\u0643\u0646 \u0645\u062f\u0631\u0628\u064b\u0627 - \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633',
    metaDescription: en ? 'Join our network of accredited healthcare trainers.' : '\u0627\u0646\u0636\u0645 \u0625\u0644\u0649 \u0634\u0628\u0643\u062a\u0646\u0627 \u0645\u0646 \u0627\u0644\u0645\u062f\u0631\u0628\u064a\u0646 \u0627\u0644\u0635\u062d\u064a\u064a\u0646 \u0627\u0644\u0645\u0639\u062a\u0645\u062f\u064a\u0646.',
  };
}

function getTermsPage(locale) {
  const en = locale === 'en';
  const sections = en ? [
    { sectionId: 'introduction', sidebarLabel: '1. Introduction', title: '1. Introduction', content: 'Welcome to PhysioGuidance. By accessing our website, enrolling in courses, or using our services, you agree to be bound by these Terms & Conditions.' },
    { sectionId: 'medical-disclaimer', sidebarLabel: '2. Medical Disclaimer', title: '2. Medical Disclaimer', content: 'PhysioGuidance provides educational content for professional development and exam preparation only. Not medical advice.' },
    { sectionId: 'user-accounts', sidebarLabel: '3. User Accounts & Security', title: '3. User Accounts & Security', content: 'You are responsible for maintaining the confidentiality of your login credentials. Accounts are non-transferable.' },
    { sectionId: 'payments', sidebarLabel: '4. Payments & VAT', title: '4. Payments & VAT', content: 'All transactions are processed in Saudi Riyals (SAR). A VAT of 15% is applicable to all purchases.' },
    { sectionId: 'intellectual-property', sidebarLabel: '5. Intellectual Property', title: '5. Intellectual Property Rights', content: 'The PhysioGuidance platform is protected by Saudi Intellectual Property Authority (SIPA) laws.' },
    { sectionId: 'limitation', sidebarLabel: '6. Limitation of Liability', title: '6. Limitation of Liability', content: 'PhysioGuidance shall not be liable for any indirect, incidental, special, or consequential damages.' },
    { sectionId: 'termination', sidebarLabel: '7. Termination of Use', title: '7. Termination of Use', content: 'PhysioGuidance reserves the right to suspend or terminate your account at our sole discretion.' },
    { sectionId: 'governing-law', sidebarLabel: '8. Governing Law', title: '8. Governing Law', content: 'These Terms shall be governed by the laws of the Kingdom of Saudi Arabia.' },
    { sectionId: 'contact', sidebarLabel: '9. Contact Information', title: '9. Contact Information', content: 'We reserve the right to modify these terms at any time. Changes will be effective immediately upon posting.' },
  ] : [
    { sectionId: 'introduction', sidebarLabel: '1. \u0627\u0644\u0645\u0642\u062f\u0645\u0629', title: '1. \u0627\u0644\u0645\u0642\u062f\u0645\u0629', content: '\u0645\u0631\u062d\u0628\u064b\u0627 \u0628\u0643 \u0641\u064a \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633. \u0628\u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0645\u0648\u0642\u0639\u0646\u0627 \u0641\u0625\u0646\u0643 \u062a\u0648\u0627\u0641\u0642 \u0639\u0644\u0649 \u0627\u0644\u0627\u0644\u062a\u0632\u0627\u0645 \u0628\u0647\u0630\u0647 \u0627\u0644\u0634\u0631\u0648\u0637 \u0648\u0627\u0644\u0623\u062d\u0643\u0627\u0645.' },
    { sectionId: 'medical-disclaimer', sidebarLabel: '2. \u0625\u062e\u0644\u0627\u0621 \u0627\u0644\u0645\u0633\u0624\u0648\u0644\u064a\u0629 \u0627\u0644\u0637\u0628\u064a\u0629', title: '2. \u0625\u062e\u0644\u0627\u0621 \u0627\u0644\u0645\u0633\u0624\u0648\u0644\u064a\u0629 \u0627\u0644\u0637\u0628\u064a\u0629', content: '\u062a\u0642\u062f\u0645 \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633 \u0645\u062d\u062a\u0648\u0649 \u062a\u0639\u0644\u064a\u0645\u064a \u0644\u0644\u062a\u0637\u0648\u064a\u0631 \u0627\u0644\u0645\u0647\u0646\u064a \u0641\u0642\u0637. \u0644\u064a\u0633 \u0646\u0635\u064a\u062d\u0629 \u0637\u0628\u064a\u0629.' },
    { sectionId: 'user-accounts', sidebarLabel: '3. \u062d\u0633\u0627\u0628\u0627\u062a \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646 \u0648\u0627\u0644\u0623\u0645\u0627\u0646', title: '3. \u062d\u0633\u0627\u0628\u0627\u062a \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646 \u0648\u0627\u0644\u0623\u0645\u0627\u0646', content: '\u0623\u0646\u062a \u0645\u0633\u0624\u0648\u0644 \u0639\u0646 \u0627\u0644\u062d\u0641\u0627\u0638 \u0639\u0644\u0649 \u0633\u0631\u064a\u0629 \u0628\u064a\u0627\u0646\u0627\u062a \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644. \u0627\u0644\u062d\u0633\u0627\u0628\u0627\u062a \u063a\u064a\u0631 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u062a\u062d\u0648\u064a\u0644.' },
    { sectionId: 'payments', sidebarLabel: '4. \u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0627\u062a \u0648\u0636\u0631\u064a\u0628\u0629 \u0627\u0644\u0642\u064a\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629', title: '4. \u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0627\u062a \u0648\u0636\u0631\u064a\u0628\u0629 \u0627\u0644\u0642\u064a\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629', content: '\u062a\u062a\u0645 \u0645\u0639\u0627\u0644\u062c\u0629 \u062c\u0645\u064a\u0639 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0627\u062a \u0628\u0627\u0644\u0631\u064a\u0627\u0644 \u0627\u0644\u0633\u0639\u0648\u062f\u064a. \u062a\u064f\u0637\u0628\u0642 \u0636\u0631\u064a\u0628\u0629 \u0627\u0644\u0642\u064a\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629 \u0628\u0646\u0633\u0628\u0629 15%.' },
    { sectionId: 'intellectual-property', sidebarLabel: '5. \u0627\u0644\u0645\u0644\u0643\u064a\u0629 \u0627\u0644\u0641\u0643\u0631\u064a\u0629', title: '5. \u062d\u0642\u0648\u0642 \u0627\u0644\u0645\u0644\u0643\u064a\u0629 \u0627\u0644\u0641\u0643\u0631\u064a\u0629', content: '\u0645\u0646\u0635\u0629 \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633 \u0645\u062d\u0645\u064a\u0629 \u0628\u0645\u0648\u062c\u0628 \u0642\u0648\u0627\u0646\u064a\u0646 \u0627\u0644\u0647\u064a\u0626\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 \u0644\u0644\u0645\u0644\u0643\u064a\u0629 \u0627\u0644\u0641\u0643\u0631\u064a\u0629.' },
    { sectionId: 'limitation', sidebarLabel: '6. \u062a\u062d\u062f\u064a\u062f \u0627\u0644\u0645\u0633\u0624\u0648\u0644\u064a\u0629', title: '6. \u062a\u062d\u062f\u064a\u062f \u0627\u0644\u0645\u0633\u0624\u0648\u0644\u064a\u0629', content: '\u0644\u0627 \u062a\u062a\u062d\u0645\u0644 \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633 \u0627\u0644\u0645\u0633\u0624\u0648\u0644\u064a\u0629 \u0639\u0646 \u0623\u064a \u0623\u0636\u0631\u0627\u0631 \u063a\u064a\u0631 \u0645\u0628\u0627\u0634\u0631\u0629 \u0623\u0648 \u062a\u0628\u0639\u064a\u0629.' },
    { sectionId: 'termination', sidebarLabel: '7. \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645', title: '7. \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645', content: '\u062a\u062d\u062a\u0641\u0638 \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633 \u0628\u0627\u0644\u062d\u0642 \u0641\u064a \u062a\u0639\u0644\u064a\u0642 \u0623\u0648 \u0625\u0646\u0647\u0627\u0621 \u062d\u0633\u0627\u0628\u0643.' },
    { sectionId: 'governing-law', sidebarLabel: '8. \u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u062d\u0627\u0643\u0645', title: '8. \u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u062d\u0627\u0643\u0645', content: '\u062a\u062e\u0636\u0639 \u0647\u0630\u0647 \u0627\u0644\u0634\u0631\u0648\u0637 \u0644\u0642\u0648\u0627\u0646\u064a\u0646 \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629.' },
    { sectionId: 'contact', sidebarLabel: '9. \u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u0627\u062a\u0635\u0627\u0644', title: '9. \u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u0627\u062a\u0635\u0627\u0644', content: '\u0646\u062d\u062a\u0641\u0638 \u0628\u0627\u0644\u062d\u0642 \u0641\u064a \u062a\u0639\u062f\u064a\u0644 \u0647\u0630\u0647 \u0627\u0644\u0634\u0631\u0648\u0637 \u0641\u064a \u0623\u064a \u0648\u0642\u062a.' },
  ];
  return {
    blocks: [
      B.policySectionsBlock({
        title: en ? 'Terms & Conditions' : '\u0627\u0644\u0634\u0631\u0648\u0637 \u0648\u0627\u0644\u0623\u062d\u0643\u0627\u0645',
        lastUpdated: en ? 'Last Updated: January 2026' : '\u0622\u062e\u0631 \u062a\u062d\u062f\u064a\u062b: \u064a\u0646\u0627\u064a\u0631 2026',
        sections,
      }),
    ],
    metaTitle: en ? 'Terms & Conditions - PhysioGuidance' : '\u0627\u0644\u0634\u0631\u0648\u0637 \u0648\u0627\u0644\u0623\u062d\u0643\u0627\u0645 - \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633',
    metaDescription: en ? 'Terms and conditions for using PhysioGuidance.' : '\u0634\u0631\u0648\u0637 \u0648\u0623\u062d\u0643\u0627\u0645 \u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633.',
  };
}

function getPrivacyPolicyPage(locale) {
  const en = locale === 'en';
  const sections = en ? [
    { sectionId: 'general-terms', sidebarLabel: '1. General Terms', title: '1. General Terms', content: 'PhysioGuidance is committed to providing high-quality medical education in compliance with NELC and SCFHS.' },
    { sectionId: 'attendance-policy', sidebarLabel: '2. Attendance Policy', title: '2. Attendance Policy (CME Requirements)', content: 'Live Online Courses: 80% attendance required. Recorded Courses: 100% video completion required.' },
    { sectionId: 'assessment', sidebarLabel: '3. Assessment & Grades', title: '3. Assessment & Grades', content: 'Minimum 70% on final assessment. Three retake attempts allowed.' },
    { sectionId: 'academic-integrity', sidebarLabel: '4. Academic Integrity', title: '4. Academic Integrity', content: 'Zero-tolerance policy towards academic dishonesty. Identity verification required.' },
    { sectionId: 'intellectual-property', sidebarLabel: '5. Intellectual Property', title: '5. Intellectual Property Rights', content: 'All course materials are exclusive property of PhysioGuidance. Personal educational use only.' },
    { sectionId: 'refund-policy', sidebarLabel: '6. Cancellation & Refunds', title: '6. Cancellation & Refund Policy', content: 'Self-paced: 48 hour refund window. Live: 3 days before start date.' },
    { sectionId: 'technical-requirements', sidebarLabel: '7. Technical Requirements', title: '7. Technical Requirements', content: 'Stable internet (2 Mbps), compatible browser (Chrome, Safari, Edge).' },
    { sectionId: 'privacy-data', sidebarLabel: '8. Privacy & Data Protection', title: '8. Privacy & Data Protection', content: 'We adhere to SDAIA national data management policies. Data shared only with SCFHS for CME hours.' },
  ] : [
    { sectionId: 'general-terms', sidebarLabel: '1. \u0627\u0644\u0634\u0631\u0648\u0637 \u0627\u0644\u0639\u0627\u0645\u0629', title: '1. \u0627\u0644\u0634\u0631\u0648\u0637 \u0627\u0644\u0639\u0627\u0645\u0629', content: '\u062a\u0644\u062a\u0632\u0645 \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633 \u0628\u062a\u0642\u062f\u064a\u0645 \u062a\u0639\u0644\u064a\u0645 \u0637\u0628\u064a \u0639\u0627\u0644\u064a \u0627\u0644\u062c\u0648\u062f\u0629 \u0645\u062a\u0648\u0627\u0641\u0642 \u0645\u0639 NELC \u0648SCFHS.' },
    { sectionId: 'attendance-policy', sidebarLabel: '2. \u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u062d\u0636\u0648\u0631', title: '2. \u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u062d\u0636\u0648\u0631', content: '\u0627\u0644\u062f\u0648\u0631\u0627\u062a \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629: \u062d\u0636\u0648\u0631 80% \u0645\u0637\u0644\u0648\u0628. \u0627\u0644\u062f\u0648\u0631\u0627\u062a \u0627\u0644\u0645\u0633\u062c\u0644\u0629: \u0625\u0643\u0645\u0627\u0644 100% \u0645\u0646 \u0627\u0644\u0641\u064a\u062f\u064a\u0648 \u0645\u0637\u0644\u0648\u0628.' },
    { sectionId: 'assessment', sidebarLabel: '3. \u0627\u0644\u062a\u0642\u064a\u064a\u0645 \u0648\u0627\u0644\u062f\u0631\u062c\u0627\u062a', title: '3. \u0627\u0644\u062a\u0642\u064a\u064a\u0645 \u0648\u0627\u0644\u062f\u0631\u062c\u0627\u062a', content: '\u062f\u0631\u062c\u0629 \u0627\u0644\u0646\u062c\u0627\u062d 70% \u0643\u062d\u062f \u0623\u062f\u0646\u0649. \u062b\u0644\u0627\u062b \u0645\u062d\u0627\u0648\u0644\u0627\u062a \u0644\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631.' },
    { sectionId: 'academic-integrity', sidebarLabel: '4. \u0627\u0644\u0646\u0632\u0627\u0647\u0629 \u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a\u0629', title: '4. \u0627\u0644\u0646\u0632\u0627\u0647\u0629 \u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a\u0629', content: '\u0633\u064a\u0627\u0633\u0629 \u0639\u062f\u0645 \u0627\u0644\u062a\u0633\u0627\u0645\u062d \u0627\u0644\u0645\u0637\u0644\u0642 \u062a\u062c\u0627\u0647 \u0627\u0644\u063a\u0634 \u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a. \u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0647\u0648\u064a\u0629 \u0645\u0637\u0644\u0648\u0628.' },
    { sectionId: 'intellectual-property', sidebarLabel: '5. \u0627\u0644\u0645\u0644\u0643\u064a\u0629 \u0627\u0644\u0641\u0643\u0631\u064a\u0629', title: '5. \u062d\u0642\u0648\u0642 \u0627\u0644\u0645\u0644\u0643\u064a\u0629 \u0627\u0644\u0641\u0643\u0631\u064a\u0629', content: '\u062c\u0645\u064a\u0639 \u0645\u0648\u0627\u062f \u0627\u0644\u062f\u0648\u0631\u0629 \u0645\u0644\u0643 \u062d\u0635\u0631\u064a \u0644\u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633. \u0644\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0627\u0644\u062a\u0639\u0644\u064a\u0645\u064a \u0627\u0644\u0634\u062e\u0635\u064a \u0641\u0642\u0637.' },
    { sectionId: 'refund-policy', sidebarLabel: '6. \u0627\u0644\u0625\u0644\u063a\u0627\u0621 \u0648\u0627\u0644\u0627\u0633\u062a\u0631\u062f\u0627\u062f', title: '6. \u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u0625\u0644\u063a\u0627\u0621 \u0648\u0627\u0644\u0627\u0633\u062a\u0631\u062f\u0627\u062f', content: '\u0627\u0644\u062f\u0648\u0631\u0627\u062a \u0627\u0644\u0630\u0627\u062a\u064a\u0629: \u0627\u0633\u062a\u0631\u062f\u0627\u062f \u062e\u0644\u0627\u0644 48 \u0633\u0627\u0639\u0629. \u0627\u0644\u062f\u0648\u0631\u0627\u062a \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629: \u0642\u0628\u0644 3 \u0623\u064a\u0627\u0645 \u0645\u0646 \u0627\u0644\u0628\u062f\u0621.' },
    { sectionId: 'technical-requirements', sidebarLabel: '7. \u0627\u0644\u0645\u062a\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u062a\u0642\u0646\u064a\u0629', title: '7. \u0627\u0644\u0645\u062a\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u062a\u0642\u0646\u064a\u0629', content: '\u0627\u062a\u0635\u0627\u0644 \u0625\u0646\u062a\u0631\u0646\u062a \u0645\u0633\u062a\u0642\u0631 (2 \u0645\u064a\u063a\u0627\u0628\u062a), \u0645\u062a\u0635\u0641\u062d \u0645\u062a\u0648\u0627\u0641\u0642 (Chrome, Safari, Edge).' },
    { sectionId: 'privacy-data', sidebarLabel: '8. \u0627\u0644\u062e\u0635\u0648\u0635\u064a\u0629 \u0648\u062d\u0645\u0627\u064a\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a', title: '8. \u0627\u0644\u062e\u0635\u0648\u0635\u064a\u0629 \u0648\u062d\u0645\u0627\u064a\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a', content: '\u0646\u0644\u062a\u0632\u0645 \u0628\u0633\u064a\u0627\u0633\u0627\u062a SDAIA. \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u062a\u064f\u0634\u0627\u0631\u0643 \u0641\u0642\u0637 \u0645\u0639 SCFHS \u0644\u062a\u0633\u062c\u064a\u0644 \u0633\u0627\u0639\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0645\u0633\u062a\u0645\u0631.' },
  ];
  return {
    blocks: [
      B.policySectionsBlock({
        title: en ? 'Privacy Policy' : '\u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u062e\u0635\u0648\u0635\u064a\u0629',
        lastUpdated: en ? 'Last Updated: January 2026' : '\u0622\u062e\u0631 \u062a\u062d\u062f\u064a\u062b: \u064a\u0646\u0627\u064a\u0631 2026',
        sections,
      }),
    ],
    metaTitle: en ? 'Privacy Policy - PhysioGuidance' : '\u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u062e\u0635\u0648\u0635\u064a\u0629 - \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633',
    metaDescription: en ? 'Privacy policy for PhysioGuidance.' : '\u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u062e\u0635\u0648\u0635\u064a\u0629 \u0644\u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633.',
  };
}

function getLearningPoliciesPage(locale) {
  const en = locale === 'en';
  const sections = en ? [
    { sectionId: 'general', sidebarLabel: '1. General Provisions', title: '1. General Provisions', content: 'PhysioGuidance is committed to providing high-quality medical education in compliance with NELC and SCFHS.' },
    { sectionId: 'attendance', sidebarLabel: '2. Attendance Policy', title: '2. Attendance Policy (CME Requirements)', content: 'Live Webinars: 80% attendance. Recorded Courses: 100% video completion.' },
    { sectionId: 'assessment', sidebarLabel: '3. Assessment & Grading', title: '3. Assessment & Grading', content: 'Passing Score: 70% minimum. Three retake attempts. Automated feedback after submission.' },
    { sectionId: 'integrity', sidebarLabel: '4. Academic Integrity', title: '4. Academic Integrity', content: 'Zero-tolerance policy towards academic dishonesty.' },
    { sectionId: 'intellectual', sidebarLabel: '5. Intellectual Property', title: '5. Intellectual Property Rights', content: 'All course materials are exclusive property of PhysioGuidance. Personal educational use only.' },
    { sectionId: 'cancellation', sidebarLabel: '6. Cancellation & Refunds', title: '6. Cancellation & Refund Policy', content: 'Self-Paced: 48 hour refund window. Live: 3 days before start date.' },
    { sectionId: 'technical', sidebarLabel: '7. Technical Requirements', title: '7. Technical Requirements', content: 'Stable internet (2 Mbps), compatible device and browser.' },
    { sectionId: 'privacy', sidebarLabel: '8. Privacy & Data Protection', title: '8. Privacy & Data Protection', content: 'We adhere to SDAIA national data governance policies.' },
  ] : [
    { sectionId: 'general', sidebarLabel: '1. \u0627\u0644\u0623\u062d\u0643\u0627\u0645 \u0627\u0644\u0639\u0627\u0645\u0629', title: '1. \u0627\u0644\u0623\u062d\u0643\u0627\u0645 \u0627\u0644\u0639\u0627\u0645\u0629', content: '\u062a\u0644\u062a\u0632\u0645 \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633 \u0628\u062a\u0642\u062f\u064a\u0645 \u062a\u0639\u0644\u064a\u0645 \u0637\u0628\u064a \u0639\u0627\u0644\u064a \u0627\u0644\u062c\u0648\u062f\u0629 \u0645\u062a\u0648\u0627\u0641\u0642 \u0645\u0639 NELC \u0648SCFHS.' },
    { sectionId: 'attendance', sidebarLabel: '2. \u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u062d\u0636\u0648\u0631', title: '2. \u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u062d\u0636\u0648\u0631', content: '\u0627\u0644\u0646\u062f\u0648\u0627\u062a \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629: \u062d\u0636\u0648\u0631 80%. \u0627\u0644\u062f\u0648\u0631\u0627\u062a \u0627\u0644\u0645\u0633\u062c\u0644\u0629: \u0625\u0643\u0645\u0627\u0644 100% \u0645\u0646 \u0627\u0644\u0641\u064a\u062f\u064a\u0648.' },
    { sectionId: 'assessment', sidebarLabel: '3. \u0627\u0644\u062a\u0642\u064a\u064a\u0645 \u0648\u0627\u0644\u062f\u0631\u062c\u0627\u062a', title: '3. \u0627\u0644\u062a\u0642\u064a\u064a\u0645 \u0648\u0627\u0644\u062f\u0631\u062c\u0627\u062a', content: '\u062f\u0631\u062c\u0629 \u0627\u0644\u0646\u062c\u0627\u062d 70% \u0643\u062d\u062f \u0623\u062f\u0646\u0649. \u062b\u0644\u0627\u062b \u0645\u062d\u0627\u0648\u0644\u0627\u062a. \u062a\u063a\u0630\u064a\u0629 \u0631\u0627\u062c\u0639\u0629 \u062a\u0644\u0642\u0627\u0626\u064a\u0629.' },
    { sectionId: 'integrity', sidebarLabel: '4. \u0627\u0644\u0646\u0632\u0627\u0647\u0629 \u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a\u0629', title: '4. \u0627\u0644\u0646\u0632\u0627\u0647\u0629 \u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a\u0629', content: '\u0633\u064a\u0627\u0633\u0629 \u0639\u062f\u0645 \u0627\u0644\u062a\u0633\u0627\u0645\u062d \u0627\u0644\u0645\u0637\u0644\u0642 \u062a\u062c\u0627\u0647 \u0627\u0644\u063a\u0634 \u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a.' },
    { sectionId: 'intellectual', sidebarLabel: '5. \u0627\u0644\u0645\u0644\u0643\u064a\u0629 \u0627\u0644\u0641\u0643\u0631\u064a\u0629', title: '5. \u062d\u0642\u0648\u0642 \u0627\u0644\u0645\u0644\u0643\u064a\u0629 \u0627\u0644\u0641\u0643\u0631\u064a\u0629', content: '\u062c\u0645\u064a\u0639 \u0645\u0648\u0627\u062f \u0627\u0644\u062f\u0648\u0631\u0629 \u0645\u0644\u0643 \u062d\u0635\u0631\u064a \u0644\u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633.' },
    { sectionId: 'cancellation', sidebarLabel: '6. \u0627\u0644\u0625\u0644\u063a\u0627\u0621 \u0648\u0627\u0644\u0627\u0633\u062a\u0631\u062f\u0627\u062f', title: '6. \u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u0625\u0644\u063a\u0627\u0621 \u0648\u0627\u0644\u0627\u0633\u062a\u0631\u062f\u0627\u062f', content: '\u0627\u0644\u062f\u0648\u0631\u0627\u062a \u0627\u0644\u0630\u0627\u062a\u064a\u0629: \u0627\u0633\u062a\u0631\u062f\u0627\u062f \u062e\u0644\u0627\u0644 48 \u0633\u0627\u0639\u0629. \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629: \u0642\u0628\u0644 3 \u0623\u064a\u0627\u0645.' },
    { sectionId: 'technical', sidebarLabel: '7. \u0627\u0644\u0645\u062a\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u062a\u0642\u0646\u064a\u0629', title: '7. \u0627\u0644\u0645\u062a\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u062a\u0642\u0646\u064a\u0629', content: '\u0627\u062a\u0635\u0627\u0644 \u0625\u0646\u062a\u0631\u0646\u062a \u0645\u0633\u062a\u0642\u0631 (2 \u0645\u064a\u063a\u0627\u0628\u062a) \u0648\u062c\u0647\u0627\u0632 \u0648\u0645\u062a\u0635\u0641\u062d \u0645\u062a\u0648\u0627\u0641\u0642.' },
    { sectionId: 'privacy', sidebarLabel: '8. \u0627\u0644\u062e\u0635\u0648\u0635\u064a\u0629 \u0648\u062d\u0645\u0627\u064a\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a', title: '8. \u0627\u0644\u062e\u0635\u0648\u0635\u064a\u0629 \u0648\u062d\u0645\u0627\u064a\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a', content: '\u0646\u0644\u062a\u0632\u0645 \u0628\u0633\u064a\u0627\u0633\u0627\u062a \u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0648\u0637\u0646\u064a\u0629 \u0644\u0640 SDAIA.' },
  ];
  return {
    blocks: [
      B.policySectionsBlock({
        title: en ? 'Learning Policies' : '\u0633\u064a\u0627\u0633\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u0645',
        lastUpdated: en ? 'Last Updated: January 2026' : '\u0622\u062e\u0631 \u062a\u062d\u062f\u064a\u062b: \u064a\u0646\u0627\u064a\u0631 2026',
        sections,
      }),
    ],
    metaTitle: en ? 'Learning Policies - PhysioGuidance' : '\u0633\u064a\u0627\u0633\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u0645 - \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633',
    metaDescription: en ? 'Learning policies for PhysioGuidance courses.' : '\u0633\u064a\u0627\u0633\u0627\u062a \u0627\u0644\u062a\u0639\u0644\u0645 \u0644\u062f\u0648\u0631\u0627\u062a \u0641\u064a\u0632\u064a\u0648 \u062c\u0627\u064a\u062f\u0646\u0633.',
  };
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  console.log('=== Strapi Dynamic Zone Blocks Seeder ===');
  console.log(`Target: ${STRAPI_URL}\n`);

  // Seed all pages for both locales
  const pages = [
    { fn: getHomePage, endpoint: '/home-page', label: 'Home Page' },
    { fn: getAboutPage, endpoint: '/about-page', label: 'About Page' },
    { fn: getCertificationsPage, endpoint: '/certifications-page', label: 'Certifications Page' },
    { fn: getNelcPage, endpoint: '/nelc-page', label: 'NELC Page' },
    { fn: getPartnersPage, endpoint: '/partners-page', label: 'Partners Page' },
    { fn: getInstructorsPage, endpoint: '/instructors-page', label: 'Instructors Page' },
    { fn: getFaqPage, endpoint: '/faq-page', label: 'FAQ Page' },
    { fn: getContactPage, endpoint: '/contact-page', label: 'Contact Page' },
    { fn: getFeedbackPage, endpoint: '/feedback-page', label: 'Feedback Page' },
    { fn: getBecomeTrainerPage, endpoint: '/become-trainer-page', label: 'Become Trainer Page' },
    { fn: getTermsPage, endpoint: '/terms-page', label: 'Terms Page' },
    { fn: getPrivacyPolicyPage, endpoint: '/privacy-policy-page', label: 'Privacy Policy Page' },
    { fn: getLearningPoliciesPage, endpoint: '/learning-policies-page', label: 'Learning Policies Page' },
  ];

  for (const { fn, endpoint, label } of pages) {
    await seedSingleType(endpoint, 'en', fn('en'), label);
    await seedSingleType(endpoint, 'ar', fn('ar'), label);
  }

  console.log('\n=== Done! All blocks seeded. ===');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
