/** Theme management component. */

import State from '../state.js';

const toggle = document.getElementById('themeToggle');

function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    toggle.textContent = t === 'dark' ? '🌙' : '☀️';
}

export function init() {
    applyTheme(State.theme);

    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
        if (!localStorage.getItem('theme')) {
            applyTheme(e.matches ? 'light' : 'dark');
        }
    });

    toggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        State.theme = next;
        applyTheme(next);
    });

    State.on('theme', applyTheme);
}
