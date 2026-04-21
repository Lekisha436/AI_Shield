const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'aegis-lumina-super-secret-key-2026';

// Register User
router.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password || password.length < 6) {
        return res.status(400).json({ error: 'Valid username and 6+ char password required.' });
    }

    // Check if user exists
    db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (row) return res.status(400).json({ error: 'Username already taken' });

        // Hash and store
        bcrypt.hash(password, 10, (err, hash) => {
            if (err) return res.status(500).json({ error: 'Hashing error' });
            
            db.run('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)', 
                [username, hash, new Date().toISOString()], 
                function(err) {
                    if (err) return res.status(500).json({ error: 'Failed to register' });
                    
                    // Create token and login automatically
                    const token = jwt.sign({ id: this.lastID, username }, JWT_SECRET, { expiresIn: '24h' });
                    res.cookie('aegis_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
                    res.json({ success: true, message: 'Registration successful' });
                }
            );
        });
    });
});

// Login User
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required.' });
    }

    db.get('SELECT id, username, password_hash FROM users WHERE username = ?', [username], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        bcrypt.compare(password, user.password_hash, (err, isMatch) => {
            if (err) return res.status(500).json({ error: 'Comparison error' });
            if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

            const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
            res.cookie('aegis_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
            res.json({ success: true, message: 'Login successful' });
        });
    });
});

// Logout User
router.post('/logout', (req, res) => {
    res.clearCookie('aegis_token');
    res.json({ success: true, message: 'Logged out' });
});

module.exports = router;
