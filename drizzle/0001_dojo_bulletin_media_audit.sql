-- Senshi Goju-Ryu Database Migration Script (SQLite / D1 compatible)
-- Idempotent migration preserving all existing records.
-- Back up content.sqlite before applying to production.

PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS dojos (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  published INTEGER NOT NULL DEFAULT 1,
  updated TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS instructors (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  rank TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  photo_id TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  updated TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dojo_instructors (
  id TEXT PRIMARY KEY NOT NULL,
  dojo_id TEXT NOT NULL REFERENCES dojos(id) ON DELETE CASCADE,
  instructor_id TEXT NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'Instructor',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_dojo_instructors_dojo ON dojo_instructors(dojo_id);
CREATE INDEX IF NOT EXISTS idx_dojo_instructors_instructor ON dojo_instructors(instructor_id);

CREATE TABLE IF NOT EXISTS training_locations (
  id TEXT PRIMARY KEY NOT NULL,
  dojo_id TEXT NOT NULL REFERENCES dojos(id) ON DELETE CASCADE,
  instructor_id TEXT NOT NULL DEFAULT '',
  venue_name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  maps_url TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  updated TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_locations_dojo ON training_locations(dojo_id);

CREATE TABLE IF NOT EXISTS training_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  dojo_id TEXT NOT NULL REFERENCES dojos(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL REFERENCES training_locations(id) ON DELETE CASCADE,
  instructor_id TEXT NOT NULL DEFAULT '',
  day_of_week TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  age_group TEXT NOT NULL DEFAULT 'All ages (Children, Teenagers & Adults)',
  fees TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  availability TEXT NOT NULL DEFAULT 'Open for enrolment',
  status TEXT NOT NULL DEFAULT 'published',
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_dojo ON training_sessions(dojo_id);
CREATE INDEX IF NOT EXISTS idx_sessions_location ON training_sessions(location_id);
CREATE INDEX IF NOT EXISTS idx_sessions_instructor ON training_sessions(instructor_id);

CREATE TABLE IF NOT EXISTS bulletins (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  branch TEXT NOT NULL,
  launch INTEGER NOT NULL,
  close INTEGER NOT NULL,
  enabled INTEGER NOT NULL,
  updated TEXT NOT NULL,
  image TEXT NOT NULL DEFAULT '',
  status_mode TEXT NOT NULL DEFAULT 'scheduled'
);
CREATE INDEX IF NOT EXISTS idx_bulletins_window ON bulletins(enabled, launch, close);

CREATE TABLE IF NOT EXISTS bulletin_attachments (
  id TEXT PRIMARY KEY NOT NULL,
  bulletin_id TEXT NOT NULL REFERENCES bulletins(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bulletin_attachments_bulletin ON bulletin_attachments(bulletin_id);

CREATE TABLE IF NOT EXISTS club_info (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  ip_hash TEXT NOT NULL DEFAULT '',
  created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created DESC);

