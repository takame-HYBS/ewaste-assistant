import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db/pool.js';

export const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

// Attaches req.user if a valid token is present. Never rejects.
export async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return next();
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret);
    // Re-read the user so role changes and deactivation take effect immediately.
    const { rows } = await query('SELECT id, name, email, role, active FROM users WHERE id = $1', [payload.sub]);
    if (rows[0] && rows[0].active) req.user = rows[0];
  } catch {
    /* invalid or expired token: treat as anonymous */
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in.' });
  next();
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Please sign in.' });
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have permission to do that.' });
  next();
};

// Wraps async route handlers so rejected promises reach the error middleware.
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
