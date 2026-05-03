const fs = require('fs');
const path = require('path');

const NEW_BLOCK = 'blocks.featured-section-block';
const ROOT = path.resolve(__dirname, '..', 'strapi', 'src', 'api');

const SCHEMAS = [
  'about-page',
  'become-trainer-page',
  'certifications-page',
  'contact-page',
  'course-detail-page',
  'courses-page',
  'faq-page',
  'feedback-page',
  'home-page',
  'instructors-page',
  'learning-policies-page',
  'nelc-page',
  'page',
  'partners-page',
  'privacy-policy-page',
  'terms-page',
];

let modified = 0;
for (const slug of SCHEMAS) {
  const file = path.join(ROOT, slug, 'content-types', slug, 'schema.json');
  if (!fs.existsSync(file)) {
    console.warn(`SKIP missing: ${file}`);
    continue;
  }
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const blocks = json?.attributes?.blocks;
  if (!blocks || blocks.type !== 'dynamiczone' || !Array.isArray(blocks.components)) {
    console.warn(`SKIP no dynamiczone: ${slug}`);
    continue;
  }
  if (blocks.components.includes(NEW_BLOCK)) {
    console.log(`already present: ${slug}`);
    continue;
  }
  blocks.components.push(NEW_BLOCK);
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`updated: ${slug}`);
  modified++;
}
console.log(`\nDone. ${modified} schemas updated.`);
