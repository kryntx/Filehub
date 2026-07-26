/** File grid component — handles both grid and list view rendering. */

import State from '../state.js';
import * as api from '../api.js';
import * as breadcrumb from './breadcrumb.js';
import { escapeHtml, formatSize, formatTime, getIcon, isTextFile, enc, dec } from '../utils.js';
import * as uploadModal from './modals/upload.js';
import * as renameModal from './modals/rename.js';
import { prompt } from './modals/password.js';
import * as previewModal from './modals/preview.js';
import * as toast from './toast.js';

const gridEl = document.getElementById('fileGrid');
const countEl = document.getElementById('fileCount');
const emptyEl = document.getElementById('emptyState');
const loadingEl = document.getElementById('loading');
const viewToggle = document.getElementById('viewToggle');

let cachedFiles = [];

export async function refresh() {
    try {
        const data = await api.fetchFiles(State.currentPath);
        cachedFiles = data.files;
        breadcrumb.render(data.path || '');
        render(data.files);
    } catch (e) {
        toast.show('加载失败', 'error');
    }
}

function render(files) {
    loadingEl.style.display = 'none';

    if (!files || files.length === 0) {
        gridEl.innerHTML = '';
        emptyEl.style.display = 'block';
        countEl.textContent = '共 0 项';
        return;
    }

    emptyEl.style.display = 'none';
    countEl.textContent = `共 ${files.length} 项`;

    if (State.viewMode === 'list') {
        gridEl.className = 'file-grid list-view';
        renderList(files);
    } else {
        gridEl.className = 'file-grid';
        renderGrid(files);
    }
}

/* ---- Icon / Grid view ---- */

function renderGrid(files) {
    gridEl.innerHTML = files.map(f => {
        const icon = getIcon(f.ext, f.type);
        const isDir = f.type === 'dir';
        const name = escapeHtml(f.name);
        const en = enc(f.name);
        const size = isDir ? '' : formatSize(f.size);
        const time = formatTime(f.mtime);
        const cp = State.currentPath;

        const actions = isDir
            ? `<a href="${api.downloadZipUrl(cp ? cp + '/' + en : en)}" class="btn btn-primary btn-sm btn-download" download>下载</a>
               <button class="btn btn-danger btn-sm" data-act="deleteDir" data-name="${en}">删除</button>
               <button class="btn btn-secondary btn-sm" data-act="rename" data-name="${en}">重命名</button>`
            : `<a href="${api.downloadUrl(cp ? cp + '/' + en : en)}" class="btn btn-primary btn-sm btn-download" download>下载</a>
               <button class="btn btn-secondary btn-sm" data-preview="${en}">预览</button>
               <button class="btn btn-danger btn-sm" data-act="deleteFile" data-name="${en}">删除</button>
               <button class="btn btn-secondary btn-sm" data-act="rename" data-name="${en}">重命名</button>`;

        return `<div class="file-card ${isDir ? 'card-dir' : ''}">
            <div class="card-body" ${isDir ? 'data-dir="' + en + '"' : ''}>
                <div class="file-icon">${icon}</div>
                <div class="file-name" title="${name}">${name}</div>
                ${size ? '<div class="file-size">' + size + '</div>' : ''}
                <div class="file-time">${time}</div>
            </div>
            <div class="file-actions">${actions}</div>
        </div>`;
    }).join('');

    // Dir click handler
    gridEl.querySelectorAll('.card-body[data-dir]').forEach(el => {
        el.addEventListener('click', e => {
            if (e.target.closest('.file-actions, .btn')) return;
            const cp = State.currentPath;
            State.currentPath = cp ? cp + '/' + dec(el.dataset.dir) : dec(el.dataset.dir);
        });
    });
}

/* ---- List / Table view ---- */

function renderList(files) {
    let html = '<table class="list-table"><thead><tr>' +
        '<th class="col-icon"></th><th class="col-name">名称</th><th class="col-size">大小</th><th class="col-time">时间</th><th class="col-actions">操作</th>' +
        '</tr></thead><tbody>';

    for (const f of files) {
        const icon = getIcon(f.ext, f.type);
        const isDir = f.type === 'dir';
        const name = escapeHtml(f.name);
        const en = enc(f.name);
        const size = isDir ? '-' : formatSize(f.size);
        const time = formatTime(f.mtime);
        const cp = State.currentPath;

        let ddItems = isDir
            ? `<a href="${api.downloadZipUrl(cp ? cp + '/' + en : en)}" class="dropdown-item" download>下载</a>
               <button class="dropdown-item dropdown-danger" data-act="deleteDir" data-name="${en}">删除</button>
               <button class="dropdown-item" data-act="rename" data-name="${en}">重命名</button>`
            : `<a href="${api.downloadUrl(cp ? cp + '/' + en : en)}" class="dropdown-item" download>下载</a>
               <button class="dropdown-item" data-preview="${en}">预览</button>
               <button class="dropdown-item dropdown-danger" data-act="deleteFile" data-name="${en}">删除</button>
               <button class="dropdown-item" data-act="rename" data-name="${en}">重命名</button>`;

        html += `<tr>
            <td class="col-icon">${icon}</td>
            <td class="col-name"><span class="list-name" data-dir="${isDir ? en : ''}"><span class="scroll-inner">${name}</span></span></td>
            <td class="col-size">${size}</td>
            <td class="col-time"><span class="scroll-inner">${time}</span></td>
            <td class="col-actions">
                <div class="dropdown-container">
                    <button class="btn-icon btn-icon-sm" data-toggle-dropdown>⋮</button>
                    <div class="dropdown-menu">${ddItems}</div>
                </div>
            </td>
        </tr>`;
    }
    html += '</tbody></table>';
    gridEl.innerHTML = html;

    // Dir click in list view
    gridEl.querySelectorAll('.list-name[data-dir]').forEach(el => {
        el.addEventListener('click', () => {
            const cp = State.currentPath;
            State.currentPath = cp ? cp + '/' + dec(el.dataset.dir) : dec(el.dataset.dir);
        });
    });

    // Auto-scroll for overflow text
    gridEl.querySelectorAll('.col-name, .col-time').forEach(cell => {
        const inner = cell.querySelector('.scroll-inner');
        if (!inner) return;
        cell.addEventListener('mouseenter', () => {
            if (inner.scrollWidth <= cell.clientWidth) return;
            clearTimeout(cell._sTimer);
            cell._sTimer = setTimeout(() => {
                cell.scrollTo({ left: inner.scrollWidth - cell.clientWidth + 4, behavior: 'smooth' });
            }, 1200);
        });
        cell.addEventListener('mouseleave', () => {
            clearTimeout(cell._sTimer);
            cell.scrollTo({ left: 0, behavior: 'smooth' });
        });
    });
}

/* ---- Event delegation for grid actions ---- */

gridEl.addEventListener('click', async e => {
    // Dropdown toggle
    const toggle = e.target.closest('[data-toggle-dropdown]');
    if (toggle) {
        e.stopPropagation();
        const container = toggle.closest('.dropdown-container');
        const menu = container.querySelector('.dropdown-menu');
        document.querySelectorAll('.dropdown-menu.show').forEach(m => {
            if (m !== menu) m.classList.remove('show');
        });
        menu.classList.toggle('show');
        return;
    }

    // Preview button
    const previewBtn = e.target.closest('[data-preview]');
    if (previewBtn) {
        closeAllDropdowns();
        previewModal.open(dec(previewBtn.dataset.preview));
        return;
    }

    // Action buttons (delete, rename)
    const act = e.target.closest('[data-act]');
    if (!act) { closeAllDropdowns(); return; }

    const name = dec(act.dataset.name);
    const type = act.dataset.act;

    if (type === 'deleteFile' || type === 'deleteDir') {
        closeAllDropdowns();
        const isDir = type === 'deleteDir';
        if (!State.password) {
            await prompt('删除验证', isDir ? '删除文件夹及其所有内容？' : '删除此文件？', { type: 'delete', name, isDir });
        }
        try {
            await api.deleteItem(State.currentPath, name);
            toast.show('已删除', 'success');
            await refresh();
        } catch (e) {
            toast.show(e.message, 'error');
        }
    } else if (type === 'rename') {
        closeAllDropdowns();
        await renameModal.open(name);
    }
});

document.addEventListener('click', closeAllDropdowns);

function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu.show').forEach(m => m.classList.remove('show'));
}

/* ---- View toggle ---- */

viewToggle.addEventListener('click', () => {
    const next = State.viewMode === 'list' ? 'grid' : 'list';
    State.viewMode = next;
    viewToggle.textContent = next === 'list' ? '⊞' : '☰';
    render(cachedFiles);
});
