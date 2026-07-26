/** Password verification modal. */

import { initModal } from './base.js';
import State from '../../state.js';
import { setEndOfDayCookie } from '../../utils.js';

let resolvePromise = null;
let activeAction = null;

const modal = initModal('passwordModal');

document.getElementById('passwordInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('passwordModalConfirm').click();
});

document.getElementById('passwordModalConfirm').addEventListener('click', () => {
    const pwd = document.getElementById('passwordInput').value.trim();
    const errEl = document.getElementById('passwordError');
    if (!pwd) {
        errEl.textContent = '请输入密码';
        errEl.style.display = 'block';
        return;
    }
    setEndOfDayCookie('uploadPassword', pwd);
    State.password = pwd;
    modal.close();
    if (resolvePromise) resolvePromise(pwd);
});

/**
 * Show password prompt. Returns a Promise that resolves with the password.
 * @param {string} title
 * @param {string} desc
 * @param {object} [action] - stored for later use (e.g. delete/rename context)
 */
export function prompt(title, desc, action = null) {
    document.getElementById('passwordModalTitle').textContent = title;
    document.getElementById('passwordModalDesc').textContent = desc;
    document.getElementById('passwordInput').value = '';
    document.getElementById('passwordError').style.display = 'none';
    activeAction = action;
    modal.open();
    setTimeout(() => document.getElementById('passwordInput').focus(), 100);

    return new Promise(resolve => {
        resolvePromise = resolve;
    });
}

export function getActiveAction() {
    return activeAction;
}

export function reset() {
    resolvePromise = null;
    activeAction = null;
}
