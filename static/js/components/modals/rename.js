/** Rename modal. */

import { initModal } from './base.js';
import State from '../../state.js';
import * as api from '../../api.js';
import * as toast from '../toast.js';
import * as fileGrid from '../fileGrid.js?v=8';
import { prompt } from './password.js';

const modal = initModal('renameModal');
const input = document.getElementById('renameInput');
const errorEl = document.getElementById('renameError');

let renameContext = null; // { path, name }

input.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('renameModalConfirm').click(); });

export async function open(name, skipPwd = false) {
    renameContext = { path: State.currentPath, name };
    if (!skipPwd && !State.password) {
        await prompt('重命名验证', '请输入上传密码以重命名', { type: 'rename', path: State.currentPath, name });
    }
    input.value = name;
    errorEl.style.display = 'none';
    modal.open();
    setTimeout(() => { input.focus(); }, 100);
}

document.getElementById('renameModalConfirm').addEventListener('click', async () => {
    const newName = input.value.trim();
    if (!newName) { errorEl.textContent = '请输入新名称'; errorEl.style.display = 'block'; return; }
    if (!renameContext) return;
    errorEl.style.display = 'none';
    try {
        await api.renameItem(renameContext.path, renameContext.name, newName);
        modal.close();
        toast.show('重命名成功', 'success');
        await fileGrid.refresh();
    } catch (e) {
        errorEl.textContent = e.message;
        errorEl.style.display = 'block';
    }
});
