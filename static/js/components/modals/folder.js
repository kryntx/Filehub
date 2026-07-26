/** New folder modal. */

import { initModal } from './base.js';
import State from '../../state.js';
import * as api from '../../api.js';
import * as toast from '../toast.js';
import * as fileGrid from '../fileGrid.js';
import { prompt } from './password.js';

const modal = initModal('folderModal');
const input = document.getElementById('folderNameInput');
const errorEl = document.getElementById('folderError');

input.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('folderModalConfirm').click(); });

export async function open(skipPwd = false) {
    if (!skipPwd && !State.password) {
        await prompt('新建文件夹验证', '请输入上传密码以创建文件夹', { type: 'mkdir' });
    }
    input.value = '';
    errorEl.style.display = 'none';
    modal.open();
    setTimeout(() => input.focus(), 100);
}

document.getElementById('folderModalConfirm').addEventListener('click', async () => {
    const name = input.value.trim();
    if (!name) { errorEl.textContent = '请输入文件夹名称'; errorEl.style.display = 'block'; return; }
    errorEl.style.display = 'none';
    try {
        await api.createFolder(State.currentPath, name);
        modal.close();
        toast.show('文件夹已创建', 'success');
        await fileGrid.refresh();
    } catch (e) {
        errorEl.textContent = e.message;
        errorEl.style.display = 'block';
    }
});
