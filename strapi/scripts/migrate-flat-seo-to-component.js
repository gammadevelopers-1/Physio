/**
 * One-shot migration: copy flat metaTitle / metaDescription / ogImage into
 * the new `seo` component (shared.seo) for every page entity that has them.
 *
 * Idempotent: only writes when `seo` is empty AND at least one flat field
 * has a value. Safe to re-run.
 *
 * Usage:
 *   1. Make sure Strapi is running and reachable (STRAPI_URL).
 *   2. STRAPI_API_TOKEN must have full-access (write + publish on every type).
 *   3. node scripts/migrate-flat-seo-to-component.js
 */

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN =
  process.env.STRAPI_API_TOKEN ||
  '8f41457b95b507a18e639cb788fc73a6655affac446cf5b6d3cf99d37b32a5db5c43346a196278e43c26661c939fdd752276beefcae02c07caf77405602f6ef6650a56b53b636c49552d68700ec8c75459d65fd2a6a471d09dd88f1e8e4914501c2f426fa2e706761fc1f8a7fed043c9ea5a750ad6a0972df4bf9764c86d78e9';

const LOCALES = ['en', 'ar'];

// Single-types that have flat metaTitle/metaDescription/ogImage today.
// All entries are i18n-localized; the component reference itself is i18n
// localized too, so each locale row gets its own seo.
const SINGLE_TYPES = [
  { endpoint: '/home-page',              label: 'home-page' },
  { endpoint: '/about-page',             label: 'about-page' },
  { endpoint: '/become-trainer-page',    label: 'become-trainer-page' },
  { endpoint: '/blogs-page',             label: 'blogs-page' },
  { endpoint: '/certifications-page',    label: 'certifications-page' },
  { endpoint: '/contact-page',           label: 'contact-page' },
  { endpoint: '/courses-page',           label: 'courses-page' },
  { endpoint: '/faq-page',               label: 'faq-page' },
  { endpoint: '/feedback-page',          label: 'feedback-page' },
  { endpoint: '/instructors-page',       label: 'instructors-page' },
  { endpoint: '/learning-policies-page', label: 'learning-policies-page' },
  { endpoint: '/nelc-page',              label: 'nelc-page' },
  { endpoint: '/partners-page',          label: 'partners-page' },
  { endpoint: '/privacy-policy-page',    label: 'privacy-policy-page' },
  { endpoint: '/terms-page',             label: 'terms-page' },
];

// Collection-types that have flat SEO fields. (the dynamic `page` collection)
const COLLECTIONS = [
  { endpoint: '/pages', label: 'page' },
];

async function apiRequest(path, method = 'GET', data = null) {
  const url = `${STRAPI_URL}/api${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
  };
  if (data !== null) options.body = JSON.stringify({ data });
  const res = await fetch(url, options);
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

/** Strapi v5: returned `seo` may be null, undefined, or an object. */
function isSeoEmpty(seo) {
  if (!seo) return true;
  if (typeof seo !== 'object') return true;
  // If every meaningful field is empty, treat as empty.
  const meaningful = ['metaTitle', 'metaDescription', 'keywords', 'ogTitle', 'ogDescription', 'canonicalUrl'];
  for (const k of meaningful) {
    if (seo[k]) return false;
  }
  if (seo.ogImage) return false;
  return true;
}

/** Build a seo component payload from the flat fields. ogImage carries
 *  through as the media id (Strapi v5 accepts id or documentId for media in
 *  REST). Returns null if there's nothing to migrate. */
function buildSeoFromFlat(entity) {
  const seo = {};
  if (entity.metaTitle) seo.metaTitle = String(entity.metaTitle).slice(0, 150);
  if (entity.metaDescription) seo.metaDescription = String(entity.metaDescription).slice(0, 300);
  if (entity.ogImage && entity.ogImage.id) seo.ogImage = entity.ogImage.id;

  if (!seo.metaTitle && !seo.metaDescription && !seo.ogImage) return null;
  return seo;
}

async function migrateSingleType({ endpoint, label }) {
  for (const locale of LOCALES) {
    let body;
    try {
      body = await apiRequest(
        `${endpoint}?locale=${locale}&populate[seo][populate]=*&populate[ogImage]=true`,
      );
    } catch (e) {
      console.warn(`[skip] ${label} (${locale}): GET failed — ${e.message}`);
      continue;
    }
    const entity = body?.data;
    if (!entity) {
      console.log(`[skip] ${label} (${locale}): no entity row`);
      continue;
    }

    if (!isSeoEmpty(entity.seo)) {
      console.log(`[skip] ${label} (${locale}): seo already populated`);
      continue;
    }

    const seo = buildSeoFromFlat(entity);
    if (!seo) {
      console.log(`[skip] ${label} (${locale}): no flat values to copy`);
      continue;
    }

    try {
      await apiRequest(`${endpoint}?locale=${locale}`, 'PUT', { seo });
      console.log(`[ok ] ${label} (${locale}): migrated → ${JSON.stringify({ ...seo, ogImage: seo.ogImage ? `media#${seo.ogImage}` : undefined })}`);
      // Republish so the new seo is visible to the public API immediately.
      try {
        await apiRequest(`${endpoint}/actions/publish?locale=${locale}`, 'POST');
      } catch (e) {
        console.warn(`[warn] ${label} (${locale}): publish failed — ${e.message}`);
      }
    } catch (e) {
      console.error(`[err ] ${label} (${locale}): PUT failed — ${e.message}`);
    }
  }
}

async function migrateCollection({ endpoint, label }) {
  for (const locale of LOCALES) {
    // Page collection — paginate to be safe.
    let page = 1;
    while (true) {
      let body;
      try {
        body = await apiRequest(
          `${endpoint}?locale=${locale}&pagination[page]=${page}&pagination[pageSize]=50&populate[seo][populate]=*&populate[ogImage]=true`,
        );
      } catch (e) {
        console.warn(`[skip] ${label} (${locale}) page ${page}: GET failed — ${e.message}`);
        break;
      }
      const items = body?.data || [];
      if (!items.length) break;
      for (const entity of items) {
        const docId = entity.documentId;
        const slug = entity.slug || entity.id;
        if (!isSeoEmpty(entity.seo)) {
          console.log(`[skip] ${label}/${slug} (${locale}): seo already populated`);
          continue;
        }
        const seo = buildSeoFromFlat(entity);
        if (!seo) {
          console.log(`[skip] ${label}/${slug} (${locale}): no flat values`);
          continue;
        }
        try {
          await apiRequest(`${endpoint}/${docId}?locale=${locale}`, 'PUT', { seo });
          console.log(`[ok ] ${label}/${slug} (${locale}): migrated`);
          try {
            await apiRequest(`${endpoint}/${docId}/actions/publish?locale=${locale}`, 'POST');
          } catch (e) {
            console.warn(`[warn] ${label}/${slug} (${locale}): publish failed — ${e.message}`);
          }
        } catch (e) {
          console.error(`[err ] ${label}/${slug} (${locale}): PUT failed — ${e.message}`);
        }
      }
      const total = body?.meta?.pagination?.pageCount || 1;
      if (page >= total) break;
      page += 1;
    }
  }
}

async function ping() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${STRAPI_URL}/api`);
      if (res.status === 200 || res.status === 404) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Strapi not reachable at ${STRAPI_URL}`);
}

async function main() {
  console.log(`Migrating flat SEO → shared.seo component on ${STRAPI_URL}`);
  await ping();

  for (const t of SINGLE_TYPES) {
    await migrateSingleType(t);
  }
  for (const t of COLLECTIONS) {
    await migrateCollection(t);
  }

  console.log('\nDone.');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
