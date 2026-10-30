import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth, wrap } from '../middleware/auth.js';
import { HttpError, id, numberIn, oneOf, str } from '../validate.js';
import { CONDITIONS, DEVICE_SELECT, loadDevice } from '../services/devices.js';
import { deleteAssessmentPhotos } from '../services/photos.js';

const router = Router();
router.use(requireAuth);

async function parseDevice(body) {
  const category_id = Number(body.category_id);
  const cat = await query('SELECT id FROM device_categories WHERE id = $1 AND active', [category_id]);
  if (!cat.rowCount) throw new HttpError(400, 'Choose a valid device category.');
  return {
    category_id,
    brand: str(body.brand, 'Brand', { max: 80 }),
    model: str(body.model, 'Model', { max: 120, optional: true }),
    age_years: numberIn(body.age_years, 'Age (years)', 0, 60),
    condition: oneOf(body.condition, 'Condition', CONDITIONS),
    description: str(body.description, 'Description', { max: 1000, optional: true }),
  };
}

router.get('/', wrap(async (req, res) => {
  const all = req.query.all === '1' && req.user.role === 'admin';
  const { rows } = await query(
    `${DEVICE_SELECT} ${all ? '' : 'WHERE d.user_id = $1'} ORDER BY d.updated_at DESC`,
    all ? [] : [req.user.id]
  );
  res.json(rows);
}));

router.post('/', wrap(async (req, res) => {
  const d = await parseDevice(req.body);
  const { rows } = await query(
    `INSERT INTO devices (user_id, category_id, brand, model, age_years, condition, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [req.user.id, d.category_id, d.brand, d.model, d.age_years, d.condition, d.description]
  );
  res.status(201).json(await loadDevice(req, rows[0].id));
}));

router.get('/:id', wrap(async (req, res) => {
  const device = await loadDevice(req, id(req.params.id));
  const [assessments, actions] = await Promise.all([
    query(
      `SELECT id, method, result_action, confidence, created_at, (photo_path IS NOT NULL) AS has_photo
       FROM assessments WHERE device_id = $1 ORDER BY created_at DESC`,
      [device.id]
    ),
    query(
      `SELECT a.*, l.name AS location_name FROM device_actions a
       LEFT JOIN service_locations l ON l.id = a.location_id
       WHERE a.device_id = $1 ORDER BY a.created_at DESC`,
      [device.id]
    ),
  ]);
  res.json({ ...device, assessments: assessments.rows, actions: actions.rows });
}));

router.put('/:id', wrap(async (req, res) => {
  const device = await loadDevice(req, id(req.params.id));
  if (device.status === 'completed' && req.user.role !== 'admin') {
    throw new HttpError(409, 'This device already has a completed action, so its record is locked. Register a new device instead.');
  }
  const d = await parseDevice(req.body);
  await query(
    `UPDATE devices SET category_id=$1, brand=$2, model=$3, age_years=$4, condition=$5, description=$6, updated_at=now()
     WHERE id=$7`,
    [d.category_id, d.brand, d.model, d.age_years, d.condition, d.description, device.id]
  );
  res.json(await loadDevice(req, device.id));
}));

router.delete('/:id', wrap(async (req, res) => {
  const device = await loadDevice(req, id(req.params.id));
  // Accountability: completed actions are part of the impact record, so only an admin may remove them.
  if (device.status === 'completed' && req.user.role !== 'admin') {
    throw new HttpError(409, 'This device has a completed action recorded and is kept for the impact record. Ask an administrator if it must be removed.');
  }
  await deleteAssessmentPhotos(device.id);
  await query('DELETE FROM devices WHERE id = $1', [device.id]);
  res.status(204).end();
}));

export default router;
