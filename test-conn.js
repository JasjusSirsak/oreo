// test-conn.js
const { Client } = require('pg');
const c = new Client({
  host: '104.248.144.117',
  port: 5432,
  user: 'postgres',
  password: 'L2G4HN5G2Y2Z4U6S',
  database: 'orion_alt',
});
(async () => {
  try {
    await c.connect();
    const res = await c.query('SELECT NOW()');
    console.log('Connected, time:', res.rows[0]);
    await c.end();
  } catch (e) {
    console.error('Connection failed:', e.message);
    process.exit(1);
  }
})();