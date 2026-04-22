require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const db = require('./database');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'aegis-lumina-super-secret-key-2026';

// Stitch screen file mapping
const SCREENS = {
  dashboard: 'c17b68c6ef4545029bc1fa77c416dc84.html',   // Enhanced Dashboard
  scan:      '870b0cf7df8044c2a678b5a9b076e5eb.html',   // Dynamic Tab Inputs
  chat:      'e6d424a01a1b46db89cb622df00510de.html',   // Shield Assistant Chat
  alerts:    'c17b68c6ef4545029bc1fa77c416dc84.html'    // Reuse dashboard for now
};

// Helper: serve a Stitch HTML file with shield.js injected
// Helper: serve a Stitch HTML file with shield.js injected and mockups cleaned
function serveScreen(screenFile, res) {
  const filePath = path.join(__dirname, 'public', screenFile);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Screen not found');
  }
  let html = fs.readFileSync(filePath, 'utf8');

  // 1. Remove redundant mockup scripts to prevent conflicts
  html = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, (match) => {
    if (match.includes('shield.js') || match.includes('tailwind')) return match;
    return '<!-- Stripped Mockup Script -->';
  });

  // 2. Hide static mockup result cards via injected style
  const shieldStyles = `
    <style>
      #scan-result-container, .scan-result-card, [id*="result-card"] { display: none !important; }
      .dynamic-result-active { display: block !important; }
    </style>
  `;

  // 3. Inject shield.js and styles
  const injection = `\n${shieldStyles}\n<script src="/js/shield.js"></script>\n`;
  if (!html.includes('shield.js')) {
    html = html.replace('</body>', injection + '</body>');
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Auth Routes (unprotected)
app.use('/api/v1/auth', authRoutes);

// Auth Middleware
function requireAuth(req, res, next) {
  const token = req.cookies.aegis_token;
  if (!token) {
    if (req.path.startsWith('/api')) return res.status(401).json({ error: 'Unauthorized' });
    return res.redirect('/login');
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    if (req.path.startsWith('/api')) return res.status(401).json({ error: 'Invalid token' });
    res.clearCookie('aegis_token');
    return res.redirect('/login');
  }
}

// API Routes (must come before static / page routes, protected)
app.use('/api/v1', requireAuth, apiRoutes);

// Static Assets (css, js, images — NOT html)
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ── Named Page Routes ──────────────────────────────────────
app.get('/login', (req, res) => {
  // If already full authenticated
  if (req.cookies.aegis_token) {
    try { jwt.verify(req.cookies.aegis_token, JWT_SECRET); return res.redirect('/'); } catch(e) {}
  }
  res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});

app.get('/', requireAuth, (req, res) => serveScreen(SCREENS.dashboard, res));
app.get('/scan', requireAuth, (req, res) => serveScreen(SCREENS.scan, res));
app.get('/chat', requireAuth, (req, res) => serveScreen(SCREENS.chat, res));
app.get('/alerts', requireAuth, (req, res) => {
  // Build a fully functional alerts page using the Stitch dashboard structure
  // Load alerts from DB and render a table
  db.all('SELECT * FROM alerts ORDER BY id DESC', [], (err, alerts) => {
    const rows = (alerts || []).map(a => {
      const status = a.status;
      const clr = status === 'Blocked' ? '#ba1a1a' : status === 'Quarantined' ? '#b45309' : '#006229';
      const bg  = status === 'Blocked' ? '#ffdad6' : status === 'Quarantined' ? '#fef3c7' : '#d1fae5';
      return `<tr>
        <td style="padding:14px 16px;font-size:12px;color:#737686">#${a.id}</td>
        <td style="padding:14px 16px"><span style="background:#ededf9;color:#004ac6;font-size:11px;font-weight:700;padding:4px 10px;border-radius:6px">${a.type}</span></td>
        <td style="padding:14px 16px;font-size:13px">${a.source || '—'}</td>
        <td style="padding:14px 16px;font-size:13px;max-width:320px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#434655">${a.detail}</td>
        <td style="padding:14px 16px"><span style="background:${bg};color:${clr};font-size:10px;font-weight:900;text-transform:uppercase;padding:4px 12px;border-radius:20px">${a.status}</span></td>
        <td style="padding:14px 16px;font-size:12px;color:#737686">${new Date(a.timestamp).toLocaleString()}</td>
      </tr>`;
    }).join('');

    const emptyState = alerts && alerts.length === 0
      ? `<div style="text-align:center;padding:48px;color:#737686">
           <span class="material-symbols-outlined" style="font-size:48px;opacity:.3">check_circle</span>
           <p style="font-size:14px;font-weight:600;margin-top:12px">No alerts logged. Your system is clean!</p>
         </div>` : '';

    const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Alert Log | AI Digital Shield</title>
<script src="https://cdn.tailwindcss.com?plugins=forms"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet">
<script id="tailwind-config">tailwind.config={theme:{extend:{colors:{"primary":"#004ac6","on-primary":"#ffffff","error":"#ba1a1a","error-container":"#ffdad6","on-error-container":"#93000a","tertiary":"#006229","surface":"#faf8ff","surface-container-lowest":"#ffffff","surface-container-low":"#f3f3fe","surface-container":"#ededf9","surface-container-high":"#e7e7f3","surface-container-highest":"#e1e2ed","on-surface":"#191b23","on-surface-variant":"#434655","outline-variant":"#c3c6d7"}}}}</script>
<style>.material-symbols-outlined{font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;vertical-align:middle}</style>
</head>
<body class="bg-surface font-['Inter'] text-on-surface">
<nav class="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl shadow-sm h-16">
  <div class="flex justify-between items-center h-16 px-8 max-w-screen-xl mx-auto">
    <div class="flex items-center gap-8">
      <span class="text-xl font-black tracking-tighter text-blue-800">AI Digital Shield</span>
      <div class="hidden md:flex items-center gap-6">
        <a href="/" class="text-slate-500 font-medium hover:text-blue-600 transition-colors">Home</a>
        <a href="/scan" class="text-slate-500 font-medium hover:text-blue-600 transition-colors">Scan</a>
        <a href="/chat" class="text-slate-500 font-medium hover:text-blue-600 transition-colors">Chatbot</a>
        <a href="/alerts" class="text-blue-700 font-bold border-b-2 border-blue-700 pb-1">Alert Log</a>
      </div>
    </div>
  </div>
</nav>
<aside class="hidden md:flex flex-col pt-20 pb-8 h-screen w-64 fixed left-0 top-0 bg-slate-50 font-['Inter'] text-sm font-semibold uppercase tracking-widest">
  <div class="px-6 mb-8 flex items-center gap-3">
    <div class="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white">
      <span class="material-symbols-outlined">security</span>
    </div>
    <div>
      <p class="text-lg font-bold text-slate-900 normal-case tracking-normal">Guardian Core</p>
      <p class="text-[10px] text-tertiary font-bold tracking-widest uppercase">System Secure</p>
    </div>
  </div>
  <nav class="space-y-1 flex-1">
    <a href="/" class="text-slate-500 py-3 px-6 flex items-center gap-3 hover:bg-slate-200/50 transition-all"><span class="material-symbols-outlined">home</span>Dashboard</a>
    <a href="/scan" class="text-slate-500 py-3 px-6 flex items-center gap-3 hover:bg-slate-200/50 transition-all"><span class="material-symbols-outlined">radar</span>Threat Matrix</a>
    <a href="/alerts" class="bg-blue-50 text-blue-700 rounded-r-full py-3 px-6 flex items-center gap-3"><span class="material-symbols-outlined">notifications_active</span>Alert Log</a>
    <a href="/chat" class="text-slate-500 py-3 px-6 flex items-center gap-3 hover:bg-slate-200/50 transition-all"><span class="material-symbols-outlined">smart_toy</span>Shield Assistant</a>
  </nav>
  <div class="px-6 mt-auto">
    <a href="/" class="text-slate-500 py-3 flex items-center gap-3 hover:bg-slate-200/50 transition-all text-xs"><span class="material-symbols-outlined">arrow_back</span>Back to Dashboard</a>
  </div>
</aside>
<main class="md:ml-64 pt-20 px-4 md:px-12 pb-24 min-h-screen">
  <header class="mb-8">
    <h1 class="text-4xl font-extrabold tracking-tighter text-on-surface mb-2">Alert Log</h1>
    <p class="text-on-surface-variant">All detected threats and security events — live from database</p>
  </header>
  <div class="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
    ${alerts && alerts.length ? `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:1px solid #c3c6d730">
            <th style="padding:14px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#434655">#</th>
            <th style="padding:14px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#434655">Type</th>
            <th style="padding:14px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#434655">Source</th>
            <th style="padding:14px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#434655">Detail</th>
            <th style="padding:14px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#434655">Status</th>
            <th style="padding:14px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#434655">Time</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>` : emptyState}
  </div>
</main>
<script src="/js/shield.js"></script>
</body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  });
});

// Also support .html aliases for backward compat
app.get('/scan.html', (req, res) => res.redirect('/scan'));
app.get('/chat.html', (req, res) => res.redirect('/chat'));
app.get('/alerts.html', (req, res) => res.redirect('/alerts'));

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🛡️  AI Digital Shield running at http://localhost:${PORT}\n`);
  console.log('  /          → Dashboard');
  console.log('  /scan      → Threat Scanner');
  console.log('  /chat      → Shield Assistant');
  console.log('  /alerts    → Alert Log');
  console.log('  /api/v1/.. → REST API\n');
});
