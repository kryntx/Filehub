/** Upload modal (file + URL). */

import { initModal } from './base.js';
import State from '../../state.js';
import { formatSize } from '../../utils.js';
import { uploadFile, uploadFromUrl, fetchFiles } from '../../api.js';
import * as toast from '../toast.js';
import * as fileGrid from '../fileGrid.js';

const modal = initModal('uploadModal', {
    onClose() {
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

const urlInput = document.getElementById('urlInput');
const urlBtn = document.getElementById('urlDownloadBtn');
const urlProgress = document.getElementById('urlProgress');
const urlProgressText = document.getElementById('urlProgressText');
const urlError = document.getElementById('urlError');

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

function doUpload(files) {
    zone.style.display = 'none';
    progress.style.display = 'block';
    uploadError.style.display = 'none';

    const fd = new FormData();
    fd.append('file', files[0]);
    fd.append('path', State.currentPath);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    xhr.setRequestHeader('x-upload-password', State.password);

    xhr.upload.onprogress = e => {
        if (e.lengthComputable) {
            const p = Math.round((e.loaded / e.total) * 100);
            fill.style.width = p + '%';
            text.textContent = `上传中 ${p}% (${formatSize(e.loaded)} / ${formatSize(e.total)})`;
        }
    };

    xhr.onload = async () => {
        if (xhr.status === 200) {
            toast.show('上传成功', 'success');
            modal.close();
            await fileGrid.refresh();
        } else {
            try {
                const d = JSON.parse(xhr.responseText);
                uploadError.textContent = d.error || '上传失败';
            } catch { uploadError.textContent = '上传失败'; }
            uploadError.style.display = 'block';
            zone.style.display = 'block';
            progress.style.display = 'none';
        }
    };

    xhr.onerror = () => {
        uploadError.textContent = '网络错误';
        uploadError.style.display = 'block';
        zone.style.display = 'block';
        progress.style.display = 'none';
    };

    xhr.send(fd);
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
