/** File grid component — handles both grid and list view rendering. */

import State from '../state.js';
import * as api from '../api.js';
import * as breadcrumb from './breadcrumb.js';
import { escapeHtml, formatSize, formatTime, getIcon, isTextFile, enc, dec } from '../utils.js';
import * as uploadModal from './modals/upload.js';
import * as renameModal from './modals/rename.js';
import { prompt } from './modals/password.js';
import * as previewModal from './modals/preview.js?v=8';
import * as toast from './toast.js';
import * as realtime from '../realtime.js';

const gridEl = document.getElementById('fileGrid');
const countEl = document.getElementById('fileCount');
const emptyEl = document.getElementById('emptyState');
const loadingEl = document.getElementById('loading');
const viewToggle = document.getElementById('viewToggle');

let cachedFiles = [];
let _dragIdx = -1;
let _lastMove = { t: 0, idx: -1, side: '' };
// 远端拖拽会话: { name: 被拖文件名, snapshot: 拖拽开始前的顺序, timer: 空闲/回滚定时器 }
let _remoteDrag = null;

const REMOTE_IDLE = 5000;   // 无后续 drag 事件视为拖拽中断，还原顺序
const REMOTE_SETTLE = 1200; // drag.end 后等待 order 广播定稿的窗口

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

/* ---- Remote drag sync (realtime) ---- */

function cardByName(name) {
    const inner = gridEl.querySelector('[data-file="' + enc(name) + '"], [data-dir="' + enc(name) + '"]');
    return inner ? inner.closest('[data-drag-index]') : null;
}

function clearRemoteIndicators() {
    gridEl.querySelectorAll('.dragging-remote, .drag-over, .drag-over-before, .drag-over-after').forEach(el => {
        el.classList.remove('dragging-remote', 'drag-over', 'drag-over-before', 'drag-over-after');
    });
}

// 还原到拖拽开始前的顺序（拖拽中断、或 drag.end 后未收到 order 定稿）
function rollbackRemote() {
    if (!_remoteDrag) return;
    const order = _remoteDrag.snapshot;
    _remoteDrag = null;
    applyRemoteOrder(order);
}

function armRemoteTimer(ms, fn) {
    if (!_remoteDrag) return;
    clearTimeout(_remoteDrag.timer);
    _remoteDrag.timer = setTimeout(() => {
        if (_remoteDrag) fn();
    }, ms);
}

function applyRemoteStart(ev) {
    // 上一个会话可能因消息丢失未收尾，先还原再开始新的
    rollbackRemote();
    clearRemoteIndicators();
    const el = cardByName(ev.name) || gridEl.querySelector('[data-drag-index="' + ev.idx + '"]');
    if (el) el.classList.add('dragging-remote');
    _remoteDrag = { name: ev.name, snapshot: cachedFiles.map(f => f.name), timer: 0 };
    armRemoteTimer(REMOTE_IDLE, rollbackRemote);
}

// 把被拖卡片实时挪到目标卡片前/后，cachedFiles 与 DOM 同步，位置实时跟手
function moveRemoteItem(targetName, side) {
    if (!_remoteDrag || !_remoteDrag.name || !targetName || _remoteDrag.name === targetName) return;
    const from = cardByName(_remoteDrag.name);
    const to = cardByName(targetName);
    if (!from || !to) return;

    const names = cachedFiles.map(f => f.name);
    const fi = names.indexOf(_remoteDrag.name);
    const ti = names.indexOf(targetName);
    if (fi < 0 || ti < 0) return;
    let insertIdx = side === 'after' ? ti + 1 : ti;
    if (fi < insertIdx) insertIdx--;
    if (insertIdx === fi) return; // 相对位置未变，避免无谓跳动

    const [moved] = cachedFiles.splice(fi, 1);
    cachedFiles.splice(insertIdx, 0, moved);

    const parent = from.parentNode;
    if (side === 'after') {
        const next = to.nextElementSibling;
        if (next) parent.insertBefore(from, next);
        else parent.appendChild(from);
    } else {
        parent.insertBefore(from, to);
    }
    syncDragIndices();
}

// DOM 节点移动后刷新 data-drag-index，否则本端后续拖拽会按旧索引定位
function syncDragIndices() {
    const root = gridEl.querySelector('tbody') || gridEl;
    Array.from(root.children).filter(el =>
        el.classList.contains('file-card') || el.tagName === 'TR')
        .forEach((el, i) => { el.dataset.dragIndex = String(i); });
}

function applyRemoteMove(ev) {
    gridEl.querySelectorAll('.drag-over, .drag-over-before, .drag-over-after').forEach(el => {
        el.classList.remove('drag-over', 'drag-over-before', 'drag-over-after');
    });
    const target = cardByName(ev.name) || gridEl.querySelector('[data-drag-index="' + ev.idx + '"]');
    if (!target) return;
    target.classList.add('drag-over', ev.side === 'after' ? 'drag-over-after' : 'drag-over-before');
    if (_remoteDrag) {
        armRemoteTimer(REMOTE_IDLE, rollbackRemote);
        moveRemoteItem(ev.name, ev.side);
    }
}

function applyRemoteOrder(order) {
    const pos = new Map(order.map((n, i) => [n, i]));
    cachedFiles.sort((a, b) => {
        const pa = pos.get(a.name), pb = pos.get(b.name);
        if (pa === undefined && pb === undefined) return a.name.localeCompare(b.name);
        if (pa === undefined) return 1;
        if (pb === undefined) return -1;
        return pa - pb;
    });
    render(cachedFiles);
}

realtime.on('drag.start', (data, p) => {
    if (data.path !== State.currentPath) return;
    applyRemoteStart(data);
});

realtime.on('drag.move', (data, p) => {
    if (data.path !== State.currentPath) return;
    applyRemoteMove(data);
});

realtime.on('drag.end', data => {
    if (data.path !== State.currentPath) return;
    clearRemoteIndicators();
    if (!_remoteDrag) return;
    // A 端正常落点会广播 order 定稿；若拖回原位则无 order，超时后还原快照
    armRemoteTimer(REMOTE_SETTLE, rollbackRemote);
});

realtime.on('order', data => {
    if (data.path !== State.currentPath) return;
    if (_remoteDrag) {
        clearTimeout(_remoteDrag.timer);
        _remoteDrag = null;
    }
    applyRemoteOrder(data.order);
});

function sendDragMove(idx, side) {
    const now = performance.now();
    if (now - _lastMove.t < 50 && _lastMove.idx === idx && _lastMove.side === side) return;
    _lastMove = { t: now, idx, side };
    realtime.send('drag.move', { path: State.currentPath, idx, side, name: cachedFiles[idx] ? cachedFiles[idx].name : '' });
}

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
    realtime.send('drag.start', { path: State.currentPath, idx: _dragIdx, name: cachedFiles[_dragIdx] ? cachedFiles[_dragIdx].name : '' });
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
    sendDragMove(parseInt(el.dataset.dragIndex), el.classList.contains('drag-over-after') ? 'after' : 'before');
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
    const draggedName = cachedFiles[_dragIdx] ? cachedFiles[_dragIdx].name : '';
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
    realtime.send('drag.end', { path: State.currentPath, name: draggedName });
    realtime.send('order', { path: State.currentPath, order: cachedFiles.map(f => f.name) });
});

gridEl.addEventListener('dragend', e => {
    if (_dragIdx >= 0 && cachedFiles[_dragIdx]) {
        realtime.send('drag.end', { path: State.currentPath, name: cachedFiles[_dragIdx].name });
    }
    clearDrag();
});

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
            realtime.send('drag.start', { path: State.currentPath, idx: _touchState.idx, name: cachedFiles[_touchState.idx] ? cachedFiles[_touchState.idx].name : '' });
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
        sendDragMove(parseInt(dragEl.dataset.dragIndex), dragEl.classList.contains('drag-over-after') ? 'after' : 'before');
    }
}, { passive: false });

gridEl.addEventListener('touchend', e => {
    if (!_touchState) return;
    clearTimeout(_touchState.timer);
    if (_touchState.active) {
        const touch = e.changedTouches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const dragEl = target ? target.closest('[data-drag-index]') : null;
        const draggedName = cachedFiles[_touchState.idx] ? cachedFiles[_touchState.idx].name : '';
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
        realtime.send('drag.end', { path: State.currentPath, name: draggedName });
        realtime.send('order', { path: State.currentPath, order: cachedFiles.map(f => f.name) });
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
        if (_touchState.active && cachedFiles[_touchState.idx]) {
            realtime.send('drag.end', { path: State.currentPath, name: cachedFiles[_touchState.idx].name });
        }
        if (_touchState.clone) _touchState.clone.remove();
        _touchState = null;
    }
    gridEl.querySelectorAll('.dragging, .drag-over, .drag-over-before, .drag-over-after').forEach(el => {
        el.classList.remove('dragging', 'drag-over', 'drag-over-before', 'drag-over-after');
    });
});
