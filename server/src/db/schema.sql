-- E-Waste Repairability & Recycling Decision Assistant: PostgreSQL schema.
-- Safe to re-run: every statement is idempotent.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'user'
                CHECK (role IN ('user', 'partner', 'admin')),
  active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin-managed device categories. `key` is what the recommendation engine uses.
CREATE TABLE IF NOT EXISTS device_categories (
  id                     SERIAL PRIMARY KEY,
  key                    TEXT    NOT NULL UNIQUE,
  label                  TEXT    NOT NULL,
  has_battery            BOOLEAN NOT NULL DEFAULT TRUE,
  stores_data            BOOLEAN NOT NULL DEFAULT TRUE,
  typical_lifespan_years INTEGER NOT NULL DEFAULT 5 CHECK (typical_lifespan_years > 0),
  active                 BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS devices (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  category_id INTEGER NOT NULL REFERENCES device_categories(id) ON DELETE RESTRICT,
  brand       TEXT    NOT NULL,
  model       TEXT    NOT NULL DEFAULT '',
  age_years   NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (age_years >= 0 AND age_years <= 60),
  condition   TEXT    NOT NULL
              CHECK (condition IN ('working', 'minor_issues', 'major_issues', 'not_working')),
  description TEXT    NOT NULL DEFAULT '',
  status      TEXT    NOT NULL DEFAULT 'registered'
              CHECK (status IN ('registered', 'assessed', 'in_progress', 'completed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS devices_user_idx ON devices(user_id);

-- An assessment is an immutable snapshot: inputs + the engine's output at that time.
CREATE TABLE IF NOT EXISTS assessments (
  id                 SERIAL PRIMARY KEY,
  device_id          INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  method             TEXT    NOT NULL DEFAULT 'questionnaire'
                     CHECK (method IN ('questionnaire', 'photo')),
  answers            JSONB   NOT NULL DEFAULT '{}'::jsonb,
  photo_path         TEXT,
  photo_hint         JSONB,                 -- optional image-model suggestion (never authoritative)
  result_action      TEXT    NOT NULL
                     CHECK (result_action IN ('repair', 'reuse', 'donate', 'parts_recovery', 'recycle')),
  confidence         TEXT    NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  ranking            JSONB   NOT NULL DEFAULT '[]'::jsonb,   -- all options with scores
  explanation        JSONB   NOT NULL DEFAULT '[]'::jsonb,   -- rules that fired
  safety_notes       JSONB   NOT NULL DEFAULT '[]'::jsonb,
  repair_cost        NUMERIC(12,2),
  repair_cost_source TEXT    CHECK (repair_cost_source IN ('user_quote', 'rough_estimate')),
  current_value      NUMERIC(12,2),
  engine_version     TEXT    NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assessments_device_idx ON assessments(device_id);

CREATE TABLE IF NOT EXISTS service_locations (
  id                  SERIAL PRIMARY KEY,
  owner_id            INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name                TEXT    NOT NULL,
  type                TEXT    NOT NULL CHECK (type IN ('repair', 'donation', 'recycling')),
  services            TEXT    NOT NULL DEFAULT '',
  accepted_categories TEXT[]  NOT NULL DEFAULT '{}',   -- category keys; empty = all
  address             TEXT    NOT NULL DEFAULT '',
  city                TEXT    NOT NULL DEFAULT '',
  lat                 DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng                 DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  phone               TEXT    NOT NULL DEFAULT '',
  website             TEXT    NOT NULL DEFAULT '',
  hours               TEXT    NOT NULL DEFAULT '',
  verified            BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at         TIMESTAMPTZ,
  reported            BOOLEAN NOT NULL DEFAULT FALSE,
  report_note         TEXT    NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS locations_type_idx ON service_locations(type);

CREATE TABLE IF NOT EXISTS device_actions (
  id            SERIAL PRIMARY KEY,
  device_id     INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  assessment_id INTEGER REFERENCES assessments(id) ON DELETE SET NULL,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  location_id   INTEGER REFERENCES service_locations(id) ON DELETE SET NULL,
  action        TEXT    NOT NULL
                CHECK (action IN ('repair', 'reuse', 'donate', 'parts_recovery', 'recycle')),
  status        TEXT    NOT NULL DEFAULT 'planned'
                CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  action_date   DATE,
  notes         TEXT    NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS actions_device_idx ON device_actions(device_id);
CREATE INDEX IF NOT EXISTS actions_user_idx ON device_actions(user_id);
