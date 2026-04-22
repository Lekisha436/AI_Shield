/* ====================================================
   AI Digital Shield — Shared Runtime (shield.js)
   Injected into all pages by Express. Adds:
   - Navigation wiring
   - Live stats from /api/v1/analytics
   - Scan form → /api/v1/scan
   - Chat input → /api/v1/chat
   - Alert log from /api/v1/alerts
   ==================================================== */

(function () {
  'use strict';

  /* ── Helpers ──────────────────────────────────── */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return [...(ctx || document).querySelectorAll(sel)]; }
  function toast(msg, type) {
    const colors = {
      danger: 'background:#ffdad6;color:#ba1a1a',
      warning: 'background:#fef3c7;color:#b45309',
      success: 'background:#d1fae5;color:#006229',
      info: 'background:#dbe1ff;color:#003ea8'
    };
    const t = document.createElement('div');
    t.setAttribute('style', `position:fixed;top:80px;right:20px;z-index:9999;
      padding:12px 20px;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.15);
      font-family:Inter,sans-serif;font-size:13px;font-weight:700;max-width:360px;
      animation:shieldFadeIn .3s ease;${colors[type] || colors.info}`);
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.style.opacity = '0', 3500);
    setTimeout(() => t.remove(), 4000);
  }

  // Inject animation keyframes once
  if (!document.getElementById('shield-styles')) {
    const s = document.createElement('style');
    s.id = 'shield-styles';
    s.textContent = `@keyframes shieldFadeIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`;
    document.head.appendChild(s);
  }

  const PAGE = window.location.pathname;

  /* ── Navigation Wiring ───────────────────────── */
  function wireNav() {
    const navMap = {
      'home':        '/',
      'scan':        '/scan',
      'chatbot':     '/chat',
      'chat':        '/chat',
      'dashboard':   '/',
      'analysis':    '/scan',
      'threat matrix': '/scan',
      'activity':    '/alerts',
      'support':     '/chat',
      'vault':       '/alerts'
    };

    $$('a').forEach(a => {
      const href = (a.getAttribute('href') || '').trim();
      const text = a.textContent.trim().toLowerCase();
      if (href === '#' || href === '' || href === window.location.href) {
        for (const [key, url] of Object.entries(navMap)) {
          if (text.includes(key)) { a.href = url; break; }
        }
      }
    });

    // Mobile bottom nav buttons
    $$('nav button, nav.md\\:hidden button').forEach(btn => {
      const label = (btn.querySelector('span:last-child') || btn).textContent.trim().toLowerCase();
      if (label === 'scan') btn.onclick = () => location.href = '/scan';
      if (label === 'chat') btn.onclick = () => location.href = '/chat';
      if (label === 'home') btn.onclick = () => location.href = '/';
    });

    // Wire up Logout
    $$('a, button').forEach(el => {
      if (el.textContent.trim().toLowerCase() === 'logout') {
        el.addEventListener('click', async (e) => {
          e.preventDefault();
          try {
            await fetch('/api/v1/auth/logout', { method: 'POST' });
            window.location.href = '/login';
          } catch(err) {
            toast('Failed to logout', 'danger');
          }
        });
      }
    });

    // FAB radar button → scan
    $$('button[class*="bottom-8"]').forEach(btn => {
      if (btn.textContent.includes('radar')) btn.onclick = () => location.href = '/scan';
    });
  }

  /* ── Live Analytics (Dashboard) ─────────────── */
  function loadAnalytics() {
    fetch('/api/v1/analytics')
      .then(r => r.json())
      .then(data => {
        // Update stat counters — select the large number spans
        const statSpans = $$('section.grid span.text-4xl, section span.text-4xl');
        if (statSpans[0]) statSpans[0].textContent = Number(data.activeScans).toLocaleString();
        if (statSpans[1]) statSpans[1].textContent = Number(data.threatsBlocked).toLocaleString();
        if (statSpans[2] && statSpans[2].textContent.includes('%')) {
          statSpans[2].textContent = data.safetyScore + '%';
        }

        // Inject live alerts into Recent Threats / Activity feed
        if (data.recentAlerts && data.recentAlerts.length) {
          // Find a container that has threat/alert-related children
          const candidates = $$('.space-y-4, .space-y-6');
          candidates.forEach(container => {
            const hasAlertContent = container.innerHTML.toLowerCase().includes('threat') ||
                                    container.innerHTML.toLowerCase().includes('alert') ||
                                    container.innerHTML.toLowerCase().includes('scam') ||
                                    container.innerHTML.toLowerCase().includes('phishing');
            if (hasAlertContent && container.children.length > 0) {
              container.innerHTML = data.recentAlerts.slice(0, 5).map(a => {
                const clr = a.status === 'Blocked' ? '#ba1a1a' : a.status === 'Quarantined' ? '#b45309' : '#006229';
                const bg  = a.status === 'Blocked' ? '#ffdad620' : a.status === 'Quarantined' ? '#fef3c740' : '#d1fae540';
                return `<div style="display:flex;align-items:flex-start;gap:12px;padding:12px;background:${bg};border-radius:12px;border:1px solid ${clr}30;margin-bottom:8px">
                  <span class="material-symbols-outlined" style="color:${clr};font-size:18px;margin-top:2px">warning</span>
                  <div style="flex:1;min-width:0">
                    <p style="font-size:13px;font-weight:700;margin:0 0 2px">${a.type}</p>
                    <p style="font-size:11px;color:#434655;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0">${a.detail}</p>
                    <p style="font-size:10px;color:#737686;margin:4px 0 0">${new Date(a.timestamp).toLocaleString()}</p>
                  </div>
                  <span style="font-size:10px;font-weight:800;text-transform:uppercase;padding:3px 8px;border-radius:20px;color:${clr};background:${bg};border:1px solid ${clr}50;white-space:nowrap">${a.status}</span>
                </div>`;
              }).join('');
            }
          });
        }
      })
      .catch(() => {});
  }

  /* ── Scan Form Logic ─────────────────────────── */
  function wireScanButtons() {
    $$('button').forEach(btn => {
      const txt = btn.textContent.trim().toLowerCase();
      const isScanBtn = ['analyze message','analyze url','scan email','analyze image',
                         'analyse message','analyse url','run scan','scan now']
                        .some(k => txt.includes(k.split(' ')[0]) && txt.includes(k.split(' ')[1] || ''));

      if (!isScanBtn || btn.dataset.shieldWired) return;
      btn.dataset.shieldWired = '1';

      btn.addEventListener('click', async e => {
        e.preventDefault();

        // Find nearest input/textarea within the scanner block
        const container = btn.closest('.scanner-content, section, form') || document.body;
        const inputEl = container.querySelector('textarea') ||
                        container.querySelector('input[type=text]') ||
                        container.querySelector('input:not([type=hidden]):not([type=submit])');
        const input = inputEl ? inputEl.value.trim() : '';
        if (!input) { if (inputEl) inputEl.focus(); return; }

        // Determine type from tab or button text
        let type = 'Message';
        const activetab = $('[class*="tab-btn"].active, [class*="tab"].active[data-target]') ;
        if (activetab) {
          const t = activetab.textContent.toLowerCase();
          if (t.includes('url')) type = 'URL';
          else if (t.includes('email')) type = 'Email';
          else if (t.includes('image')) type = 'Image';
        } else if (txt.includes('url')) type = 'URL';
        else if (txt.includes('email')) type = 'Email';
        else if (txt.includes('image')) type = 'Image';

        const orig = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined" style="vertical-align:middle;font-size:16px">hourglass_top</span> Analysing…';

        try {
          const res = await fetch('/api/v1/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, input })
          });
          const data = await res.json();

          // Show inline result if a result card exists, else toast
          const resultCard = $('.lg\\:col-span-8 .bg-surface-container-lowest, [id*="result-card"]') ||
                             $('.bg-surface-container-low.p-6.rounded-xl.border-l-4.border-error')?.closest('div') ||
                             null;
          if (resultCard) {
            // Unhide and clear any mockup content
            const parent = resultCard.closest('[id*="result-container"]') || resultCard;
            parent.classList.add('dynamic-result-active');
            parent.style.display = 'block'; 
            renderResultCard(resultCard, data, input, type);
            resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          } else {
            const tp = data.riskScore >= 60 ? 'danger' : data.riskScore >= 30 ? 'warning' : 'success';
            toast(`${data.result} — Risk: ${data.riskScore}%`, tp);
          }

          if (inputEl) inputEl.value = '';
          loadAnalytics(); // refresh counters
        } catch {
          toast('Scan failed — is the server running?', 'danger');
        } finally {
          btn.disabled = false;
          btn.innerHTML = orig;
        }
      });
    });
  }

  function renderResultCard(card, data, input, type) {
    const clr = data.riskScore >= 60 ? '#ba1a1a' : data.riskScore >= 30 ? '#b45309' : '#006229';
    const bg  = data.riskScore >= 60 ? '#ffdad6' : data.riskScore >= 30 ? '#fef3c7' : '#d1fae5';
    const label = data.riskScore >= 60 ? '🚨 Threat Detected' : data.riskScore >= 30 ? '⚠️ Suspicious' : '✅ Clean';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
        <div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
            <h2 style="font-size:24px;font-weight:800;margin:0">Scan Result</h2>
            <span style="background:${bg};color:${clr};padding:4px 12px;border-radius:20px;font-size:11px;font-weight:900;text-transform:uppercase">${label} (${data.riskScore}%)</span>
          </div>
          <p style="color:#434655;font-size:13px;margin:0">Type: ${type} &bull; Status: <strong>${data.status}</strong></p>
        </div>
        <span style="color:#004ac6;font-weight:700;font-size:13px">✓ Complete</span>
      </div>
      <div style="background:#f3f3fe;padding:20px;border-radius:12px;border-left:4px solid ${clr};margin-bottom:24px">
        <p style="font-size:15px;line-height:1.6;font-style:italic;margin:0">"${input.substring(0,350)}${input.length>350?'…':''}"</p>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div style="background:#faf8ff;padding:20px;border-radius:12px;border:1px solid #c3c6d730">
          <h3 style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#434655;margin:0 0 12px;display:flex;align-items:center;gap:6px">
            <span class="material-symbols-outlined" style="font-size:14px;color:#004ac6">psychology</span> AI Explanation
          </h3>
          ${data.findings.length
            ? data.findings.map(f=>`<p style="font-size:13px;line-height:1.5;margin:0 0 8px">⚠ ${f}</p>`).join('')
            : '<p style="font-size:13px;color:#006229">✔ No suspicious patterns found. Content appears safe.</p>'}
        </div>
        <div style="background:#faf8ff;padding:20px;border-radius:12px;border:1px solid #c3c6d730">
          <h3 style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#434655;margin:0 0 12px;display:flex;align-items:center;gap:6px">
            <span class="material-symbols-outlined" style="font-size:14px;color:#006229">task_alt</span> Recommended Actions
          </h3>
          <div style="font-size:11px;font-weight:700;color:${clr};margin-bottom:6px">Risk Level: ${data.riskScore}%</div>
          <div style="height:8px;background:#ededf9;border-radius:4px;overflow:hidden;margin-bottom:16px">
            <div style="height:100%;width:${data.riskScore}%;background:${clr};border-radius:4px;transition:width .6s"></div>
          </div>
          ${data.riskScore >= 60
            ? `<button onclick="location.href='/alerts'" style="width:100%;padding:10px;background:#ba1a1a;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px">View Alert Log</button>
               <button onclick="location.href='/chat'" style="width:100%;padding:10px;background:#ededf9;color:#191b23;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">Ask Shield Assistant</button>`
            : `<button onclick="location.href='/chat'" style="width:100%;padding:10px;background:#004ac6;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">Ask Shield Assistant</button>`
          }
        </div>
      </div>`;
  }

  /* ── Chat Logic ──────────────────────────────── */
  function wireChat() {
    // Find the chat input
    const chatInput = $('input[placeholder*="security"], input[placeholder*="concern"], input[placeholder*="Describe"], input[placeholder*="message"]');
    const sendBtn   = chatInput ? chatInput.closest('div')?.querySelector('button:last-child') : null;
    const chatWindow = $('div.flex-1.overflow-y-auto.flex.flex-col');

    if (!chatInput) return;

    // Load history on chat page
    if (PAGE.startsWith('/chat')) {
      fetch('/api/v1/chat/history').then(r=>r.json()).then(history => {
        if (chatWindow && history.length > 2) {
          // Remove template messages, keep the first AI welcome if history is fresh
          const templateMessages = chatWindow.querySelectorAll('div.flex.gap-4');
          if (templateMessages.length <= 3) return; // keep template if no real history
          templateMessages.forEach(m => m.remove());
          history.forEach(h => appendChatMsg(chatWindow, h.role, h.message));
        }
        chatWindow && (chatWindow.scrollTop = chatWindow.scrollHeight);
      }).catch(()=>{});
    }

    async function sendMessage() {
      const msg = chatInput.value.trim();
      if (!msg) return;
      chatInput.value = '';
      appendChatMsg(chatWindow, 'user', msg);
      const typing = appendTyping(chatWindow);
      try {
        const res = await fetch('/api/v1/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg })
        });
        const data = await res.json();
        typing.remove();
        appendChatMsg(chatWindow, 'assistant', data.reply);
      } catch {
        typing.remove();
        appendChatMsg(chatWindow, 'assistant', '⚠️ Connection error. Please try again.');
      }
      chatWindow && (chatWindow.scrollTop = chatWindow.scrollHeight);
    }

    chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);

    // Quick action chips
    $$('div.flex.gap-2.justify-center button').forEach(btn => {
      if (!btn.dataset.shieldWired) {
        btn.dataset.shieldWired = '1';
        btn.addEventListener('click', () => {
          chatInput.value = btn.textContent.trim();
          sendMessage();
        });
      }
    });
  }

  function appendChatMsg(window, role, text) {
    if (!window) return;
    const isBot = role === 'assistant';
    const div = document.createElement('div');
    div.className = `flex gap-4 max-w-3xl ${isBot ? '' : 'ml-auto flex-row-reverse'}`;
    div.innerHTML = `
      <div style="width:40px;height:40px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;
        background:${isBot ? '#004ac6' : '#e1e2ed'};color:${isBot ? '#fff' : '#191b23'}">
        <span class="material-symbols-outlined" style="font-size:18px">${isBot ? 'verified_user' : 'person'}</span>
      </div>
      <div style="flex:1">
        <div style="padding:16px 20px;border-radius:${isBot ? '0 20px 20px 20px' : '20px 0 20px 20px'};
          background:${isBot ? '#ffffff' : '#004ac6'};color:${isBot ? '#191b23' : '#ffffff'};
          box-shadow:0 1px 4px rgba(0,0,0,.08);border:${isBot ? '1px solid #c3c6d720' : 'none'};
          font-size:14px;line-height:1.6;max-width:500px">
          ${text}
        </div>
        <span style="font-size:10px;color:#737686;padding:4px;text-transform:uppercase;letter-spacing:.06em">
          ${isBot ? 'Shield Assistant' : 'You'} &bull; ${new Date().toLocaleTimeString()}
        </span>
      </div>`;
    window.appendChild(div);
    window.scrollTop = window.scrollHeight;
  }

  function appendTyping(window) {
    if (!window) return { remove: ()=>{} };
    const div = document.createElement('div');
    div.className = 'flex gap-4 max-w-3xl';
    div.innerHTML = `
      <div style="width:40px;height:40px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:#004ac6;color:#fff">
        <span class="material-symbols-outlined" style="font-size:18px">verified_user</span>
      </div>
      <div style="padding:16px 20px;border-radius:0 20px 20px 20px;background:#fff;border:1px solid #c3c6d730;box-shadow:0 1px 4px rgba(0,0,0,.08)">
        <span style="display:inline-flex;gap:4px">
          <span style="animation:shieldFadeIn 1s 0s infinite">●</span>
          <span style="animation:shieldFadeIn 1s .2s infinite">●</span>
          <span style="animation:shieldFadeIn 1s .4s infinite">●</span>
        </span>
      </div>`;
    window.appendChild(div);
    window.scrollTop = window.scrollHeight;
    return div;
  }

  /* ── Alerts Page ─────────────────────────────── */
  function wireAlertsPage() {
    if (!PAGE.startsWith('/alerts')) return;
    const main = $('main');
    if (!main) return;

    fetch('/api/v1/alerts').then(r => r.json()).then(alerts => {
      // Find the existing table body and replace with live data
      const tbody = $('tbody');
      const table = $('table');
      if (tbody && alerts.length) {
        tbody.innerHTML = alerts.map(a => {
          const clr = a.status === 'Blocked' ? '#ba1a1a' : a.status === 'Quarantined' ? '#b45309' : '#006229';
          const bg  = a.status === 'Blocked' ? '#ffdad6' : a.status === 'Quarantined' ? '#fef3c7' : '#d1fae5';
          return `<tr>
            <td style="padding:12px 16px;font-size:12px;color:#737686">#${a.id}</td>
            <td style="padding:12px 16px">
              <span style="background:#ededf9;color:#004ac6;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px">${a.type}</span>
            </td>
            <td style="padding:12px 16px;font-size:13px">${a.source || '—'}</td>
            <td style="padding:12px 16px;font-size:13px;max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.detail}</td>
            <td style="padding:12px 16px">
              <span style="background:${bg};color:${clr};font-size:10px;font-weight:800;text-transform:uppercase;padding:3px 10px;border-radius:20px">${a.status}</span>
            </td>
            <td style="padding:12px 16px;font-size:12px;color:#737686">${new Date(a.timestamp).toLocaleString()}</td>
          </tr>`;
        }).join('');
      }
    }).catch(()=>{});
  }

  /* ── Run on DOM ready ────────────────────────── */
  function init() {
    wireNav();
    loadAnalytics();
    wireScanButtons();
    wireChat();
    wireAlertsPage();
    // Re-wire scan buttons after tab switches (they may be newly visible)
    $$('[onclick*="switchScannerTab"], .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => setTimeout(wireScanButtons, 100));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
