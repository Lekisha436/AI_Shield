const db = require('../database');

db.serialize(() => {
    db.run('DELETE FROM alerts');
    db.run('DELETE FROM metrics');

    const metricsData = [['threatsBlocked', 1284], ['activeScans', 42], ['safetyScore', 98]];
    const mStmt = db.prepare('INSERT INTO metrics (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    metricsData.forEach(m => mStmt.run(m));
    mStmt.finalize();

    const alertsData = [
        ['Message Scan', 'Message', 'Suspicious keyword: "click here" — Risk 75%', '2026-04-21T18:00:00Z', 'Blocked'],
        ['URL Scan', 'URL', 'Suspicious domain pattern: ".xyz" — Risk 60%', '2026-04-21T19:30:00Z', 'Blocked'],
        ['Email Scan', 'Email', 'Suspicious keyword: "verify your" — Risk 45%', '2026-04-21T21:15:00Z', 'Quarantined'],
        ['Message Scan', 'Message', 'Suspicious keyword: "urgent" — Risk 30%', '2026-04-22T00:05:00Z', 'Quarantined'],
    ];
    const aStmt = db.prepare('INSERT INTO alerts (type, source, detail, timestamp, status) VALUES (?,?,?,?,?)');
    alertsData.forEach(a => aStmt.run(a));
    aStmt.finalize();

    console.log('✅ Database seeded successfully.');
});

db.close();
