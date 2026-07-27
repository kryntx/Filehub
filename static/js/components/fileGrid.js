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
let _dragIdx = -1;

/** Save current file order to server. */
function saveOrder() {
    const order = cachedFiles.map(f => f.name);
    api.saveOrder(State.currentPath, order).catch(() => {});
}

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
    gridEl.innerHTML = files.map((f, i) => {
        const icon = getIcon(f.ext, f.type);
        const isDir = f.type === 'dir';
        const name = escapeHtml(f.name);
        const en = enc(f.name);
        const size = isDir ? '' : formatSize(f.size);
        const time = formatTime(f.mtime);
        const cp = State.currentPath;

        const actions = isDir
            ? `<a href="${api.downloadZipUrl(cp ? cp + '/' + f.name : f.name)}" class="btn btn-primary btn-sm btn-download" download>下载</a>
               <button class="btn btn-danger btn-sm" data-act="deleteDir" data-name="${en}">删除</button>
               <button class="btn btn-secondary btn-sm" data-act="rename" data-name="${en}">重命名</button>`
            : `<a href="${api.downloadUrl(cp ? cp + '/' + f.name : f.name)}" class="btn btn-primary btn-sm btn-download" download>下载</a>
               <button class="btn btn-secondary btn-sm" data-preview="${en}">预览</button>
               <button class="btn btn-danger btn-sm" data-act="deleteFile" data-name="${en}">删除</button>
               <button class="btn btn-secondary btn-sm" data-act="rename" data-name="${en}">重命名</button>`;

        return `<div class="file-card ${isDir ? 'card-dir' : ''}" draggable="true" data-drag-index="${i}">
            <div class="card-body" ${isDir ? 'data-dir="' + en + '"' : 'data-file="' + en + '"'}>
                <div class="file-icon">${icon}</div>
                <div class="file-name" title="${name}">${name}</div>
                ${size ? '<div class="file-size">' + size + '</div>' : ''}
                <div class="file-time">${time}</div>
            </div>
            <div class="file-actions">${actions}</div>
        </div>`;
    }).join('');

}

/* ---- List / Table view ---- */

function renderList(files) {
    let html = '<table class="list-table"><thead><tr>' +
        '<th class="col-icon"></th><th class="col-name">名称</th><th class="col-size">大小</th><th class="col-time">时间</th><th class="col-actions">操作</th>' +
        '</tr></thead><tbody>';

    for (const [i, f] of files.entries()) {
        const icon = getIcon(f.ext, f.type);
        const isDir = f.type === 'dir';
        const name = escapeHtml(f.name);
        const en = enc(f.name);
        const size = isDir ? '-' : formatSize(f.size);
        const time = formatTime(f.mtime);
        const cp = State.currentPath;

        let ddItems = isDir
            ? `<a href="${api.downloadZipUrl(cp ? cp + '/' + f.name : f.name)}" class="dropdown-item" download>下载</a>
               <button class="dropdown-item dropdown-danger" data-act="deleteDir" data-name="${en}">删除</button>
               <button class="dropdown-item" data-act="rename" data-name="${en}">重命名</button>`
            : `<a href="${api.downloadUrl(cp ? cp + '/' + f.name : f.name)}" class="dropdown-item" download>下载</a>
               <button class="dropdown-item" data-preview="${en}">预览</button>
               <button class="dropdown-item dropdown-danger" data-act="deleteFile" data-name="${en}">删除</button>
               <button class="dropdown-item" data-act="rename" data-name="${en}">重命名</button>`;

        html += `<tr draggable="true" data-drag-index="${i}">
            <td class="col-icon" ${!isDir ? 'data-file="' + en + '"' : ''}>${icon}</td>
            <td class="col-name"><span class="list-name" ${isDir ? 'data-dir="' + en + '"' : 'data-file="' + en + '"'}><span class="scroll-inner">${name}</span></span></td>
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

    // Directory click — navigate into folder
    const dirEl = e.target.closest('[data-dir]');
    if (dirEl) {
        if (e.target.closest('.file-actions, .btn, .dropdown-container')) return;
        closeAllDropdowns();
        const cp = State.currentPath;
        State.currentPath = cp ? cp + '/' + dec(dirEl.dataset.dir) : dec(dirEl.dataset.dir);
        return;
    }

    // File name/icon click — open preview
    const fileEl = e.target.closest('[data-file]');
    if (fileEl) {
        if (e.target.closest('.file-actions, .btn, .dropdown-container')) return;
        closeAllDropdowns();
        previewModal.open(dec(fileEl.dataset.file));
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

/* ---- Drag and drop sorting ---- */

function clearDrag() {
    _dragIdx = -1;
    gridEl.querySelectorAll('.dragging, .drag-over, .drag-over-before, .drag-over-after').forEach(el => {
        el.classList.remove('dragging', 'drag-over', 'drag-over-before', 'drag-over-after');
    });
}

function markDragTarget(el, clientY) {
    const rect = el.getBoundingClientRect();
    const isAfter = clientY > rect.top + rect.height / 2;
    el.classList.remove('drag-over-before', 'drag-over-after');
    el.classList.add('drag-over', isAfter ? 'drag-over-after' : 'drag-over-before');
}

gridEl.addEventListener('dragstart', e => {
    const el = e.target.closest('[data-drag-index]');
    if (!el) return;
    _dragIdx = parseInt(el.dataset.dragIndex);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    el.classList.add('dragging');
});

gridEl.addEventListener('dragenter', e => {
    e.preventDefault();
    const el = e.target.closest('[data-drag-index]');
    if (!el || _dragIdx < 0) return;
    const related = e.relatedTarget ? e.relatedTarget.closest('[data-drag-index]') : null;
    if (related === el) return;
    const overIdx = parseInt(el.dataset.dragIndex);
    if (overIdx === _dragIdx) return;
    markDragTarget(el, e.clientY);
});

gridEl.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const el = e.target.closest('[data-drag-index]');
    if (!el || _dragIdx < 0 || parseInt(el.dataset.dragIndex) === _dragIdx) return;
    markDragTarget(el, e.clientY);
});

gridEl.addEventListener('dragleave', e => {
    const el = e.target.closest('[data-drag-index]');
    if (!el || _dragIdx < 0) return;
    const related = e.relatedTarget ? e.relatedTarget.closest('[data-drag-index]') : null;
    if (related === el) return;
    el.classList.remove('drag-over', 'drag-over-before', 'drag-over-after');
});

gridEl.addEventListener('drop', e => {
    e.preventDefault();
    const el = e.target.closest('[data-drag-index]');
    if (!el || _dragIdx < 0) return;
    const toIdx = parseInt(el.dataset.dragIndex);
    if (toIdx !== _dragIdx) {
        const rect = el.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        let insertIdx = toIdx;
        if (e.clientY > midY) insertIdx = toIdx + 1;
        if (insertIdx > _dragIdx) insertIdx--;
        const [moved] = cachedFiles.splice(_dragIdx, 1);
        cachedFiles.splice(insertIdx, 0, moved);
        render(cachedFiles);
        saveOrder();
    }
    clearDrag();
});

gridEl.addEventListener('dragend', clearDrag);

/* ---- Touch long-press drag support ---- */

let _touchState = null;

gridEl.addEventListener('touchstart', e => {
    const el = e.target.closest('[data-drag-index]');
    if (!el || e.target.closest('.file-actions, .btn, .dropdown-container, thead, .dropdown-menu')) return;
    const touch = e.touches[0];
    _touchState = {
        idx: parseInt(el.dataset.dragIndex),
        el,
        startX: touch.clientX,
        startY: touch.clientY,
        timer: setTimeout(() => {
            el.classList.add('dragging');
            const clone = el.cloneNode(true);
            clone.classList.add('drag-clone');
            clone.style.cssText = 'position:fixed;pointer-events:none;opacity:0.7;z-index:9999;width:' + el.offsetWidth + 'px';
            clone.style.top = (touch.clientY - el.offsetHeight / 2) + 'px';
            clone.style.left = (touch.clientX - el.offsetWidth / 2) + 'px';
            document.body.appendChild(clone);
            _touchState.clone = clone;
            _touchState.active = true;
        }, 400)
    };
}, { passive: true });

gridEl.addEventListener('touchmove', e => {
    if (!_touchState || !_touchState.active) return;
    e.preventDefault();
    const touch = e.touches[0];
    _touchState.clone.style.left = (touch.clientX - _touchState.clone.offsetWidth / 2) + 'px';
    _touchState.clone.style.top = (touch.clientY - _touchState.clone.offsetHeight / 2) + 'px';
    gridEl.querySelectorAll('.drag-over, .drag-over-before, .drag-over-after').forEach(el => {
        el.classList.remove('drag-over', 'drag-over-before', 'drag-over-after');
    });
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const dragEl = target ? target.closest('[data-drag-index]') : null;
    if (dragEl && parseInt(dragEl.dataset.dragIndex) !== _touchState.idx) {
        markDragTarget(dragEl, touch.clientY);
    }
}, { passive: false });

gridEl.addEventListener('touchend', e => {
    if (!_touchState) return;
    clearTimeout(_touchState.timer);
    if (_touchState.active) {
        const touch = e.changedTouches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const dragEl = target ? target.closest('[data-drag-index]') : null;
        if (dragEl) {
            const toIdx = parseInt(dragEl.dataset.dragIndex);
            if (toIdx !== _touchState.idx) {
                const rect = dragEl.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                let insertIdx = toIdx;
                if (touch.clientY > midY) insertIdx = toIdx + 1;
                if (insertIdx > _touchState.idx) insertIdx--;
                const [moved] = cachedFiles.splice(_touchState.idx, 1);
                cachedFiles.splice(insertIdx, 0, moved);
                render(cachedFiles);
                saveOrder();
            }
        }
    }
    if (_touchState.clone) _touchState.clone.remove();
    _touchState = null;
    gridEl.querySelectorAll('.dragging, .drag-over, .drag-over-before, .drag-over-after').forEach(el => {
        el.classList.remove('dragging', 'drag-over', 'drag-over-before', 'drag-over-after');
    });
});

gridEl.addEventListener('touchcancel', () => {
    if (_touchState) {
        clearTimeout(_touchState.timer);
        if (_touchState.clone) _touchState.clone.remove();
        _touchState = null;
    }
    gridEl.querySelectorAll('.dragging, .drag-over, .drag-over-before, .drag-over-after').forEach(el => {
        el.classList.remove('dragging', 'drag-over', 'drag-over-before', 'drag-over-after');
    });
});
