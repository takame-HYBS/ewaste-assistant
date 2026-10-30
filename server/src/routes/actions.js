import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth, wrap } from '../middleware/auth.js';
import { HttpError, id, oneOf, str } from '../validate.js';
import { loadDevice, syncDeviceStatus } from '../services/devices.js';

export const ACTIONS = ['repair', 'reuse', 'donate', 'parts_recovery', 'recycle'];
export const STATUSES = ['planned', 'in_progress', 'completed', 'cancelled'];

export const forDevice = Router({ mergeParams: true });
export const standalone = Router();
forDevice.use(requireAuth);
standalone.use(requireAuth);

const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in the server's local time

function parseDate(v, status) {
  if (v === undefined || v === null || v === '') return status === 'completed' ? today() : null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
    throw new HttpError(400, 'Date must look like YYYY-MM-DD.');
  }
  return v;
}

// An assessment or location, if given, must be usable by this user.
async function checkRefs(device, body) {
  let assessmentId = null;
  let locationId = null;
  if (body.assessment_id) {
    assessmentId = Number(body.assessment_id);
    const r = await query('SELECT 1 FROM assessments WHERE id = $1 AND device_id = $2', [assessmentId, device.id]);
    if (!r.rowCount) throw new HttpError(400, 'That assessment does not belong to this device.');
  }
  if (body.location_id) {
    locationId = Number(body.location_id);
    const r = await query('SELECT 1 FROM service_locations WHERE id = $1', [locationId]);
    if (!r.rowCount) throw new HttpError(400, 'That location does not exist.');
  }
  return { assessmentId, locationId };
}

forDevice.post('/:id/actions', wrap(async (req, res) => {
  const device = await loadDevice(req, id(req.params.id));
  const action = oneOf(req.body.action, 'Action', ACTIONS);
  const status = oneOf(req.body.status || 'planned', 'Status', STATUSES);
  const { assessmentId, locationId } = await checkRefs(device, req.body);
  const { rows } = await query(
    `INSERT INTO device_actions (device_id, assessment_id, user_id, location_id, action, status, action_date, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [device.id, assessmentId, device.user_id, locationId, action, status,
     parseDate(req.body.action_date, status), str(req.body.notes, 'Notes', { max: 1000, optional: true })]
  );
  await syncDeviceStatus(device.id);
  res.status(201).json(rows[0]);
}));

standalone.get('/', wrap(async (req, res) => {
  const all = req.query.all === '1' && req.user.role === 'admin';
  const { rows } = await query(
    `SELECT a.*, d.brand, d.model, l.name AS location_name
     FROM device_actions a
     JOIN devices d ON d.id = a.device_id
     LEFT JOIN service_locations l ON l.id = a.location_id
     ${all ? '' : 'WHERE a.user_id = $1'}
     ORDER BY a.updated_at DESC`,
    all ? [] : [req.user.id]
  );
  res.json(rows);
}));

async function loadAction(req, actionId) {
  const { rows } = await query('SELECT * FROM device_actions WHERE id = $1', [actionId]);
  const a = rows[0];
  if (!a || (a.user_id !== req.user.id && req.user.role !== 'admin')) throw new HttpError(404, 'Action not found.');
  return a;
}

standalone.put('/:id', wrap(async (req, res) => {
  const current = await loadAction(req, id(req.params.id));
  const isAdmin = req.user.role === 'admin';
  const device = await loadDevice(req, current.device_id);
  const notes = str(req.body.notes ?? current.notes, 'Notes', { max: 1000, optional: true });

  // Accountability: a completed action is a record. Owners may only add notes to it; admins may correct it.
  if (current.status === 'completed' && !isAdmin) {
    const { rows } = await query('UPDATE device_actions SET notes=$1, updated_at=now() WHERE id=$2 RETURNING *', [notes, current.id]);
    return res.json(rows[0]);
  }

  const action = oneOf(req.body.action ?? current.action, 'Action', ACTIONS);
  const status = oneOf(req.body.status ?? current.status, 'Status', STATUSES);
  const { assessmentId, locationId } = await checkRefs(device, {
    assessment_id: req.body.assessment_id ?? current.assessment_id,
    location_id: req.body.location_id ?? current.location_id,
  });
  const date = parseDate(req.body.action_date ?? current.action_date, status);
  const { rows } = await query(
    `UPDATE device_actions SET action=$1, status=$2, assessment_id=$3, location_id=$4, action_date=$5, notes=$6, updated_at=now()
     WHERE id=$7 RETURNING *`,
    [action, status, assessmentId, locationId, date, notes, current.id]
  );
  await syncDeviceStatus(current.device_id);
  res.json(rows[0]);
}));

standalone.delete('/:id', wrap(async (req, res) => {
  const current = await loadAction(req, id(req.params.id));
  if (current.status === 'completed' && req.user.role !== 'admin') {
    throw new HttpError(409, 'Completed actions are kept for the impact record. Add a note instead, or ask an administrator.');
  }
  await query('DELETE FROM device_actions WHERE id = $1', [current.id]);
  await syncDeviceStatus(current.device_id);
  res.status(204).end();
}));
