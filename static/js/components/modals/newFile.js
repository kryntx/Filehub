/** New file modal. */

import { initModal } from './base.js';
import State from '../../state.js';
import * as api from '../../api.js';
import * as toast from '../toast.js';
import * as fileGrid from '../fileGrid.js';
import { prompt } from './password.js';

const modal = initModal('newFileModal');
const input = document.getElementById('newFileNameInput');
const errorEl = document.getElementById('newFileError');

input.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('newFileModalConfirm').click(); });

export async function open(skipPwd = false) {
    if (!skipPwd && !State.password) {
        await prompt('新建文件验证', '请输入上传密码以创建文件', { type: 'newfile' });
    }
    input.value = '';
    errorEl.style.display = 'none';
    modal.open();
    setTimeout(() => input.focus(), 100);
}

document.getElementById('newFileModalConfirm').addEventListener('click', async () => {
    const name = input.value.trim();
    if (!name) { errorEl.textContent = '请输入文件名'; errorEl.style.display = 'block'; return; }
    errorEl.style.display = 'none';
    try {
        await api.createFile(State.currentPath, name);
        modal.close();
        toast.show('文件已创建', 'success');
        await fileGrid.refresh();
    } catch (e) {
        errorEl.textContent = e.message;
        errorEl.style.display = 'block';
    }
});
