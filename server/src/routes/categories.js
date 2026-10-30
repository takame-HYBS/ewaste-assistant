import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireRole, wrap } from '../middleware/auth.js';
import { HttpError, id, numberIn, str } from '../validate.js';

const router = Router();

// Public: the client needs categories for the device form and map filters.
router.get('/', wrap(async (req, res) => {
  const all = req.query.all === '1' && req.user?.role === 'admin';
  const { rows } = await query(
    `SELECT * FROM device_categories ${all ? '' : 'WHERE active'} ORDER BY label`
  );
  res.json(rows);
}));

const parse = (b) => ({
  key: str(b.key, 'Key', { max: 40 }).toLowerCase().replace(/[^a-z0-9_]/g, '_'),
  label: str(b.label, 'Label', { max: 100 }),
  has_battery: b.has_battery !== false,
  stores_data: b.stores_data !== false,
  typical_lifespan_years: numberIn(b.typical_lifespan_years ?? 5, 'Lifespan', 1, 30),
  active: b.active !== false,
});

router.post('/', requireRole('admin'), wrap(async (req, res) => {
  const c = parse(req.body);
  const { rows } = await query(
    `INSERT INTO device_categories (key, label, has_battery, stores_data, typical_lifespan_years, active)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [c.key, c.label, c.has_battery, c.stores_data, Math.round(c.typical_lifespan_years), c.active]
  );
  res.status(201).json(rows[0]);
}));

router.put('/:id', requireRole('admin'), wrap(async (req, res) => {
  const cid = id(req.params.id);
  const c = parse(req.body);
  const { rows } = await query(
    `UPDATE device_categories SET key=$1, label=$2, has_battery=$3, stores_data=$4,
       typical_lifespan_years=$5, active=$6 WHERE id=$7 RETURNING *`,
    [c.key, c.label, c.has_battery, c.stores_data, Math.round(c.typical_lifespan_years), c.active, cid]
  );
  if (!rows[0]) throw new HttpError(404, 'Category not found.');
  res.json(rows[0]);
}));

router.delete('/:id', requireRole('admin'), wrap(async (req, res) => {
  const cid = id(req.params.id);
  const used = await query('SELECT 1 FROM devices WHERE category_id = $1 LIMIT 1', [cid]);
  if (used.rowCount) {
    throw new HttpError(409, 'Devices use this category, so it cannot be deleted. Deactivate it instead.');
  }
  const { rowCount } = await query('DELETE FROM device_categories WHERE id = $1', [cid]);
  if (!rowCount) throw new HttpError(404, 'Category not found.');
  res.status(204).end();
}));

export default router;
