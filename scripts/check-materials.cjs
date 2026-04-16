const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backends/.env.local') });

const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect().then(async () => {
  const r = await client.query(`
    SELECT id, title, type, status, processing_step, wcag_status, wcag_details
    FROM course_materials
    ORDER BY created_at DESC
    LIMIT 12
  `);
  r.rows.forEach(row => {
    console.log(`[${row.status}] "${row.title}" | type:${row.type} | step:${row.processing_step} | wcag:${row.wcag_status}`);
    if (row.wcag_details) {
      try {
        const d = JSON.parse(row.wcag_details);
        d.forEach(c => console.log(`  ${c.passed ? '✓' : '✗'} ${c.label}: ${c.detail}`));
      } catch(e) {}
    }
  });
  await client.end();
}).catch(e => console.error(e.message));
