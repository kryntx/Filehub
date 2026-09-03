/** Realtime collaboration bus: SSE receive + POST send + status callbacks. */

const STORAGE_KEY = 'filehub_client_id';

function generateId() {
    try {
        if (crypto.randomUUID) return crypto.randomUUID();
    } catch {}
    return 'c' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

let clientId;
try {
    clientId = sessionStorage.getItem(STORAGE_KEY) || generateId();
    sessionStorage.setItem(STORAGE_KEY, clientId);
} catch {
    clientId = generateId();
}

const listeners = {};
const statusListeners = [];
let online = 1;
let connected = false;

const es = new EventSource('/api/events?clientId=' + encodeURIComponent(clientId));

es.onopen = () => {
    connected = true;
    emitStatus();
};

es.onerror = () => {
    connected = false;
    emitStatus();
};

es.onmessage = e => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (!msg || !msg.type) return;
    if (msg.sender && msg.sender === clientId) return;
    if (msg.type === 'presence' && msg.data && typeof msg.data.online === 'number') {
        online = msg.data.online;
        emitStatus();
    }
    (listeners[msg.type] || []).forEach(fn => fn(msg.data || {}, msg));
};

export function on(type, fn) {
    (listeners[type] = listeners[type] || []).push(fn);
}

export function send(type, data) {
    fetch('/api/events/send?clientId=' + encodeURIComponent(clientId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data: data || {} }),
    }).catch(() => {});
}

export function onStatus(fn) {
    statusListeners.push(fn);
    fn({ connected, online });
}

function emitStatus() {
    statusListeners.forEach(fn => fn({ connected, online }));
}

export { clientId };
