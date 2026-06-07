const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'barangay.db');
const schemaPath = path.join(__dirname, 'schema.sql');

// Initialize database connection
const db = new Database(dbPath);

// Enable foreign key constraints
db.pragma('foreign_keys = ON');

// Initialize schema if tables don't exist
const initSchema = () => {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
    console.log('[Database] Schema initialized');
};

// Check if database is empty (first run)
const tableCount = db.prepare(`
    SELECT COUNT(*) as count 
    FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
`).get();

if (tableCount.count === 0) {
    initSchema();
}

module.exports = db;
