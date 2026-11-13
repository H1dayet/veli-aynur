-- One row per submission; a guest who answers again adds a new row (the admin page counts only their latest).
CREATE TABLE IF NOT EXISTS rsvp (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  name       TEXT    NOT NULL,
  attending  INTEGER NOT NULL,          -- 1 = придёт, 0 = не сможет
  guests     INTEGER NOT NULL DEFAULT 0, -- including the guest themselves; 0 when not attending
  comment    TEXT
);
