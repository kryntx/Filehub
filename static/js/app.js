/** FileHub — application entry point. */

import State from './state.js';
import { getCookie, formatSize } from './utils.js';
import { init as initTheme } from './components/theme.js';
import * as fileGrid from './components/fileGrid.js?v=8';
import * as uploadModal from './components/modals/upload.js';
import * as folderModal from './components/modals/folder.js';
import * as newFileModal from './components/modals/newFile.js';
import { prompt } from './components/modals/password.js';
import { fetchStorageStats } from './api.js';
import * as realtime from './realtime.js';

/* ---- Init theme ---- */
initTheme();

/* ---- Realtime presence indicator ---- */
realtime.onStatus(({ connected, online }) => {
    const indicator = document.getElementById('onlineIndicator');
    const count = document.getElementById('onlineCount');
    count.textContent = String(online);
    indicator.classList.toggle('offline', !connected);
    indicator.classList.toggle('reconnecting', !connected);
    indicator.title = connected ? (online + ' 人在线') : '连接断开，自动重连中…';
});

/* ---- Restore password from cookie ---- */
const savedPwd = getCookie('uploadPassword');
if (savedPwd) State.password = savedPwd;

/* ---- View toggle initial state ---- */
const viewToggle = document.getElementById('viewToggle');
viewToggle.textContent = State.viewMode === 'list' ? '⊞' : '☰';

/* ---- Upload button ---- */
document.getElementById('uploadBtn').addEventListener('click', async () => {
    if (!State.password) {
        await prompt('上传文件验证', '请输入上传密码以继续', { type: 'upload' });
    }
    uploadModal.open();
});

/* ---- New folder button ---- */
document.getElementById('newFolderBtn').addEventListener('click', () => folderModal.open());

/* ---- New file button ---- */
document.getElementById('newFileBtn').addEventListener('click', () => newFileModal.open());

/* ---- Listen for path changes to refresh ---- */
State.on('currentPath', () => fileGrid.refresh());

/* ---- Initial load ---- */
fileGrid.refresh();

/* ---- Storage indicator ---- */
(async () => {
    try {
        const { used, total, percent } = await fetchStorageStats();
        document.getElementById('storageFill').style.width = Math.min(percent, 100) + '%';
        document.getElementById('storageText').textContent = formatSize(used) + ' / ' + formatSize(total);
    } catch {
        document.getElementById('storageText').textContent = '-- / --';
    }
})();
