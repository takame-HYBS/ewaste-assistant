import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth, wrap } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Impact summary. Counts only COMPLETED actions so the numbers reflect what actually happened.
router.get('/', wrap(async (req, res) => {
  const scope = req.query.scope === 'all' && req.user.role === 'admin' ? 'all' : 'mine';
  const filter = scope === 'all' ? '' : 'AND a.user_id = $1';
  const params = scope === 'all' ? [] : [req.user.id];

  const [byAction, byCategory, devices, monthly] = await Promise.all([
    query(
      `SELECT a.action, count(*)::int AS count FROM device_actions a
       WHERE a.status = 'completed' ${filter} GROUP BY a.action`,
      params
    ),
    query(
      `SELECT c.label AS category, count(*)::int AS count
       FROM device_actions a JOIN devices d ON d.id = a.device_id JOIN device_categories c ON c.id = d.category_id
       WHERE a.status = 'completed' ${filter} GROUP BY c.label ORDER BY count DESC`,
      params
    ),
    query(
      `SELECT d.status, count(*)::int AS count FROM devices d
       ${scope === 'all' ? '' : 'WHERE d.user_id = $1'} GROUP BY d.status`,
      params
    ),
    query(
      `SELECT to_char(date_trunc('month', coalesce(a.action_date, a.updated_at::date)), 'YYYY-MM') AS month,
              count(*)::int AS count
       FROM device_actions a
       WHERE a.status = 'completed' ${filter}
         AND coalesce(a.action_date, a.updated_at::date) >= date_trunc('month', now()) - interval '11 months'
       GROUP BY 1 ORDER BY 1`,
      params
    ),
  ]);

  const actions = { repair: 0, reuse: 0, donate: 0, parts_recovery: 0, recycle: 0 };
  for (const r of byAction.rows) actions[r.action] = r.count;
  const deviceStatus = { registered: 0, assessed: 0, in_progress: 0, completed: 0 };
  for (const r of devices.rows) deviceStatus[r.status] = r.count;

  const completed = Object.values(actions).reduce((a, b) => a + b, 0);
  res.json({
    scope,
    totalDevices: Object.values(deviceStatus).reduce((a, b) => a + b, 0),
    completed,
    // "Kept in use" = repaired, reused, donated or parts recovered (i.e. not sent straight to recycling).
    keptInUse: completed - actions.recycle,
    actions,
    deviceStatus,
    byCategory: byCategory.rows,
    monthly: monthly.rows,
  });
}));

export default router;
