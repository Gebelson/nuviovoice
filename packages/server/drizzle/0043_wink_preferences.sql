CREATE TABLE IF NOT EXISTS wink_contact_mutes (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id TEXT NOT NULL,
  mute_type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wink_mutes_user_target ON wink_contact_mutes(user_id, target_user_id);
CREATE INDEX IF NOT EXISTS idx_wink_mutes_user ON wink_contact_mutes(user_id);
CREATE INDEX IF NOT EXISTS idx_wink_mutes_target ON wink_contact_mutes(target_user_id);

CREATE TABLE IF NOT EXISTS wink_favorites (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wink_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wink_favorites_user_wink ON wink_favorites(user_id, wink_id);
CREATE INDEX IF NOT EXISTS idx_wink_favorites_user ON wink_favorites(user_id);

CREATE TABLE IF NOT EXISTS wink_recents (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wink_id TEXT NOT NULL,
  used_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wink_recents_user_wink ON wink_recents(user_id, wink_id);
CREATE INDEX IF NOT EXISTS idx_wink_recents_user ON wink_recents(user_id);
CREATE INDEX IF NOT EXISTS idx_wink_recents_used_at ON wink_recents(used_at);
