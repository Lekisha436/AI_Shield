// Live time
function updateTime() {
    const el = document.getElementById('live-time');
    if (el) el.textContent = new Date().toLocaleTimeString();
}
setInterval(updateTime, 1000);
updateTime();

// Sidebar toggle
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// Lockdown modal
function triggerLockdown() { document.getElementById('lockdown-modal').classList.add('open'); }
function closeLockdown() { document.getElementById('lockdown-modal').classList.remove('open'); }
function confirmLockdown() {
    document.getElementById('lockdown-modal').classList.remove('open');
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;background:rgba(255,110,132,0.04);z-index:9999;pointer-events:none;border:3px solid rgba(255,110,132,0.5);border-radius:0;animation:flashRed 1s ease';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
    alert('🔒 Emergency Lockdown Activated. All connections isolated.');
}

// Close sidebar on outside click (mobile)
document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.querySelector('.menu-toggle');
    if (sidebar && sidebar.classList.contains('open') && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
        sidebar.classList.remove('open');
    }
});
