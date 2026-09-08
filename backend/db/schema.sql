CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  picture TEXT,
  device_id TEXT NOT NULL UNIQUE,
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  role TEXT CHECK (role IN ('admin', 'member'))
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'departments_created_by_fkey'
  ) THEN
    ALTER TABLE departments ADD CONSTRAINT departments_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS department_requests (
  id TEXT PRIMARY KEY,
  department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied')),
  created_at BIGINT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS one_pending_department_request_per_user
  ON department_requests(user_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS squads (
  id TEXT PRIMARY KEY,
  department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE (department_id, name)
);

CREATE TABLE IF NOT EXISTS squad_members (
  squad_id TEXT NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (squad_id, user_id)
);

CREATE TABLE IF NOT EXISTS device_push_tokens (
  device_id TEXT PRIMARY KEY,
  push_token TEXT NOT NULL,
  updated_at BIGINT NOT NULL
);
