const chatWindow = document.getElementById('chat-window');

function scrollToBottom() {
    if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
}
scrollToBottom();

function appendMessage(role, text) {
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    const isBot = role === 'assistant';
    div.innerHTML = `
        <div class="chat-bubble">
            ${isBot ? '<span class="material-symbols-outlined bot-icon">smart_toy</span>' : ''}
            <div class="bubble-text">${text}</div>
        </div>
    `;
    chatWindow.appendChild(div);
    scrollToBottom();
}

function showTyping() {
    const div = document.createElement('div');
    div.className = 'chat-msg assistant';
    div.id = 'typing-indicator';
    div.innerHTML = `
        <div class="chat-bubble">
            <span class="material-symbols-outlined bot-icon">smart_toy</span>
            <div class="bubble-text" style="color:var(--on-surface-muted)">
                <span style="display:inline-flex;gap:4px">
                    <span style="animation:pulse 1s 0s infinite">●</span>
                    <span style="animation:pulse 1s 0.2s infinite">●</span>
                    <span style="animation:pulse 1s 0.4s infinite">●</span>
                </span>
            </div>
        </div>
    `;
    chatWindow.appendChild(div);
    scrollToBottom();
}

function hideTyping() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
}

async function sendChat() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;
    input.value = '';
    document.getElementById('prompt-chips').style.display = 'none';

    appendMessage('user', message);
    showTyping();

    try {
        const res = await fetch('/api/v1/chat', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        const data = await res.json();
        setTimeout(() => {
            hideTyping();
            appendMessage('assistant', data.reply);
        }, 600);
    } catch (err) {
        hideTyping();
        appendMessage('assistant', '⚠️ Connection error. Please try again.');
    }
}

function sendPrompt(text) {
    document.getElementById('chat-input').value = text;
    sendChat();
}
