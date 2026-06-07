-- Users table: role field is the IDOR target
CREATE TABLE IF NOT EXISTS users (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    username  TEXT UNIQUE NOT NULL,
    password  TEXT NOT NULL,           -- bcrypt hash
    full_name TEXT NOT NULL,
    address   TEXT NOT NULL,
    role      TEXT DEFAULT 'resident', -- 'resident' | 'admin'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Barangay incident/community reports
CREATE TABLE IF NOT EXISTS reports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    title       TEXT NOT NULL,
    category    TEXT NOT NULL,         -- 'noise', 'infrastructure', 'safety', etc.
    description TEXT NOT NULL,
    status      TEXT DEFAULT 'pending',-- 'pending' | 'reviewed' | 'resolved'
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Admin activity log — used internally by SSRF-vulnerable feature
CREATE TABLE IF NOT EXISTS admin_logs (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    action    TEXT NOT NULL,
    performed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
