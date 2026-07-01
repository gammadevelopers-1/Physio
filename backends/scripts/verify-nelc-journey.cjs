/* =========================================================================
 * Auditor for the fresh dstudent022 journey BEFORE sending to NELC.
 *
 * Walks every statement, extracts object.id + object.definition.type +
 * contextActivities.parent[0].id|type, then runs the same checks NELC's
 * CRS001 + adjacent rules apply.
 *
 * Designed to PASS or FAIL with a clear reason — not just dump JSON.
 * ========================================================================= */

'use strict';

const { Client } = require('pg');

const COURSE_TYPE = 'https://w3id.org/xapi/cmi5/activitytype/course';
const MODULE_TYPE = 'http://adlnet.gov/expapi/activities/module';
const LESSON_TYPE = 'http://adlnet.gov/expapi/activities/lesson';

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const r = await c.query(`
    SELECT x.id, x.verb, x.status, x.created_at, x.payload, u.email
    FROM xapi_statements x
    LEFT JOIN users u ON u.id = x.actor_user_id
    ORDER BY x.created_at ASC
  `);
  await c.end();

  console.log(`Found ${r.rowCount} statements`);
  console.log('='.repeat(80));

  const courseIds = new Set();
  const parentIds = new Set();
  const failures = [];

  r.rows.forEach((row, i) => {
    const p = row.payload;
    const verbDisplay = (p.verb && p.verb.display && p.verb.display['en-US']) || row.verb;
    const objId = p.object && p.object.id;
    const objType = p.object && p.object.definition && p.object.definition.type;
    const parent = p.context && p.context.contextActivities && p.context.contextActivities.parent;
    const parent0 = parent && parent[0];
    const parentId = parent0 && parent0.id;
    const parentType = parent0 && parent0.definition && parent0.definition.type;
    const platform = p.context && p.context.platform;
    const language = p.context && p.context.language;

    console.log(`\n[${i + 1}] ${verbDisplay} — ${row.status}`);
    console.log(`    actor: ${row.email || '(null)'}`);
    console.log(`    object.id   : ${objId}`);
    console.log(`    object.type : ${objType}`);
    if (parent0) {
      console.log(`    parent[0].id   : ${parentId}`);
      console.log(`    parent[0].type : ${parentType}`);
    } else {
      console.log(`    parent[0]   : (none)`);
    }
    console.log(`    platform: ${platform} / lang: ${language}`);

    // === CRS001 candidate collection ===
    // Course candidates come from:
    //   - object.id when object.type == course
    //   - parent[0].id when parent[0].type == course (child statements)
    if (objType === COURSE_TYPE) {
      courseIds.add(objId);
    }
    if (parentType === COURSE_TYPE) {
      parentIds.add(parentId);
    }

    // === Per-statement rule checks ===
    // R1: every non-course statement must have parent[0] with course type
    const childVerbs = ['watched', 'attended', 'attempted', 'earned'];
    const isChildVerb = childVerbs.includes(verbDisplay);
    const isModuleCompleted = (verbDisplay === 'completed' && objType === MODULE_TYPE);
    if (isChildVerb || isModuleCompleted) {
      if (!parent0) {
        failures.push(`[${i + 1}] ${verbDisplay}: missing contextActivities.parent`);
      } else if (parentType !== COURSE_TYPE) {
        failures.push(`[${i + 1}] ${verbDisplay}: parent[0].type is ${parentType}, expected ${COURSE_TYPE}`);
      }
    }

    // R2: module completion must use type=module (not lesson)
    if (verbDisplay === 'completed' && objId && objId.includes('/module/') && !objId.match(/\/module\/[^/]+\/(video|quiz|virtual-classroom|certificate|lesson)\//)) {
      if (objType !== MODULE_TYPE) {
        failures.push(`[${i + 1}] completed-module has type=${objType}, expected ${MODULE_TYPE}`);
      }
    }

    // R3: no LESSON type anywhere (we don't have a lesson layer)
    if (objType === LESSON_TYPE) {
      failures.push(`[${i + 1}] ${verbDisplay}: object.type=lesson but we don't have a lesson layer — should be module`);
    }
    if (parentType === LESSON_TYPE) {
      failures.push(`[${i + 1}] ${verbDisplay}: parent[0].type=lesson — should be course`);
    }

    // R4: platform key present
    if (!platform) {
      failures.push(`[${i + 1}] ${verbDisplay}: missing context.platform`);
    }
  });

  // === Aggregate CRS001 check ===
  console.log('\n' + '='.repeat(80));
  console.log('CRS001 verdict');
  console.log('='.repeat(80));
  console.log(`Course IDs from object.id (where type=course): ${courseIds.size}`);
  for (const id of courseIds) console.log(`  - ${id}`);
  console.log(`Parent IDs (where type=course):                ${parentIds.size}`);
  for (const id of parentIds) console.log(`  - ${id}`);

  const allUnique = new Set([...courseIds, ...parentIds]);
  console.log(`Total UNIQUE course identifiers: ${allUnique.size}`);
  if (allUnique.size === 0) {
    failures.push('CRS001: no course identifiers found (expected exactly 1)');
  } else if (allUnique.size > 1) {
    failures.push(`CRS001: found ${allUnique.size} distinct course identifiers — VALIDATOR WILL REJECT`);
  }

  console.log('\n' + '='.repeat(80));
  if (failures.length === 0) {
    console.log('✅ ALL CHECKS PASS — safe to ask Amna to re-validate.');
  } else {
    console.log(`❌ ${failures.length} FAILURE(S) — DO NOT message Amna yet:`);
    failures.forEach((f) => console.log(`   - ${f}`));
  }
  console.log('='.repeat(80));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
