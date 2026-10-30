import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireRole, wrap } from '../middleware/auth.js';
import { HttpError, id, numberIn, oneOf, str, stringArray, url } from '../validate.js';

const router = Router();
const TYPES = ['repair', 'donation', 'recycling'];

function parse(b) {
  return {
    name: str(b.name, 'Name', { max: 150 }),
    type: oneOf(b.type, 'Type', TYPES),
    services: str(b.services, 'Services', { max: 500, optional: true }),
    accepted_categories: stringArray(b.accepted_categories, 'Accepted categories'),
    address: str(b.address, 'Address', { max: 300, optional: true }),
    city: str(b.city, 'City', { max: 100, optional: true }),
    lat: numberIn(b.lat, 'Latitude', -90, 90),
    lng: numberIn(b.lng, 'Longitude', -180, 180),
    phone: str(b.phone, 'Phone', { max: 40, optional: true }),
    website: url(b.website, 'Website'),
    hours: str(b.hours, 'Hours', { max: 200, optional: true }),
  };
}

const COLUMNS = `id, name, type, services, accepted_categories, address, city, lat, lng, phone, website, hours,
                 verified, verified_at, updated_at`;

// Public browse. Visitors see only verified, un-reported listings; admins see everything and a partner can
// list their own (including unverified) with ?mine=1.
router.get('/', wrap(async (req, res) => {
  const where = [];
  const params = [];
  const param = (v) => { params.push(v); return `$${params.length}`; };

  if (req.query.type) where.push(`type = ${param(oneOf(req.query.type, 'type', TYPES))}`);
  if (req.query.category) {
    const p = param(String(req.query.category).slice(0, 50));
    where.push(`(cardinality(accepted_categories) = 0 OR ${p} = ANY(accepted_categories))`);
  }
  if (req.query.q) {
    const p = param(`%${String(req.query.q).slice(0, 80)}%`);
    where.push(`(name ILIKE ${p} OR city ILIKE ${p} OR address ILIKE ${p})`);
  }

  const u = req.user;
  const isAdmin = u?.role === 'admin';
  const mine = req.query.mine === '1' && u?.role === 'partner';
  if (mine) where.push(`owner_id = ${param(u.id)}`);
  else if (!isAdmin) where.push('(verified AND NOT reported)');

  const extra = isAdmin || mine ? ', reported, report_note, owner_id' : '';
  const { rows } = await query(
    `SELECT ${COLUMNS}${extra} FROM service_locations
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY name`,
    params
  );
  res.json(rows);
}));

router.get('/:id', wrap(async (req, res) => {
  const { rows } = await query(`SELECT ${COLUMNS}, reported, owner_id FROM service_locations WHERE id = $1`, [id(req.params.id)]);
  const l = rows[0];
  const canSeeAll = req.user?.role === 'admin' || (l && req.user && l.owner_id === req.user.id);
  if (!l || (!canSeeAll && (!l.verified || l.reported))) throw new HttpError(404, 'Location not found.');
  res.json(l);
}));

// Partners and admins create locations. Partner listings start unverified until an admin approves them.
router.post('/', requireRole('partner', 'admin'), wrap(async (req, res) => {
  const l = parse(req.body);
  const isAdmin = req.user.role === 'admin';
  const { rows } = await query(
    `INSERT INTO service_locations
       (owner_id, name, type, services, accepted_categories, address, city, lat, lng, phone, website, hours, verified, verified_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [req.user.id, l.name, l.type, l.services, l.accepted_categories, l.address, l.city, l.lat, l.lng,
     l.phone, l.website, l.hours, isAdmin, isAdmin ? new Date() : null]
  );
  res.status(201).json(rows[0]);
}));

async function loadEditable(req) {
  const { rows } = await query('SELECT * FROM service_locations WHERE id = $1', [id(req.params.id)]);
  const l = rows[0];
  if (!l) throw new HttpError(404, 'Location not found.');
  if (req.user.role !== 'admin' && l.owner_id !== req.user.id) throw new HttpError(403, 'You can only edit your own locations.');
  return l;
}

router.put('/:id', requireRole('partner', 'admin'), wrap(async (req, res) => {
  const current = await loadEditable(req);
  const l = parse(req.body);
  // A partner edit puts the listing back into review so unverified details never carry a "verified" badge.
  const isAdmin = req.user.role === 'admin';
  const { rows } = await query(
    `UPDATE service_locations SET name=$1, type=$2, services=$3, accepted_categories=$4, address=$5, city=$6,
       lat=$7, lng=$8, phone=$9, website=$10, hours=$11,
       verified = CASE WHEN $12 THEN verified ELSE FALSE END,
       verified_at = CASE WHEN $12 THEN verified_at ELSE NULL END,
       updated_at=now()
     WHERE id=$13 RETURNING *`,
    [l.name, l.type, l.services, l.accepted_categories, l.address, l.city, l.lat, l.lng, l.phone, l.website, l.hours,
     isAdmin, current.id]
  );
  res.json(rows[0]);
}));

router.delete('/:id', requireRole('partner', 'admin'), wrap(async (req, res) => {
  const current = await loadEditable(req);
  // device_actions.location_id is ON DELETE SET NULL, so history is kept without the dangling reference.
  await query('DELETE FROM service_locations WHERE id = $1', [current.id]);
  res.status(204).end();
}));

// Admin: verify / unverify.
router.post('/:id/verify', requireRole('admin'), wrap(async (req, res) => {
  const verified = req.body.verified !== false;
  const { rows } = await query(
    `UPDATE service_locations SET verified=$1, verified_at = CASE WHEN $1 THEN now() ELSE NULL END,
       reported = CASE WHEN $1 THEN FALSE ELSE reported END, updated_at=now()
     WHERE id=$2 RETURNING *`,
    [verified, id(req.params.id)]
  );
  if (!rows[0]) throw new HttpError(404, 'Location not found.');
  res.json(rows[0]);
}));

// Any signed-in user can report outdated or wrong information; admins review it.
router.post('/:id/report', wrap(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Please sign in to report a problem.');
  const note = str(req.body.note, 'Note', { max: 500 });
  const { rows } = await query(
    `UPDATE service_locations SET reported=TRUE, report_note=$1 WHERE id=$2 RETURNING id`,
    [note, id(req.params.id)]
  );
  if (!rows[0]) throw new HttpError(404, 'Location not found.');
  res.status(202).json({ ok: true });
}));

export default router;
