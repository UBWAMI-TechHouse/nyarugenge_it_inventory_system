import "dotenv/config";
import pool from "../src/db/pool";
import { logger } from "../src/middleware/logger";

const SQL = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Departments ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  code        VARCHAR(20)  NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  department_id UUID        NOT NULL REFERENCES departments(id),
  role          VARCHAR(100) NOT NULL DEFAULT 'Staff',
  avatar        TEXT,
  is_admin      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email         ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id);

-- ─── Equipment ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(200) NOT NULL,
  category      VARCHAR(100) NOT NULL,
  serial_number VARCHAR(150) NOT NULL UNIQUE,
  tag_number    VARCHAR(100) NOT NULL UNIQUE,
  assigned_to   UUID        REFERENCES users(id) ON DELETE SET NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'available'
                CHECK (status IN ('assigned','available','maintenance','retired')),
  condition     VARCHAR(20)  NOT NULL DEFAULT 'good'
                CHECK (condition IN ('excellent','good','fair','poor')),
  purchase_date DATE        NOT NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_status      ON equipment(status);
CREATE INDEX IF NOT EXISTS idx_equipment_category    ON equipment(category);
CREATE INDEX IF NOT EXISTS idx_equipment_assigned_to ON equipment(assigned_to);

-- ─── Handovers ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS handovers (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id  UUID        REFERENCES users(id) ON DELETE SET NULL,
  to_user_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  equipment_id  UUID        NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  date          DATE        NOT NULL DEFAULT CURRENT_DATE,
  status        VARCHAR(20)  NOT NULL DEFAULT 'completed'
                CHECK (status IN ('completed','pending','cancelled')),
  activity_type VARCHAR(20)  NOT NULL
                CHECK (activity_type IN ('reassign','return','new_issue')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_handovers_equipment_id  ON handovers(equipment_id);
CREATE INDEX IF NOT EXISTS idx_handovers_from_user_id  ON handovers(from_user_id);
CREATE INDEX IF NOT EXISTS idx_handovers_to_user_id    ON handovers(to_user_id);
CREATE INDEX IF NOT EXISTS idx_handovers_date          ON handovers(date DESC);

-- ─── Password Reset Tokens ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prt_token   ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_prt_user_id ON password_reset_tokens(user_id);

-- ─── updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['departments','users','equipment','handovers']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_' || tbl || '_updated_at'
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
        tbl, tbl
      );
    END IF;
  END LOOP;
END;
$$;

-- ─── Maintenance Logs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id  UUID        NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  type          VARCHAR(20)  NOT NULL DEFAULT 'repair'
                CHECK (type IN ('repair','inspection','calibration','cleaning','upgrade','other')),
  description   TEXT        NOT NULL,
  cost          NUMERIC(10,2),
  date          DATE        NOT NULL DEFAULT CURRENT_DATE,
  logged_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_logs_equipment_id ON maintenance_logs(equipment_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_date         ON maintenance_logs(date DESC);

-- ─── Activity Events (audit log) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(50)  NOT NULL,
  entity_type VARCHAR(50)  NOT NULL,
  entity_id   UUID,
  description TEXT        NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_events_created_at ON activity_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_entity     ON activity_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_user_id    ON activity_events(user_id);

-- ─── Add notes column to equipment if not exists (safe migration) ─────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'notes'
  ) THEN
    ALTER TABLE equipment ADD COLUMN notes TEXT;
  END IF;
END;
$$;
`;

async function migrate() {
  const client = await pool.connect();
  try {
    logger.info("Running migrations…");
    await client.query(SQL);
    logger.info("✅ Migrations complete");
  } catch (err) {
    logger.error("Migration failed", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
