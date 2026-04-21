// Dashboard quick scan
const form = document.getElementById('quick-scan-form');
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = document.getElementById('quick-scan-type').value;
        const input = document.getElementById('quick-scan-input').value.trim();
        if (!input) return;
        const btn = form.querySelector('button[type=submit]');
        btn.disabled = true;
        btn.textContent = 'Scanning...';
        try {
            const res = await fetch('/api/v1/scan', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, input })
            });
            const data = await res.json();
            const panel = document.getElementById('quick-scan-result');
            panel.classList.remove('hidden');
            const isClean = data.riskScore < 30;
            panel.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
                    <strong>${data.result}</strong>
                    <span class="badge ${isClean ? 'badge-logged' : data.riskScore >= 60 ? 'badge-blocked' : 'badge-quarantined'}">${data.status}</span>
                </div>
                <div class="risk-bar-wrap" style="margin-bottom:0.5rem">
                    <div class="risk-bar" style="width:${data.riskScore}%"></div>
                    <span>${data.riskScore}% Risk</span>
                </div>
                ${data.findings.slice(0,2).map(f => `<div class="finding-item">${f}</div>`).join('')}
            `;
            // Update stats
            const statScans = document.getElementById('stat-scans');
            if (statScans) statScans.textContent = parseInt(statScans.textContent.replace(/,/g, ''), 10) + 1;
            if (!isClean) {
                const statThreats = document.getElementById('stat-threats');
                if (statThreats) statThreats.textContent = parseInt(statThreats.textContent.replace(/,/g, ''), 10) + 1;
            }
        } catch (err) {
            console.error(err);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined">radar</span> Scan Now';
        }
    });
}
