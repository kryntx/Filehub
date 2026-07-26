/** Breadcrumb navigation component. */

import State from '../state.js';
import { escapeHtml, enc, dec } from '../utils.js';

const el = document.getElementById('breadcrumb');

export function render(path) {
    const parts = path ? path.split('/') : [];
    let html = '<a class="root-link" data-path="">Root</a>';
    let accumulated = '';
    for (const p of parts) {
        if (!p) continue;
        accumulated = accumulated ? accumulated + '/' + p : p;
        html += '<span class="sep">›</span><a data-path="' + enc(accumulated) + '">' + escapeHtml(p) + '</a>';
    }
    el.innerHTML = html;

    el.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
            State.currentPath = dec(a.dataset.path);
        });
    });
}
