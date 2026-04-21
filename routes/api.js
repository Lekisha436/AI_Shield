const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/v1/health
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /api/v1/analytics
router.get('/analytics', (req, res) => {
    const data = { threatsBlocked: 0, activeScans: 0, safetyScore: 98, recentAlerts: [] };
    db.all('SELECT * FROM metrics', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        rows.forEach(r => { data[r.key] = r.value; });
        db.all('SELECT * FROM alerts ORDER BY id DESC LIMIT 10', [], (err2, alerts) => {
            if (err2) return res.status(500).json({ error: err2.message });
            data.recentAlerts = alerts;
            res.json(data);
        });
    });
});

// POST /api/v1/scan - simulate AI scanning
router.post('/scan', (req, res) => {
    const { type, input } = req.body;
    if (!type || !input) return res.status(400).json({ error: 'Type and input are required' });

    // Keyword-based heuristic threat detection
    const phishingPatterns = ['click here', 'verify your', 'account suspended', 'urgent', 'win', 'free', 'bank', 'password', 'login', 'confirm', 'suspended', 'alert'];
    const maliciousDomains = ['secure-login', 'apple-id', 'paypal-verify', 'bank-confirm', '.xyz', '.tk', '.ru'];

    let riskScore = 0;
    let findings = [];
    const lowerInput = input.toLowerCase();

    phishingPatterns.forEach(p => {
        if (lowerInput.includes(p)) { riskScore += 15; findings.push(`Suspicious keyword: "${p}"`); }
    });
    maliciousDomains.forEach(d => {
        if (lowerInput.includes(d)) { riskScore += 25; findings.push(`Suspicious domain pattern: "${d}"`); }
    });
    if (/https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(input)) {
        riskScore += 35; findings.push('Bare IP address used as URL (suspicious)');
    }

    riskScore = Math.min(riskScore, 100);
    const status = riskScore >= 60 ? 'Blocked' : riskScore >= 30 ? 'Quarantined' : 'Safe';
    const result = riskScore >= 60 ? 'Threat Detected' : riskScore >= 30 ? 'Suspicious' : 'Clean';
    const timestamp = new Date().toISOString();

    db.run('INSERT INTO scans (type, input, result, risk_score, timestamp) VALUES (?,?,?,?,?)',
        [type, input, result, riskScore, timestamp], function(err) {
            if (err) console.error(err);
        });

    if (status !== 'Safe') {
        db.run('INSERT INTO alerts (type, source, detail, timestamp, status) VALUES (?,?,?,?,?)',
            [type + ' Scan', type, `Risk: ${riskScore}% — ${findings[0] || 'Pattern detected'}`, timestamp, status]);
        db.run("UPDATE metrics SET value = value + 1 WHERE key = 'threatsBlocked'");
    }
    db.run("UPDATE metrics SET value = value + 1 WHERE key = 'activeScans'");

    res.json({ result, riskScore, status, findings, timestamp });
});

// GET /api/v1/alerts
router.get('/alerts', (req, res) => {
    db.all('SELECT * FROM alerts ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST /api/v1/alerts
router.post('/alerts', (req, res) => {
    const { type, source, detail, status } = req.body;
    if (!type || !status) return res.status(400).json({ error: 'type and status required' });
    const timestamp = new Date().toISOString();
    db.run('INSERT INTO alerts (type, source, detail, timestamp, status) VALUES (?,?,?,?,?)',
        [type, source || '', detail || '', timestamp, status], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id: this.lastID, type, status, timestamp });
        });
});

// POST /api/v1/chat - simple AI shield assistant
router.post('/chat', (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });
    const timestamp = new Date().toISOString();
    const lowerMsg = message.toLowerCase();

    // Predefined intelligent responses
    let reply = '';
    if (lowerMsg.includes('threat') || lowerMsg.includes('attack')) {
        reply = '🔍 I\'ve analyzed recent threats. We\'ve blocked ' + ' multiple intrusions today. The main vectors detected are phishing URLs and injection attempts. All systems are secured.';
    } else if (lowerMsg.includes('scan') || lowerMsg.includes('check')) {
        reply = '⚡ To scan content, head to the Scan page and paste your message, URL, or email. I\'ll run a full heuristic analysis and show you a risk breakdown instantly.';
    } else if (lowerMsg.includes('status') || lowerMsg.includes('safe')) {
        reply = '✅ Current shield status: All systems operational. Firewall active, threat intelligence feeds updated 2 minutes ago.';
    } else if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
        reply = '👋 Hello! I\'m your AI Shield Assistant. I can help you understand threats, guide you through scans, or provide a system status report. What do you need?';
    } else if (lowerMsg.includes('block') || lowerMsg.includes('lockdown')) {
        reply = '🔒 Emergency lockdown mode is available from the sidebar. This will isolate network connections and freeze all suspicious processes until you authorize resumption.';
    } else if (lowerMsg.includes('phish')) {
        reply = '🎣 Phishing attacks use urgency and deception to steal credentials. Always verify URLs before clicking, check sender email domains carefully, and never enter credentials via email links.';
    } else {
        reply = '🛡️ I\'m your AI Digital Shield assistant. I can help with threat analysis, scan guidance, and security recommendations. Try asking about threats, scan results, or current system status.';
    }

    db.run('INSERT INTO chat_history (role, message, timestamp) VALUES (?,?,?)', ['user', message, timestamp]);
    db.run('INSERT INTO chat_history (role, message, timestamp) VALUES (?,?,?)', ['assistant', reply, timestamp]);

    res.json({ reply, timestamp });
});

// GET /api/v1/chat/history
router.get('/chat/history', (req, res) => {
    db.all('SELECT * FROM chat_history ORDER BY id ASC LIMIT 50', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

module.exports = router;
