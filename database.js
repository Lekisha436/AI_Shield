const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) { console.error('DB Error:', err.message); }
    else { console.log('✅ Connected to SQLite database.'); }
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        source TEXT,
        detail TEXT,
        timestamp TEXT NOT NULL,
        status TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS metrics (
        key TEXT PRIMARY KEY,
        value INTEGER NOT NULL DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS scans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        input TEXT NOT NULL,
        result TEXT NOT NULL,
        risk_score INTEGER NOT NULL,
        timestamp TEXT NOT NULL
    )`);

    // Seed initial metrics if missing
    db.run(`INSERT OR IGNORE INTO metrics (key, value) VALUES ('threatsBlocked', 1284)`);
    db.run(`INSERT OR IGNORE INTO metrics (key, value) VALUES ('activeScans', 42)`);
    db.run(`INSERT OR IGNORE INTO metrics (key, value) VALUES ('safetyScore', 98)`);
});

module.exports = db;
