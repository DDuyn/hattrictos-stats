-- Add ht_team_id to users (for team editors — the team they can write press notes for)
ALTER TABLE users ADD COLUMN ht_team_id INTEGER;

-- Announcements (owner/co_owner can create, public can read)
CREATE TABLE announcements (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Press notes per team (team editors or owner/co_owner can create, public can read)
CREATE TABLE press_notes (
  id TEXT PRIMARY KEY NOT NULL,
  ht_team_id INTEGER NOT NULL,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX press_notes_ht_team_id_idx ON press_notes (ht_team_id);
