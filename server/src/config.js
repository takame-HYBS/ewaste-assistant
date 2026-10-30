import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';

if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set to a random string of at least 32 characters in production.');
}

export const config = {
  isProd,
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || 'postgres://ewaste:ewaste@localhost:5432/ewaste',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  uploadDir: process.env.UPLOAD_DIR || new URL('../uploads', import.meta.url).pathname,
  maxUploadBytes: 5 * 1024 * 1024,
  // Optional external image classifier. If unset, photos are stored but not classified.
  classifierUrl: process.env.CLASSIFIER_URL || '',
  classifierKey: process.env.CLASSIFIER_API_KEY || '',
};
