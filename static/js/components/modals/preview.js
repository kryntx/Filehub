/** Preview modal for text and image files. */

import { initModal } from './base.js';
import State from '../../state.js';
import * as api from '../../api.js';
import * as toast from '../toast.js';
import { escapeHtml, enc } from '../../utils.js';
import { prompt } from './password.js';

const modal = initModal('previewModal', {
    onClose() {
        // Stop any playing media
        contentEl.querySelectorAll('video, audio').forEach(el => {
            el.pause();
            el.currentTime = 0;
            el.removeAttribute('src');
            el.load();
        });
    },
});
const contentEl = document.getElementById('previewContent');
const textareaEl = document.getElementById('previewTextarea');
const titleEl = document.getElementById('previewTitle');
const truncatedEl = document.getElementById('previewTruncated');
const errorEl = document.getElementById('previewError');
const downloadBtn = document.getElementById('previewDownloadBtn');
const editBtn = document.getElementById('previewEditBtn');
const saveBtn = document.getElementById('previewSaveBtn');
const wrapToggle = document.getElementById('wrapToggle');

let currentFilename = '';
let isEditing = false;

function buildPath(filename) {
    const cp = State.currentPath;
    return cp ? cp + '/' + filename : filename;
}

function applyWrap() {
    const on = State.wrapEnabled;
    contentEl.classList.toggle('preview-nowrap', !on);
    textareaEl.classList.toggle('preview-nowrap', !on);
    textareaEl.wrap = on ? 'soft' : 'off';
    wrapToggle.classList.toggle('active', on);
    wrapToggle.textContent = on ? '⤻' : '↔';
}

wrapToggle.addEventListener('click', () => {
    State.wrapEnabled = !State.wrapEnabled;
    applyWrap();
});

export async function open(filename) {
    currentFilename = filename;
    isEditing = false;
    titleEl.textContent = filename;

    contentEl.textContent = '加载中...';
    contentEl.style.display = 'block';
    textareaEl.style.display = 'none';
    editBtn.style.display = 'none';
    saveBtn.style.display = 'none';
    errorEl.style.display = 'none';
    truncatedEl.style.display = 'none';

    const q = buildPath(filename);
    downloadBtn.href = api.downloadUrl(q);
    modal.open();

    const ext = filename.includes('.') ? '.' + filename.split('.').pop().toLowerCase() : '';

    // Image preview
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'].includes(ext)) {
        contentEl.className = 'preview-content preview-image';
        contentEl.innerHTML = '<img src="' + api.downloadUrl(q) + '" alt="' + escapeHtml(filename) + '">';
        return;
    }

    // Video preview
    if (['.mp4', '.webm', '.ogg', '.mov', '.mkv', '.avi'].includes(ext)) {
        contentEl.className = 'preview-content preview-video';
        contentEl.innerHTML = '<video controls autoplay src="' + api.downloadUrl(q) + '"></video>';
        return;
    }

    // Audio preview
    if (['.mp3', '.wav', '.flac', '.aac', '.ogg'].includes(ext)) {
        contentEl.className = 'preview-content preview-audio';
        contentEl.innerHTML = '<audio controls src="' + api.downloadUrl(q) + '"></audio>';
        return;
    }

    // Text preview — 默认进入编辑模式
    contentEl.className = 'preview-content';
    try {
        const data = await api.fetchPreview(buildPath(filename));
        contentEl.textContent = data.content;
        textareaEl.value = data.content;
        contentEl.style.display = 'none';
        textareaEl.style.display = 'block';
        editBtn.style.display = 'none';
        saveBtn.style.display = 'inline-flex';
        isEditing = true;
        if (data.truncated) truncatedEl.style.display = 'block';
        applyWrap();
    } catch (e) {
        errorEl.textContent = e.message;
        errorEl.style.display = 'block';
        contentEl.textContent = '';
    }
}

/* ---- Edit / Save ---- */

editBtn.addEventListener('click', () => {
    isEditing = true;
    contentEl.style.display = 'none';
    textareaEl.style.display = 'block';
    editBtn.style.display = 'none';
    saveBtn.style.display = 'inline-flex';
});

saveBtn.addEventListener('click', async () => {
    if (!State.password) {
        await prompt('保存验证', '请输入上传密码以保存修改', { type: 'save' });
    }
    try {
        await api.saveFile(State.currentPath, currentFilename, textareaEl.value);
        toast.show('保存成功', 'success');
        isEditing = false;
        contentEl.textContent = textareaEl.value;
        textareaEl.style.display = 'none';
        contentEl.style.display = 'block';
        editBtn.style.display = 'inline-flex';
        saveBtn.style.display = 'none';
    } catch (e) {
        toast.show(e.message || '保存失败', 'error');
    }
});
