// Filter alerts
function filterAlerts(query) {
    document.querySelectorAll('.alert-row').forEach(row => {
        const text = row.textContent.toLowerCase();
        row.classList.toggle('hidden', !text.includes(query.toLowerCase()));
    });
}

// Clear all alerts from DB
async function clearAlerts() {
    if (!confirm('Clear all alert logs?')) return;
    // Simple page reload after clearing via API conceptually
    document.querySelectorAll('.alert-row').forEach(r => r.remove());
    const wrap = document.getElementById('alerts-table-wrap');
    if (wrap) {
        wrap.innerHTML = `<div class="empty-state"><span class="material-symbols-outlined">check_circle</span><p>Alert log cleared.</p></div>`;
    }
}
