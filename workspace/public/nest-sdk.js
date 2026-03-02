// public/nest-sdk.js — served at /nest-sdk.js
// Extensions import this: import { nest } from '/nest-sdk.js';

const pending = new Map();
let eventListeners = new Map();

function genId() {
    return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function request(action, args) {
    return new Promise((resolve, reject) => {
        const id = genId();
        pending.set(id, { resolve, reject });
        window.parent.postMessage({ type: 'nest', id, action, args }, '*');
    });
}

window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg?.type === 'nest-reply' && msg.id) {
        const p = pending.get(msg.id);
        if (p) {
            pending.delete(msg.id);
            if ('error' in msg) p.reject(new Error(msg.error));
            else p.resolve(msg.result);
        }
    } else if (msg?.type === 'nest-event') {
        const listeners = eventListeners.get(msg.name) ?? [];
        for (const fn of listeners) fn(msg.detail);
    } else if (msg?.type === 'nest-theme') {
        const root = document.documentElement;
        for (const [prop, val] of Object.entries(msg.vars)) {
            root.style.setProperty(prop, val);
        }
    }
});

export const nest = {
    async fetch(url, init) {
        return request('fetch', { url, init });
    },
    async readFile(root, path) {
        return request('readFile', { root, path });
    },
    async writeFile(root, path, content) {
        return request('writeFile', { root, path, content });
    },
    state: {
        async get(key) {
            return request('state.get', { key });
        },
        async set(key, value) {
            return request('state.set', { key, value });
        },
    },
    on(name, fn) {
        if (!eventListeners.has(name)) eventListeners.set(name, []);
        eventListeners.get(name).push(fn);
        return () => {
            const arr = eventListeners.get(name);
            if (arr) {
                const idx = arr.indexOf(fn);
                if (idx >= 0) arr.splice(idx, 1);
            }
        };
    },
    resize(height) {
        window.parent.postMessage({ type: 'nest-resize', height }, '*');
    },
};
