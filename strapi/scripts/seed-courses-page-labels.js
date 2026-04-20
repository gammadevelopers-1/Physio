/**
 * One-time seed for the Courses Page single type.
 *
 * Populates hero/empty-state, CTA, and all filter chrome labels
 * for both locales. Safe to re-run — Strapi v5 single types use PUT
 * which upserts. After seeding, Amna can edit any field in the admin.
 *
 * Usage:
 *   1. Ensure Strapi is running (npm run develop) and `courses-page` single type
 *      schema has been deployed (restart Strapi after schema.json changes).
 *   2. Set STRAPI_URL (default http://localhost:1337) and STRAPI_API_TOKEN.
 *   3. Run: node scripts/seed-courses-page-labels.js
 */

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN =
  process.env.STRAPI_API_TOKEN ||
  '8f41457b95b507a18e639cb788fc73a6655affac446cf5b6d3cf99d37b32a5db5c43346a196278e43c26661c939fdd752276beefcae02c07caf77405602f6ef6650a56b53b636c49552d68700ec8c75459d65fd2a6a471d09dd88f1e8e4914501c2f426fa2e706761fc1f8a7fed043c9ea5a750ad6a0972df4bf9764c86d78e9';

// ─── Labels ────────────────────────────────────────────────────

const EN = {
  heroTitle: 'Courses',
  heroSubtitle: 'Explore courses and events',
  emptyStateTitle: 'No courses available',
  emptyStateMessage: 'No courses found matching your criteria.',

  ctaTitle: 'Empower Your Workforce with Compliant Healthcare Education',
  ctaDescription:
    'Join a trusted eLearning platform designed to meet national standards and support continuous professional development in the healthcare sector',
  ctaButtonLabel: 'Get Started',
  ctaButtonHref: '/contact',

  // All filter sections visible by default
  showSearchBar: true,
  showDeliveryFilter: true,
  showPricingFilter: true,
  showAvailabilityFilter: true,
  showLanguageFilter: true,
  showSortBy: true,

  searchPlaceholder: 'Search for',
  sidebarFilterTitle: 'Search results',
  filterAllLabel: 'All',

  filterDeliveryLabel: 'Delivery Type',
  filterZoomLabel: 'Live Online',
  filterOnsiteLabel: 'On-site',
  filterBlendedLabel: 'Hybrid',
  filterSelfPacedLabel: 'Self-paced',

  filterPricingLabel: 'Pricing',
  filterFreeLabel: 'Free',
  filterPaidLabel: 'Paid',

  filterAvailabilityLabel: 'Availability',
  filterAvailOpenLabel: 'Open',
  filterAvailStartingSoonLabel: 'Starting Soon',
  filterAvailFullLabel: 'Full',

  filterLanguageLabel: 'Language',
  filterLangEnLabel: 'English',
  filterLangArLabel: 'Arabic',
  filterLangBothLabel: 'Both',

  filterSortByLabel: 'Sort By',
  filterSortNewestLabel: 'Newest',
  filterSortRatingLabel: 'Highest Rated',
  filterSortFeaturedLabel: 'Featured',
};

const AR = {
  heroTitle: 'الدورات',
  heroSubtitle: 'استكشاف الدورات والأحداث',
  emptyStateTitle: 'لا توجد دورات متاحة',
  emptyStateMessage: 'لم يتم العثور على دورات تطابق معاييرك.',

  ctaTitle: 'قم بتمكين القوى العاملة لديك من خلال التعليم الصحي المتوافق',
  ctaDescription:
    'انضم إلى منصة تعليم إلكتروني موثوقة مصممة لتلبية المعايير الوطنية ودعم التطوير المهني المستمر في قطاع الرعاية الصحية',
  ctaButtonLabel: 'ابدأ الآن',
  // ctaButtonHref is non-localized — English version supplies it, AR PUT still
  // includes it here for completeness (Strapi ignores non-localized fields per-locale).
  ctaButtonHref: '/contact',

  showSearchBar: true,
  showDeliveryFilter: true,
  showPricingFilter: true,
  showAvailabilityFilter: true,
  showLanguageFilter: true,
  showSortBy: true,

  searchPlaceholder: 'ابحث عن',
  sidebarFilterTitle: 'نتائج البحث',
  filterAllLabel: 'الكل',

  filterDeliveryLabel: 'نوع التقديم',
  filterZoomLabel: 'بث مباشر',
  filterOnsiteLabel: 'حضوري',
  filterBlendedLabel: 'هجين',
  filterSelfPacedLabel: 'تعلم ذاتي',

  filterPricingLabel: 'التسعير',
  filterFreeLabel: 'مجاني',
  filterPaidLabel: 'مدفوع',

  filterAvailabilityLabel: 'التوفر',
  filterAvailOpenLabel: 'مفتوح',
  filterAvailStartingSoonLabel: 'يبدأ قريباً',
  filterAvailFullLabel: 'مكتمل',

  filterLanguageLabel: 'اللغة',
  filterLangEnLabel: 'إنجليزي',
  filterLangArLabel: 'عربي',
  filterLangBothLabel: 'كلاهما',

  filterSortByLabel: 'ترتيب حسب',
  filterSortNewestLabel: 'الأحدث',
  filterSortRatingLabel: 'الأعلى تقييماً',
  filterSortFeaturedLabel: 'المميزة',
};

// ─── HTTP helpers (same pattern as seed-content.js) ────────────

async function apiRequest(endpoint, method = 'GET', data = null) {
  const url = `${STRAPI_URL}/api${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
  };
  if (data) options.body = JSON.stringify({ data });

  const response = await fetch(url, options);
  const text = await response.text();
  let result;
  try {
    result = text ? JSON.parse(text) : { data: null };
  } catch {
    if (!response.ok) throw new Error(`API ${response.status}: ${text}`);
    return { data: null };
  }
  if (!response.ok) {
    throw new Error(
      `API ${response.status}: ${result?.error?.message || JSON.stringify(result)}`,
    );
  }
  return result;
}

async function seedLocale(locale, data) {
  console.log(`\nSeeding courses-page (${locale})...`);
  try {
    await apiRequest(`/courses-page?locale=${locale}`, 'PUT', data);
    console.log(`  Saved (${locale})`);
    await apiRequest(`/courses-page/actions/publish?locale=${locale}`, 'POST');
    console.log(`  Published (${locale})`);
  } catch (err) {
    console.error(`  Failed for ${locale}: ${err.message}`);
    process.exitCode = 1;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Seeding courses-page labels (en + ar)');
  console.log(`Target: ${STRAPI_URL}`);
  console.log('='.repeat(60));

  await seedLocale('en', EN);
  await seedLocale('ar', AR);

  console.log('\n' + '='.repeat(60));
  console.log('Done. Check Strapi admin → Content Manager → Courses Page.');
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
