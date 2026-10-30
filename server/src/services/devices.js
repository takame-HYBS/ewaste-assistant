import { query } from '../db/pool.js';
import { HttpError } from '../validate.js';

export const CONDITIONS = ['working', 'minor_issues', 'major_issues', 'not_working'];

export const DEVICE_SELECT = `
  SELECT d.*, c.key AS category_key, c.label AS category_label,
         c.typical_lifespan_years, u.name AS owner_name
  FROM devices d
  JOIN device_categories c ON c.id = d.category_id
  JOIN users u ON u.id = d.user_id`;

// Returns the device if the caller owns it (or is admin). Otherwise 404, so IDs of others' devices aren't revealed.
export async function loadDevice(req, deviceId) {
  const { rows } = await query(`${DEVICE_SELECT} WHERE d.id = $1`, [deviceId]);
  const device = rows[0];
  if (!device || (device.user_id !== req.user.id && req.user.role !== 'admin')) {
    throw new HttpError(404, 'Device not found.');
  }
  return device;
}

// Device status is derived from its assessments and actions, never set directly by clients.
export async function syncDeviceStatus(deviceId) {
  await query(
    `UPDATE devices SET updated_at = now(), status = CASE
       WHEN EXISTS (SELECT 1 FROM device_actions WHERE device_id = $1 AND status = 'completed') THEN 'completed'
       WHEN EXISTS (SELECT 1 FROM device_actions WHERE device_id = $1 AND status IN ('planned','in_progress')) THEN 'in_progress'
       WHEN EXISTS (SELECT 1 FROM assessments WHERE device_id = $1) THEN 'assessed'
       ELSE 'registered' END
     WHERE id = $1`,
    [deviceId]
  );
}
