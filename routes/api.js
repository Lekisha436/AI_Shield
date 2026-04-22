const express = require('express');
const router = express.Router();
const db = require('../database');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

// Lazy-initialized Gemini Client
let aiInstance = null;
function getAI() {
    if (aiInstance) return aiInstance;
    const key = (process.env.GEMINI_API_KEY || '').trim();
    if (!key || key === 'YOUR_API_KEY_HERE') {
        throw new Error('GEMINI_API_KEY_MISSING');
    }
    aiInstance = new GoogleGenAI(key);
    return aiInstance;
}

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

// POST /api/v1/scan - Dynamic Google Gemini Scanning
router.post('/scan', async (req, res) => {
    const { type, input } = req.body;
    if (!type || !input) return res.status(400).json({ error: 'Type and input are required' });

    let riskScore = 0;
    let findings = [];
    let status = 'Safe';
    let resultText = 'Clean';

    const API_KEY = (process.env.GEMINI_API_KEY || '').trim();
    if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') {
        console.error('❌ Gemini API Key is missing in environment!');
        return res.json({
            result: "API_KEY_MISSING",
            riskScore: 0,
            status: "Error",
            findings: ["Error: The GEMINI_API_KEY is not configured in the .env file. Please add your key and restart the server."],
            timestamp: new Date().toISOString()
        });
    }

    try {
        const prompt = `You are Aegis Lumina, an expert enterprise cybersecurity AI threat analyzer.
Analyze the following ${type} content and determine its malice.
Content to analyze: "${input}"

Respond ONLY with a raw JSON object containing the exact following keys:
- "riskScore": integer from 0 to 100 representing the threat probability.
- "findings": array of short, powerful strings describing specific detected flags or tactics (e.g. "Urgency applied", "Typo-squatted domain").
- "status": string exactly either "Safe", "Quarantined", or "Blocked".
- "resultText": string describing general status like "Clean", "Suspicious", or "Threat Detected".

Do not return markdown, do not wrap in \`\`\`. ONLY valid JSON.
`;
        
        const model = getAI().getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let outputStr = response.text().trim();


        // Clean markdown JSON wrapper if the model aggressively included it
        if (outputStr.startsWith('```')) {
            const match = outputStr.match(/```(?:json)?\n([\s\S]*?)```/);
            if (match) outputStr = match[1];
        }

        const aiData = JSON.parse(outputStr.trim());
        riskScore = aiData.riskScore || 0;
        findings = aiData.findings || [];
        status = aiData.status || 'Safe';
        resultText = aiData.resultText || 'Clean';

    } catch (err) {
        console.error("Gemini Error:", err);
        return res.status(500).json({ result: "ERROR", error: "AI Engine malfunction", findings: [err.message] });
    }

    const timestamp = new Date().toISOString();

    db.run('INSERT INTO scans (type, input, result, risk_score, timestamp) VALUES (?,?,?,?,?)',
        [type, input, resultText, riskScore, timestamp]);

    if (status !== 'Safe') {
        db.run('INSERT INTO alerts (type, source, detail, timestamp, status) VALUES (?,?,?,?,?)',
            [type + ' Scan', type, `Risk: ${riskScore}% — ${findings[0] || 'Pattern detected'}`, timestamp, status]);
        db.run("UPDATE metrics SET value = value + 1 WHERE key = 'threatsBlocked'");
    }
    db.run("UPDATE metrics SET value = value + 1 WHERE key = 'activeScans'");

    res.json({ result: resultText, riskScore, status, findings, timestamp });
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

// POST /api/v1/chat - Dynamic Assistant powered by Gemini
router.post('/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });
    const timestamp = new Date().toISOString();

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
        return res.json({ reply: "⚠️ Error: The Shield AI requires a GEMINI_API_KEY in the environment variables to function.", timestamp });
    }

    try {
        db.all('SELECT role, message FROM chat_history ORDER BY id DESC LIMIT 5', [], async (err, historyRows) => {
            let contextStr = "Recent conversation context:\n";
            if (!err && historyRows.length > 0) {
                historyRows.reverse().forEach(r => {
                    contextStr += `${r.role === 'user' ? 'User' : 'Aegis Lumina'}: ${r.message}\n`;
                });
            } else {
                contextStr = "(No previous conversation context).\n";
            }

            const prompt = `You are Aegis Lumina, the AI Digital Shield Assistant.
You protect the user against cyber threats, provide firewall status, and explain malware techniques. 
Keep your answers brief, professional, and confident. Do NOT use markdown code blocks or large formatting, just conversational text with emoji where appropriate.

${contextStr}
User's query: "${message}"`;

            const model = getAI().getGenerativeModel({ model: 'gemini-1.5-flash' });
            const result = await model.generateContent(prompt);
            const response = await result.response;


            const reply = response.text().trim();
            
            db.run('INSERT INTO chat_history (role, message, timestamp) VALUES (?,?,?)', ['user', message, timestamp]);
            db.run('INSERT INTO chat_history (role, message, timestamp) VALUES (?,?,?)', ['assistant', reply, timestamp]);
            
            res.json({ reply, timestamp: new Date().toISOString() });
        });
    } catch (err) {
        console.error("Gemini Chat Error:", err);
        res.status(500).json({ reply: "System Malfunction: Unable to reach the Neural Core.", timestamp });
    }
});

// GET /api/v1/chat/history
router.get('/chat/history', (req, res) => {
    db.all('SELECT * FROM chat_history ORDER BY id ASC LIMIT 50', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

module.exports = router;
