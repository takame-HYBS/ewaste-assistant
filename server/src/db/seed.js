// Seeds categories, an admin account and clearly-labelled DEMO locations.
// Run with: npm run seed   (safe to re-run)
import bcrypt from 'bcryptjs';
import { pool } from './pool.js';

const categories = [
  ['phone', 'Mobile phone', true, true, 4],
  ['laptop', 'Laptop', true, true, 6],
  ['tablet', 'Tablet', true, true, 5],
  ['peripheral', 'Small peripheral (mouse, keyboard, charger, etc.)', false, false, 5],
];
for (const [key, label, battery, data, life] of categories) {
  await pool.query(
    `INSERT INTO device_categories (key, label, has_battery, stores_data, typical_lifespan_years)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT (key) DO NOTHING`,
    [key, label, battery, data, life]
  );
}

const adminEmail = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe!123';
const hash = await bcrypt.hash(adminPassword, 10);
await pool.query(
  `INSERT INTO users (name, email, password_hash, role) VALUES ('Administrator', $1, $2, 'admin')
   ON CONFLICT (email) DO NOTHING`,
  [adminEmail, hash]
);

// DEMO ONLY. These are NOT real businesses. Delete them in the admin screen and add real,
// verified partners before any public use.
const { rows } = await pool.query(`SELECT count(*)::int AS n FROM service_locations WHERE name LIKE 'DEMO%'`);
if (rows[0].n === 0) {
  const demo = [
    ['DEMO Repair Shop', 'repair', 'Phones and laptops (demo entry)', ['phone', 'laptop', 'tablet'], 14.6507, 120.9840],
    ['DEMO Donation Point', 'donation', 'Working devices (demo entry)', ['phone', 'laptop', 'tablet', 'peripheral'], 14.6760, 121.0437],
    ['DEMO E-Waste Collection', 'recycling', 'All e-waste, batteries accepted (demo entry)', [], 14.5995, 120.9842],
  ];
  for (const [name, type, services, cats, lat, lng] of demo) {
    await pool.query(
      `INSERT INTO service_locations (name, type, services, accepted_categories, address, city, lat, lng, verified, verified_at)
       VALUES ($1,$2,$3,$4,'Demo address - not a real location','Metro Manila',$5,$6,TRUE,now())`,
      [name, type, services, cats, lat, lng]
    );
  }
}

console.log(`Seeded. Admin login: ${adminEmail} / ${adminPassword}  (change this password!)`);
await pool.end();
