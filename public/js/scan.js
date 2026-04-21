// Tab switching
let activeTab = 'message';
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        activeTab = tab.dataset.tab;
        document.getElementById('scan-type').value = tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1);
        document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
        document.getElementById('scan-result').classList.add('hidden');
    });
});

// Scan form submission
const scanForm = document.getElementById('scan-form');
if (scanForm) {
    scanForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = document.getElementById('scan-type').value;
        const inputEl = document.getElementById(`input-${activeTab}`);
        const input = inputEl ? inputEl.value.trim() : '';
        if (!input) { inputEl && inputEl.focus(); return; }

        const btn = document.getElementById('scan-btn');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined">hourglass_top</span> Analysing...';

        try {
            const res = await fetch('/api/v1/scan', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, input })
            });
            const data = await res.json();
            showResult(data, input);
            addToHistory({ type, input, result: data.result, risk_score: data.riskScore, status: data.status, timestamp: new Date().toISOString() });
        } catch (err) {
            console.error(err);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined">radar</span> Run Scan';
        }
    });
}

function showResult(data, input) {
    const panel = document.getElementById('scan-result');
    panel.classList.remove('hidden');
    const badgeClass = data.riskScore >= 60 ? 'badge-blocked' : data.riskScore >= 30 ? 'badge-quarantined' : 'badge-logged';
    const verdictLabel = data.riskScore >= 60 ? '🚨 Threat Detected' : data.riskScore >= 30 ? '⚠️ Suspicious Content' : '✅ Content Appears Safe';
    document.getElementById('result-verdict').textContent = verdictLabel;
    const badge = document.getElementById('result-badge');
    badge.textContent = data.status;
    badge.className = `badge ${badgeClass}`;
    document.getElementById('result-score-text').textContent = `${data.riskScore}%`;
    document.getElementById('result-meter').style.width = `${data.riskScore}%`;
    const findingsEl = document.getElementById('result-findings');
    findingsEl.innerHTML = data.findings.length
        ? data.findings.map(f => `<div class="finding-item">${f}</div>`).join('')
        : '<div class="finding-item" style="color:var(--success)">✔ No suspicious patterns found</div>';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function addToHistory(scan) {
    const list = document.getElementById('scan-history-list');
    if (!list) return;
    const badgeClass = scan.risk_score >= 60 ? 'badge-blocked' : scan.risk_score >= 30 ? 'badge-quarantined' : 'badge-logged';
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
        <div class="history-meta">
            <span class="tag small">${scan.type}</span>
            <span class="muted small">Just now</span>
        </div>
        <div class="history-input">${scan.input}</div>
        <div class="history-result">
            <span class="badge ${badgeClass}">${scan.result}</span>
            <span class="risk-pill">${scan.risk_score}% risk</span>
        </div>
    `;
    list.prepend(item);
}

function clearScan() {
    ['input-message', 'input-url', 'input-email'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('scan-result').classList.add('hidden');
}
