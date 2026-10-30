// Small validation helpers. Each throws an HttpError(400) with a user-readable message.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const bad = (msg) => {
  throw new HttpError(400, msg);
};

export const str = (v, name, { min = 1, max = 200, optional = false } = {}) => {
  if (v === undefined || v === null || v === '') {
    if (optional) return '';
    bad(`${name} is required.`);
  }
  if (typeof v !== 'string') bad(`${name} must be text.`);
  const s = v.trim();
  if (s.length < min) bad(`${name} is required.`);
  if (s.length > max) bad(`${name} must be at most ${max} characters.`);
  return s;
};

export const oneOf = (v, name, allowed) => {
  if (!allowed.includes(v)) bad(`${name} must be one of: ${allowed.join(', ')}.`);
  return v;
};

export const numberIn = (v, name, min, max, { optional = false } = {}) => {
  if ((v === undefined || v === null || v === '') && optional) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) bad(`${name} must be a number between ${min} and ${max}.`);
  return n;
};

export const id = (v, name = 'id') => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(404, 'Not found.');
  return n;
};

export const email = (v) => {
  const s = str(v, 'Email', { max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) bad('Enter a valid email address.');
  return s;
};

export const password = (v) => {
  if (typeof v !== 'string' || v.length < 8) bad('Password must be at least 8 characters.');
  if (v.length > 200) bad('Password is too long.');
  return v;
};

export const url = (v, name) => {
  const s = str(v, name, { max: 300, optional: true });
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) bad(`${name} must start with http:// or https://.`);
  return s;
};

export const stringArray = (v, name, { max = 20 } = {}) => {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > max || v.some((x) => typeof x !== 'string' || x.length > 50)) {
    bad(`${name} must be a list of short text values.`);
  }
  return v.map((x) => x.trim()).filter(Boolean);
};
