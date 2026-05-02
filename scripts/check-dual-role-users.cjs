const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

client
  .connect()
  .then(async () => {
    const r = await client.query(`
      SELECT
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.active_role,
        ARRAY_AGG(r.name ORDER BY r.name) AS roles
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE u.id IN (
        SELECT ur.user_id
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE r.name IN ('STUDENT', 'INSTRUCTOR')
        GROUP BY ur.user_id
        HAVING COUNT(DISTINCT r.name) = 2
      )
      GROUP BY u.id
      ORDER BY u.email
    `);

    console.log(`\nDual-role users (have BOTH STUDENT and INSTRUCTOR): ${r.rows.length}\n`);
    r.rows.forEach((row) => {
      console.log(
        `  ${row.email.padEnd(40)}  active=${row.active_role.padEnd(12)}  roles=[${row.roles.join(', ')}]  id=${row.id}`,
      );
    });

    if (r.rows.length === 0) {
      console.log('  (none — clean cleanup not needed)');
    }
    await client.end();
  })
  .catch((e) => {
    console.error('ERROR:', e.message);
    process.exit(1);
  });
