import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { requireRole, wrap } from '../middleware/auth.js';
import { HttpError, email, id, oneOf, password, str } from '../validate.js';

const router = Router();
router.use(requireRole('admin'));

const ROLES = ['user', 'partner', 'admin'];

router.get('/users', wrap(async (_req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.role, u.active, u.created_at,
            (SELECT count(*)::int FROM devices d WHERE d.user_id = u.id) AS device_count
     FROM users u ORDER BY u.created_at DESC`
  );
  res.json(rows);
}));

router.post('/users', wrap(async (req, res) => {
  const hash = await bcrypt.hash(password(req.body.password), 10);
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4)
     RETURNING id, name, email, role, active, created_at`,
    [str(req.body.name, 'Name', { max: 100 }), email(req.body.email), hash, oneOf(req.body.role || 'user', 'Role', ROLES)]
  );
  res.status(201).json(rows[0]);
}));

// Protect against locking everyone out: the last active admin can't be demoted or deactivated.
async function assertNotLastAdmin(userId, willStillBeActiveAdmin) {
  if (willStillBeActiveAdmin) return;
  const { rows } = await query(
    `SELECT count(*)::int AS n FROM users WHERE role='admin' AND active AND id <> $1`, [userId]
  );
  if (rows[0].n === 0) throw new HttpError(409, 'There must be at least one active administrator.');
}

router.put('/users/:id', wrap(async (req, res) => {
  const uid = id(req.params.id);
  const { rows: found } = await query('SELECT * FROM users WHERE id = $1', [uid]);
  const u = found[0];
  if (!u) throw new HttpError(404, 'User not found.');

  const role = oneOf(req.body.role ?? u.role, 'Role', ROLES);
  const active = req.body.active === undefined ? u.active : Boolean(req.body.active);
  const name = str(req.body.name ?? u.name, 'Name', { max: 100 });
  if (u.role === 'admin') await assertNotLastAdmin(uid, role === 'admin' && active);

  const { rows } = await query(
    `UPDATE users SET name=$1, role=$2, active=$3 WHERE id=$4 RETURNING id, name, email, role, active, created_at`,
    [name, role, active, uid]
  );
  res.json(rows[0]);
}));

router.delete('/users/:id', wrap(async (req, res) => {
  const uid = id(req.params.id);
  if (uid === req.user.id) throw new HttpError(409, 'You cannot delete your own account.');
  const { rows: found } = await query('SELECT role FROM users WHERE id = $1', [uid]);
  if (!found[0]) throw new HttpError(404, 'User not found.');
  if (found[0].role === 'admin') await assertNotLastAdmin(uid, false);
  const owns = await query('SELECT 1 FROM devices WHERE user_id = $1 LIMIT 1', [uid]);
  if (owns.rowCount) {
    throw new HttpError(409, 'This user has devices on record. Deactivate the account instead of deleting it.');
  }
  await query('DELETE FROM users WHERE id = $1', [uid]);
  res.status(204).end();
}));

// Locations that users have reported as wrong or out of date.
router.get('/reports', wrap(async (_req, res) => {
  const { rows } = await query(
    `SELECT id, name, type, city, report_note, verified FROM service_locations WHERE reported ORDER BY updated_at DESC`
  );
  res.json(rows);
}));

router.post('/reports/:id/dismiss', wrap(async (req, res) => {
  const { rowCount } = await query(
    `UPDATE service_locations SET reported=FALSE, report_note='' WHERE id=$1`, [id(req.params.id)]
  );
  if (!rowCount) throw new HttpError(404, 'Location not found.');
  res.json({ ok: true });
}));

export default router;
