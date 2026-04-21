const express = require('express');
const router = express.Router();
const db = require('../database');

// Helper to fetch analytics from DB
function getAnalytics(cb) {
    const data = { threatsBlocked: 0, activeScans: 0, safetyScore: 98 };
    db.all('SELECT * FROM metrics', [], (err, rows) => {
        if (!err) rows.forEach(r => { data[r.key] = r.value; });
        cb(data);
    });
}

// Dashboard
router.get('/', (req, res) => {
    getAnalytics((metrics) => {
        db.all('SELECT * FROM alerts ORDER BY id DESC LIMIT 6', [], (err, alerts) => {
            db.all('SELECT * FROM scans ORDER BY id DESC LIMIT 5', [], (err2, scans) => {
                res.render('dashboard', {
                    title: 'Dashboard',
                    active: 'dashboard',
                    metrics,
                    alerts: alerts || [],
                    scans: scans || []
                });
            });
        });
    });
});

// Scan Page
router.get('/scan', (req, res) => {
    db.all('SELECT * FROM scans ORDER BY id DESC LIMIT 10', [], (err, scans) => {
        res.render('scan', {
            title: 'Threat Scanner',
            active: 'scan',
            scans: scans || []
        });
    });
});

// Alerts Page
router.get('/alerts', (req, res) => {
    db.all('SELECT * FROM alerts ORDER BY id DESC', [], (err, alerts) => {
        res.render('alerts', {
            title: 'Alert Log',
            active: 'alerts',
            alerts: alerts || []
        });
    });
});

// Chat Page
router.get('/chat', (req, res) => {
    db.all('SELECT * FROM chat_history ORDER BY id ASC LIMIT 50', [], (err, history) => {
        res.render('chat', {
            title: 'Shield Assistant',
            active: 'chat',
            history: history || []
        });
    });
});

module.exports = router;
