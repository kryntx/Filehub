/** Upload modal (file + URL). */

import { initModal } from './base.js';
import State from '../../state.js';
import { formatSize, escapeHtml } from '../../utils.js';
import { uploadFromUrl, fetchFiles } from '../../api.js';
import * as toast from '../toast.js';
import * as fileGrid from '../fileGrid.js';

const modal = initModal('uploadModal', {
    onClose() {
        abortAll();
        document.getElementById('uploadZone').style.display = 'block';
        document.getElementById('uploadProgress').style.display = 'none';
        document.getElementById('uploadError').style.display = 'none';
        document.getElementById('fileInput').value = '';
    },
});

const zone = document.getElementById('uploadZone');
const progress = document.getElementById('uploadProgress');
const fill = document.getElementById('progressFill');
const text = document.getElementById('progressText');
const fileInput = document.getElementById('fileInput');
const uploadError = document.getElementById('uploadError');
const fileList = document.getElementById('uploadFileList');

const urlInput = document.getElementById('urlInput');
const urlBtn = document.getElementById('urlDownloadBtn');
const urlProgress = document.getElementById('urlProgress');
const urlProgressText = document.getElementById('urlProgressText');
const urlError = document.getElementById('urlError');

/* ---- Upload state ---- */

let uploadItems = [];

function formatEta(seconds) {
    if (seconds < 60) return seconds + '秒';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return s > 0 ? m + '分' + s + '秒' : m + '分钟';
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r > 0 ? h + '小时' + r + '分' : h + '小时';
}

function formatSpeed(bps) {
    if (bps >= 1024 * 1024) return (bps / (1024 * 1024)).toFixed(1) + ' MB/s';
    if (bps >= 1024) return Math.round(bps / 1024) + ' KB/s';
    return Math.round(bps) + ' B/s';
}

export function open() {
    modal.open();
    zone.style.display = 'block';
    progress.style.display = 'none';
    uploadError.style.display = 'none';
    fileInput.value = '';
}

/* ---- File upload ---- */

fileInput.addEventListener('change', () => {
    if (fileInput.files.length) doUpload(fileInput.files);
});

zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files.length) doUpload(e.dataTransfer.files);
});

/* ---- Event delegation ---- */

fileList.addEventListener('click', e => {
    const row = e.target.closest('.upload-file-item');
    if (!row) return;
    const index = parseInt(row.dataset.index);
    if (isNaN(index)) return;

    // Delete button
    if (e.target.closest('.upload-del-btn')) {
        removeUpload(index);
        return;
    }

    // Pause / resume
    const btn = e.target.closest('.upload-pause-btn, .upload-resume-btn');
    if (!btn) return;
    if (btn.classList.contains('upload-pause-btn')) pauseUpload(index);
    else resumeUpload(index);
});

/* ---- Core ---- */

function doUpload(files) {
    zone.style.display = 'none';
    progress.style.display = 'block';
    uploadError.style.display = 'none';

    uploadItems = Array.from(files).map(file => ({
        file,
        xhr: null,
        status: 'pending',
        progress: 0,
        error: null,
        speed: 0,
        eta: 0,
        lastLoaded: 0,
        lastTime: 0,
        offset: 0,
        totalSize: file.size,
    }));

    renderFileList();
    updateOverall();
    uploadItems.forEach((_, i) => startUpload(i));
}

function renderFileList() {
    fileList.innerHTML = uploadItems.map((item, i) => `
        <div class="upload-file-item" data-index="${i}">
            <div class="upload-file-info">
                <span class="upload-file-name" title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</span>
                <span class="upload-file-size">${formatSize(item.file.size)}</span>
                <button class="upload-del-btn" title="删除上传任务">&times;</button>
            </div>
            <div class="upload-file-bottom">
                <div class="upload-file-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width:${item.progress}%"></div>
                    </div>
                </div>
                <span class="upload-file-status ${statusClass(item.status)}">${getStatusText(item)}</span>
            </div>
        </div>
    `).join('');

    // Re-attach pause/resume buttons
    uploadItems.forEach((item, i) => {
        const row = fileList.children[i];
        if (!row) return;
        const bottom = row.querySelector('.upload-file-bottom');
        if (item.status === 'uploading') {
            const btn = document.createElement('button');
            btn.className = 'btn btn-secondary btn-sm upload-pause-btn';
            btn.textContent = '暂停';
            bottom.appendChild(btn);
        }
    });
}

function getStatusText(item) {
    switch (item.status) {
        case 'pending': return '等待中';
        case 'uploading': {
            let s = item.progress + '%';
            if (item.speed > 0) s += ' · ' + formatSpeed(item.speed);
            if (item.eta > 0 && item.progress > 0 && item.progress < 99) {
                s += ' · 剩余' + formatEta(Math.round(item.eta));
            }
            return s;
        }
        case 'paused': return '已暂停';
        case 'completed': return '完成';
        case 'error': return item.error || '失败';
        default: return '';
    }
}

function statusClass(status) {
    return status === 'completed' ? 'completed' : status === 'error' ? 'error' : status === 'paused' ? 'paused' : '';
}

function updateItem(index) {
    const item = uploadItems[index];
    const row = fileList.querySelector(`[data-index="${index}"]`);
    if (!row) return;

    row.querySelector('.progress-fill').style.width = item.progress + '%';

    const st = row.querySelector('.upload-file-status');
    st.textContent = getStatusText(item);
    st.className = 'upload-file-status ' + statusClass(item.status);

    const bottom = row.querySelector('.upload-file-bottom');
    let btn = bottom.querySelector('.upload-pause-btn, .upload-resume-btn');
    if (item.status === 'uploading') {
        if (!btn || !btn.classList.contains('upload-pause-btn')) {
            if (btn) btn.remove();
            btn = document.createElement('button');
            btn.className = 'btn btn-secondary btn-sm upload-pause-btn';
            btn.textContent = '暂停';
            bottom.appendChild(btn);
        }
    } else if (item.status === 'paused') {
        if (!btn || !btn.classList.contains('upload-resume-btn')) {
            if (btn) btn.remove();
            btn = document.createElement('button');
            btn.className = 'btn btn-primary btn-sm upload-resume-btn';
            btn.textContent = '继续';
            bottom.appendChild(btn);
        }
    } else {
        if (btn) btn.remove();
    }
}

function updateOverall() {
    const active = uploadItems.filter(Boolean);
    const total = active.length;
    const done = active.filter(i => i.status === 'completed' || i.status === 'error').length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    fill.style.width = pct + '%';
    const ok = active.filter(i => i.status === 'completed').length;
    text.textContent = `上传中 ${ok}/${total}`;
}

function startUpload(index) {
    const item = uploadItems[index];
    if (!item || item.status === 'completed' || item.status === 'uploading') return;

    item.status = 'uploading';
    item.progress = item.offset > 0 ? Math.min(99, Math.round((item.offset / item.totalSize) * 100)) : 0;
    item.error = null;
    item.speed = 0;
    item.lastLoaded = 0;
    item.lastTime = performance.now();

    const xhr = new XMLHttpRequest();
    item.xhr = xhr;
    xhr.timeout = 3600000; // 1 hour timeout — large files on slow networks need it

    // Build query params: path, filename, offset (reliable — avoids custom-header issues)
    const params = new URLSearchParams();
    if (State.currentPath) params.set('path', State.currentPath);
    params.set('filename', item.file.name);
    if (item.offset > 0) params.set('offset', String(item.offset));

    xhr.open('POST', '/api/upload?' + params.toString());
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader('X-Upload-Filename', encodeURIComponent(item.file.name));
    if (State.password) xhr.setRequestHeader('x-upload-password', State.password);

    if (item.offset > 0) {
        xhr.setRequestHeader('X-Upload-Offset', String(item.offset));
    }

    xhr.upload.onprogress = e => {
        if (!e.lengthComputable) return;
        const totalLoaded = item.offset + e.loaded;
        item.progress = Math.min(99, Math.round((totalLoaded / item.totalSize) * 100));

        const now = performance.now();
        const deltaBytes = e.loaded - item.lastLoaded;
        const deltaTime = now - item.lastTime;
        if (deltaTime > 300 && deltaBytes > 0) {
            const instant = deltaBytes / (deltaTime / 1000);
            item.speed = item.speed ? item.speed * 0.6 + instant * 0.4 : instant;
            item.lastLoaded = e.loaded;
            item.lastTime = now;
            const remain = item.totalSize - totalLoaded;
            item.eta = item.speed > 0 ? remain / item.speed : 0;
        }

        updateItem(index);
    };

    function handleError(errMsg) {
        item.xhr = null;
        item.status = 'error';
        item.error = errMsg || '上传失败';
        updateItem(index);
        updateOverall();
        checkAllDone();
    }

    xhr.onload = () => {
        item.xhr = null;
        if (xhr.status === 200) {
            item.status = 'completed';
            item.progress = 100;
            updateItem(index);
            updateOverall();
            checkAllDone();
        } else {
            let errMsg = '';
            try { const d = JSON.parse(xhr.responseText); errMsg = d.error || ''; } catch {}
            // Wrong password — clear so next action re-prompts
            if (xhr.status === 403) {
                State.password = '';
                document.cookie = 'uploadPassword=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax';
            }
            handleError(errMsg);
        }
    };

    xhr.onerror = () => handleError('网络错误');

    xhr.ontimeout = () => handleError('上传超时');

    // Send the payload
    try {
        if (item.offset > 0) {
            xhr.send(item.file.slice(item.offset));
        } else {
            xhr.send(item.file);
        }
    } catch (e) {
        handleError('发送失败');
        return;
    }

    updateItem(index);
    updateOverall();
}

function pauseUpload(index) {
    const item = uploadItems[index];
    if (!item || item.status !== 'uploading') return;
    item.offset += item.lastLoaded;
    item.status = 'paused';
    item.xhr.abort();
    item.xhr = null;
    updateItem(index);
    updateOverall();
}

function resumeUpload(index) {
    startUpload(index);
}

function removeUpload(index) {
    const item = uploadItems[index];
    if (!item) return;
    if (item.xhr) { item.xhr.abort(); item.xhr = null; }

    delete uploadItems[index];
    const row = fileList.querySelector(`[data-index="${index}"]`);
    if (row) row.remove();

    const remaining = uploadItems.filter(Boolean);
    if (remaining.length === 0) {
        zone.style.display = 'block';
        progress.style.display = 'none';
        uploadError.style.display = 'none';
        uploadItems = [];
        return;
    }
    updateOverall();
}

function abortAll() {
    uploadItems.forEach(item => {
        if (item.xhr) { item.xhr.abort(); item.xhr = null; }
    });
    uploadItems = [];
}

function checkAllDone() {
    const active = uploadItems.filter(Boolean);
    const allDone = active.every(i =>
        i.status === 'completed' || i.status === 'error'
    );
    if (!allDone) return;

    const successCount = active.filter(i => i.status === 'completed').length;
    const total = active.length;

    if (successCount > 0) {
        toast.show(`上传完成（成功 ${successCount}/${total}）`, successCount === total ? 'success' : 'warning');
        setTimeout(() => {
            modal.close();
            fileGrid.refresh();
        }, 1200);
    }

    const errors = active.filter(i => i.status === 'error').map(i => `${i.file.name}: ${i.error}`);
    if (errors.length > 0) {
        uploadError.textContent = errors.join('；');
        uploadError.style.display = 'block';
    }
}

/* ---- URL download ---- */

urlBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) { urlError.textContent = '请输入下载链接'; urlError.style.display = 'block'; return; }
    urlError.style.display = 'none';
    urlBtn.disabled = true;
    urlBtn.textContent = '下载中...';
    urlProgress.style.display = 'block';

    try {
        await uploadFromUrl(url, State.currentPath);
        toast.show('下载成功', 'success');
        urlInput.value = '';
        modal.close();
        await fileGrid.refresh();
    } catch (e) {
        urlError.textContent = e.message;
        urlError.style.display = 'block';
    } finally {
        urlBtn.disabled = false;
        urlBtn.textContent = '下载';
        urlProgress.style.display = 'none';
    }
});

urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') urlBtn.click(); });
