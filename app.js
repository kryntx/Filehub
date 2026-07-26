// ============ DOM refs ============
const fileGrid = document.getElementById('fileGrid');
const fileCount = document.getElementById('fileCount');
const emptyState = document.getElementById('emptyState');
const loading = document.getElementById('loading');
const toast = document.getElementById('toast');
const breadcrumb = document.getElementById('breadcrumb');
const viewToggle = document.getElementById('viewToggle');

const pwdModal = document.getElementById('passwordModal');
const pwdTitle = document.getElementById('passwordModalTitle');
const pwdDesc = document.getElementById('passwordModalDesc');
const pwdInput = document.getElementById('passwordInput');
const pwdError = document.getElementById('passwordError');

const uploadModal = document.getElementById('uploadModal');
const uploadZone = document.getElementById('uploadZone');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const fileInput = document.getElementById('fileInput');
const uploadError = document.getElementById('uploadError');

const urlInput = document.getElementById('urlInput');
const urlDownloadBtn = document.getElementById('urlDownloadBtn');
const urlProgress = document.getElementById('urlProgress');
const urlProgressText = document.getElementById('urlProgressText');
const urlError = document.getElementById('urlError');

const folderModal = document.getElementById('folderModal');
const folderInput = document.getElementById('folderNameInput');
const folderError = document.getElementById('folderError');

const renameModal = document.getElementById('renameModal');
const renameInput = document.getElementById('renameInput');
const renameError = document.getElementById('renameError');

const newFileModal = document.getElementById('newFileModal');
const newFileNameInput = document.getElementById('newFileNameInput');
const newFileError = document.getElementById('newFileError');

const previewModal = document.getElementById('previewModal');
const previewContent = document.getElementById('previewContent');
const previewTextarea = document.getElementById('previewTextarea');
const previewTitle = document.getElementById('previewTitle');
const previewTruncated = document.getElementById('previewTruncated');
const previewError = document.getElementById('previewError');
const previewDownloadBtn = document.getElementById('previewDownloadBtn');
const previewEditBtn = document.getElementById('previewEditBtn');
const previewSaveBtn = document.getElementById('previewSaveBtn');
const previewBody = document.getElementById('previewBody');

const themeToggle = document.getElementById('themeToggle');
const wrapToggle = document.getElementById('wrapToggle');

// ============ State ============
let currentPath = '';
let uploadPassword = '';
let pendingAction = null; // {type, ...}
let listView = localStorage.getItem('viewMode') === 'list';
let wrapEnabled = localStorage.getItem('previewWrap') !== 'false';
let isEditing = false;
let previewFilename = '';

// ============ Helpers ============
function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

const TEXT_EXTS = new Set([
    '.txt','.md','.json','.js','.jsx','.ts','.tsx',
    '.py','.rb','.go','.rs','.java','.c','.cpp','.h','.hpp',
    '.css','.scss','.less','.html','.htm','.xml','.yaml','.yml','.toml',
    '.ini','.cfg','.conf','.sh','.bash','.zsh','.fish',
    '.bat','.cmd','.ps1','.env','.gitignore','.dockerignore',
    '.sql','.r','.m','.swift','.kt','.log','.csv','.tsv',
    '.pl','.pm','.lua','.vim','.tex','.rst','.php',
    '.vue','.svelte','.coffee','.diff','.patch',
]);

function isTextFile(ext) { return TEXT_EXTS.has(ext.toLowerCase()); }

function formatSize(b) {
    if (b === 0) return '0 B';
    const u = ['B','KB','MB','GB','TB'];
    const i = Math.floor(Math.log(b) / Math.log(1024));
    return (b / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + u[i];
}

function formatTime(s) {
    const d = new Date(s);
    return d.toLocaleString('zh-CN', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
}

function getIcon(ext, type) {
    if (type === 'dir') return '📁';
    const m = {
        '.jpg':'🖼️','.jpeg':'🖼️','.png':'🖼️','.gif':'🖼️','.webp':'🖼️','.svg':'🖼️','.bmp':'🖼️','.ico':'🖼️',
        '.mp4':'🎬','.avi':'🎬','.mkv':'🎬','.mov':'🎬','.webm':'🎬',
        '.mp3':'🎵','.wav':'🎵','.flac':'🎵','.aac':'🎵','.ogg':'🎵',
        '.zip':'📦','.rar':'📦','.7z':'📦','.tar':'📦','.gz':'📦','.bz2':'📦','.xz':'📦',
        '.pdf':'📄','.doc':'📄','.docx':'📄','.xls':'📄','.xlsx':'📄','.ppt':'📄','.pptx':'📄','.txt':'📄','.md':'📄',
        '.exe':'⚙️','.msi':'⚙️','.deb':'⚙️','.rpm':'⚙️','.iso':'💿','.img':'💿',
    };
    return m[ext] || '📄';
}

function showToast(msg, type) {
    toast.textContent = msg;
    toast.className = 'toast ' + type + ' show';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function enc(name) { return encodeURIComponent(name); }
function dec(s) { return decodeURIComponent(s); }

// ============ Cookie ============
function setEndOfDayCookie(name, value) {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    document.cookie = encodeURIComponent(name) + '=' + encodeURIComponent(value) + '; expires=' + end.toUTCString() + '; path=/; SameSite=Lax';
}
function getCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + encodeURIComponent(name).replace(/[.+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
}

// ============ Password modal ============
function promptPwd(title, desc, action) {
    pwdTitle.textContent = title;
    pwdDesc.textContent = desc;
    pwdInput.value = '';
    pwdError.style.display = 'none';
    pendingAction = action;
    pwdModal.classList.add('active');
    setTimeout(() => pwdInput.focus(), 100);
}

function hidePwd() { pwdModal.classList.remove('active'); pendingAction = null; }

document.getElementById('passwordModalClose').onclick = hidePwd;
document.getElementById('passwordModalCancel').onclick = hidePwd;
pwdModal.addEventListener('click', e => { if (e.target === pwdModal) hidePwd(); });
pwdInput.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('passwordModalConfirm').click(); });

document.getElementById('passwordModalConfirm').onclick = async () => {
    const pwd = pwdInput.value.trim();
    if (!pwd) { pwdError.textContent = '请输入密码'; pwdError.style.display = 'block'; return; }
    setEndOfDayCookie('uploadPassword', pwd);
    uploadPassword = pwd;
    if (!pendingAction) return;
    const a = pendingAction;
    hidePwd();
    if (a.type === 'upload') {
        showUploadModal();
    } else if (a.type === 'mkdir') {
        doMkdir(pwd, a);
    } else if (a.type === 'rename') {
        doRename(pwd, a);
    } else if (a.type === 'delete') {
        doDelete(pwd, a);
    } else if (a.type === 'save') {
        doSave(pwd, a);
    } else if (a.type === 'newfile') {
        doNewfile(pwd);
    }
};

// ============ Upload ============
document.getElementById('uploadBtn').onclick = () => {
    if (uploadPassword) showUploadModal();
    else promptPwd('上传文件验证', '请输入上传密码以继续', { type: 'upload' });
};

function showUploadModal() {
    uploadModal.classList.add('active');
    uploadZone.style.display = 'block';
    uploadProgress.style.display = 'none';
    uploadError.style.display = 'none';
    fileInput.value = '';
}

function hideUploadModal() { uploadModal.classList.remove('active'); }

document.getElementById('uploadModalClose').onclick = hideUploadModal;
document.getElementById('uploadModalCancel').onclick = hideUploadModal;
uploadModal.addEventListener('click', e => { if (e.target === uploadModal) hideUploadModal(); });
fileInput.addEventListener('change', () => { if (fileInput.files.length) uploadFiles(fileInput.files); });

uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => { uploadZone.classList.remove('dragover'); });
uploadZone.addEventListener('drop', e => {
    e.preventDefault(); uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
});

async function uploadFiles(files) {
    uploadZone.style.display = 'none';
    uploadProgress.style.display = 'block';
    uploadError.style.display = 'none';
    const fd = new FormData();
    fd.append('file', files[0]);
    fd.append('path', currentPath);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    xhr.setRequestHeader('x-upload-password', uploadPassword);
    xhr.upload.onprogress = e => {
        if (e.lengthComputable) {
            const p = Math.round(e.loaded / e.total * 100);
            progressFill.style.width = p + '%';
            progressText.textContent = `上传中 ${p}% (${formatSize(e.loaded)} / ${formatSize(e.total)})`;
        }
    };
    xhr.onload = () => {
        if (xhr.status === 200) {
            showToast('上传成功', 'success');
            hideUploadModal();
            fetchFiles();
        } else {
            const d = JSON.parse(xhr.responseText);
            uploadError.textContent = d.error || '上传失败';
            uploadError.style.display = 'block';
            uploadZone.style.display = 'block';
            uploadProgress.style.display = 'none';
        }
    };
    xhr.onerror = () => { uploadError.textContent = '网络错误'; uploadError.style.display = 'block'; uploadZone.style.display = 'block'; uploadProgress.style.display = 'none'; };
    xhr.send(fd);
}

// ============ Upload from URL ============
urlDownloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) { urlError.textContent = '请输入下载链接'; urlError.style.display = 'block'; return; }
    urlError.style.display = 'none';
    urlDownloadBtn.disabled = true;
    urlDownloadBtn.textContent = '下载中...';
    urlProgress.style.display = 'block';

    try {
        const res = await fetch('/api/upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-upload-password': uploadPassword },
            body: JSON.stringify({ url, path: currentPath })
        });
        const d = await res.json();
        if (!res.ok) { urlError.textContent = d.error; urlError.style.display = 'block'; return; }
        showToast('下载成功', 'success');
        urlInput.value = '';
        hideUploadModal();
        fetchFiles();
    } catch { urlError.textContent = '网络错误'; urlError.style.display = 'block'; }
    finally {
        urlDownloadBtn.disabled = false;
        urlDownloadBtn.textContent = '下载';
        urlProgress.style.display = 'none';
    }
});

urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') urlDownloadBtn.click(); });

// ============ New Folder ============
document.getElementById('newFolderBtn').onclick = () => {
    if (uploadPassword) {
        doMkdir(uploadPassword, { type: 'mkdir' });
    } else {
        promptPwd('新建文件夹验证', '请输入上传密码以创建文件夹', { type: 'mkdir' });
    }
};

async function doMkdir(pwd, action) {
    folderInput.value = '';
    folderError.style.display = 'none';
    folderModal.classList.add('active');
    setTimeout(() => folderInput.focus(), 100);
    window._mkdirPwd = pwd;
}

document.getElementById('folderModalClose').onclick = () => folderModal.classList.remove('active');
document.getElementById('folderModalCancel').onclick = () => folderModal.classList.remove('active');
folderModal.addEventListener('click', e => { if (e.target === folderModal) folderModal.classList.remove('active'); });
folderInput.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('folderModalConfirm').click(); });

document.getElementById('folderModalConfirm').onclick = async () => {
    const name = folderInput.value.trim();
    if (!name) { folderError.textContent = '请输入文件夹名称'; folderError.style.display = 'block'; return; }
    folderError.style.display = 'none';
    try {
        const res = await fetch('/api/mkdir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-upload-password': window._mkdirPwd },
            body: JSON.stringify({ path: currentPath, name })
        });
        const d = await res.json();
        if (!res.ok) { folderError.textContent = d.error; folderError.style.display = 'block'; return; }
        folderModal.classList.remove('active');
        showToast('文件夹已创建', 'success');
        fetchFiles();
    } catch { folderError.textContent = '网络错误'; folderError.style.display = 'block'; }
};

// ============ New File ============
document.getElementById('newFileBtn').onclick = () => {
    if (uploadPassword) {
        doNewfile(uploadPassword);
    } else {
        promptPwd('新建文件验证', '请输入上传密码以创建文件', { type: 'newfile' });
    }
};

async function doNewfile(pwd) {
    newFileNameInput.value = '';
    newFileError.style.display = 'none';
    newFileModal.classList.add('active');
    setTimeout(() => newFileNameInput.focus(), 100);
    window._newFilePwd = pwd;
}

document.getElementById('newFileModalClose').onclick = () => newFileModal.classList.remove('active');
document.getElementById('newFileModalCancel').onclick = () => newFileModal.classList.remove('active');
newFileModal.addEventListener('click', e => { if (e.target === newFileModal) newFileModal.classList.remove('active'); });
newFileNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('newFileModalConfirm').click(); });

document.getElementById('newFileModalConfirm').onclick = async () => {
    const name = newFileNameInput.value.trim();
    if (!name) { newFileError.textContent = '请输入文件名'; newFileError.style.display = 'block'; return; }
    newFileError.style.display = 'none';
    try {
        const res = await fetch('/api/newfile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-upload-password': window._newFilePwd },
            body: JSON.stringify({ path: currentPath, name })
        });
        const d = await res.json();
        if (!res.ok) { newFileError.textContent = d.error; newFileError.style.display = 'block'; return; }
        newFileModal.classList.remove('active');
        showToast('文件已创建', 'success');
        fetchFiles();
    } catch { newFileError.textContent = '网络错误'; newFileError.style.display = 'block'; }
};

// ============ View toggle ============
viewToggle.addEventListener('click', () => {
    listView = !listView;
    localStorage.setItem('viewMode', listView ? 'list' : 'grid');
    viewToggle.textContent = listView ? '⊞' : '☰';
    const files = window._cachedFiles;
    if (files) renderFiles(files);
});

// ============ Fetch & Render ============
async function fetchFiles() {
    try {
        const q = currentPath ? '?path=' + enc(currentPath) : '';
        const res = await fetch('/api/files' + q);
        const d = await res.json();
        window._cachedFiles = d.files;
        renderBreadcrumb(d.path || '');
        renderFiles(d.files);
    } catch { showToast('加载失败', 'error'); }
}

function renderBreadcrumb(path) {
    const parts = path ? path.split('/') : [];
    let html = '<a class="root-link" data-path="">Root</a>';
    let accumulated = '';
    for (const p of parts) {
        if (!p) continue;
        accumulated = accumulated ? accumulated + '/' + p : p;
        html += '<span class="sep">›</span><a data-path="' + enc(accumulated) + '">' + escapeHtml(p) + '</a>';
    }
    breadcrumb.innerHTML = html;
    breadcrumb.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
            currentPath = dec(a.dataset.path);
            fetchFiles();
        });
    });
}

function renderFiles(files) {
    loading.style.display = 'none';
    window._cachedFiles = files;

    if (!files || files.length === 0) {
        fileGrid.innerHTML = '';
        emptyState.style.display = 'block';
        fileCount.textContent = '共 0 项';
        return;
    }

    emptyState.style.display = 'none';
    fileCount.textContent = `共 ${files.length} 项`;

    if (listView) {
        fileGrid.className = 'file-grid list-view';
        renderListView(files);
    } else {
        fileGrid.className = 'file-grid';
        renderGridView(files);
    }
}

function renderGridView(files) {
    fileGrid.innerHTML = files.map(f => {
        const icon = getIcon(f.ext, f.type);
        const isDir = f.type === 'dir';
        const name = escapeHtml(f.name);
        const en = enc(f.name);
        const size = isDir ? '' : formatSize(f.size);
        const time = formatTime(f.mtime);
        const textFile = isTextFile(f.ext);
        const actions = isDir ? `
            <a href="/api/download-zip?path=${currentPath ? enc(currentPath) + '/' : ''}${en}" class="btn btn-primary btn-sm btn-download" download>下载</a>
            <button class="btn btn-danger btn-sm" data-act="deleteDir" data-name="${en}">删除</button>
            <button class="btn btn-secondary btn-sm" data-act="rename" data-name="${en}">重命名</button>
        ` : `
            <a href="/download${currentPath ? '/' + enc(currentPath) : ''}/${en}" class="btn btn-primary btn-sm btn-download" download>下载</a>
            <button class="btn btn-secondary btn-sm" data-preview="${en}">预览</button>
            <button class="btn btn-danger btn-sm" data-act="deleteFile" data-name="${en}">删除</button>
            <button class="btn btn-secondary btn-sm" data-act="rename" data-name="${en}">重命名</button>
        `;
        return `
            <div class="file-card ${isDir ? 'card-dir' : ''}">
                <div class="card-body" ${isDir ? 'data-dir="' + en + '"' : ''}>
                    <div class="file-icon">${icon}</div>
                    <div class="file-name" title="${name}">${name}</div>
                    ${size ? `<div class="file-size">${size}</div>` : ''}
                    <div class="file-time">${time}</div>
                </div>
                <div class="file-actions">${actions}</div>
            </div>
        `;
    }).join('');

    // Dir click
    fileGrid.querySelectorAll('.card-body[data-dir]').forEach(el => {
        el.addEventListener('click', e => {
            if (e.target.closest('.file-actions, .btn')) return;
            currentPath = currentPath ? currentPath + '/' + dec(el.dataset.dir) : dec(el.dataset.dir);
            fetchFiles();
        });
    });
}

function renderListView(files) {
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
        const textFile = isTextFile(f.ext);

        let ddItems = '';
        if (isDir) {
            ddItems = `
                <a href="/api/download-zip?path=${currentPath ? enc(currentPath) + '/' : ''}${en}" class="dropdown-item" download>下载</a>
                <button class="dropdown-item dropdown-danger" data-act="deleteDir" data-name="${en}">删除</button>
                <button class="dropdown-item" data-act="rename" data-name="${en}">重命名</button>
            `;
        } else {
            ddItems = `
                <a href="/download${currentPath ? '/' + enc(currentPath) : ''}/${en}" class="dropdown-item" download>下载</a>
                <button class="dropdown-item" data-preview="${en}">预览</button>
                <button class="dropdown-item dropdown-danger" data-act="deleteFile" data-name="${en}">删除</button>
                <button class="dropdown-item" data-act="rename" data-name="${en}">重命名</button>
            `;
        }

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
    fileGrid.innerHTML = html;

    // Dir click in list view
    fileGrid.querySelectorAll('.list-name[data-dir]').forEach(el => {
        el.addEventListener('click', () => {
            currentPath = currentPath ? currentPath + '/' + dec(el.dataset.dir) : dec(el.dataset.dir);
            fetchFiles();
        });
    });

    // Auto-scroll for overflow text
    fileGrid.querySelectorAll('.col-name, .col-time').forEach(cell => {
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

// ============ Event delegation ============
fileGrid.addEventListener('click', e => {
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

    const btn = e.target.closest('[data-preview]');
    if (btn) { closeAllDropdowns(); showPreview(dec(btn.dataset.preview)); return; }

    const act = e.target.closest('[data-act]');
    if (!act) { closeAllDropdowns(); return; }
    const name = dec(act.dataset.name);
    const type = act.dataset.act;

    if (type === 'deleteFile' || type === 'deleteDir') {
        if (uploadPassword) {
            doDelete(uploadPassword, { path: currentPath, name, isDir: type === 'deleteDir' });
        } else {
            promptPwd('删除验证', type === 'deleteDir' ? '删除文件夹及其所有内容？' : '删除此文件？', { type: 'delete', path: currentPath, name, isDir: type === 'deleteDir' });
        }
    } else if (type === 'rename') {
        if (uploadPassword) {
            doRename(uploadPassword, { path: currentPath, name });
        } else {
            promptPwd('重命名验证', '请输入上传密码以重命名', { type: 'rename', path: currentPath, name });
        }
    }
    closeAllDropdowns();
});

document.addEventListener('click', closeAllDropdowns);

function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu.show').forEach(m => m.classList.remove('show'));
}

// ============ Delete ============
async function doDelete(pwd, a) {
    try {
        const res = await fetch('/api/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'x-upload-password': pwd },
            body: JSON.stringify({ path: a.path, name: a.name })
        });
        const d = await res.json();
        if (!res.ok) { showToast(d.error, 'error'); return; }
        showToast('已删除', 'success');
        fetchFiles();
    } catch { showToast('删除失败', 'error'); }
}

// ============ Rename ============
async function doRename(pwd, a) {
    renameInput.value = a.name;
    renameError.style.display = 'none';
    renameModal.classList.add('active');
    setTimeout(() => renameInput.focus(), 100);
    renameInput.select();
    window._renameData = { pwd, path: a.path, name: a.name };
}

document.getElementById('renameModalClose').onclick = () => renameModal.classList.remove('active');
document.getElementById('renameModalCancel').onclick = () => renameModal.classList.remove('active');
renameModal.addEventListener('click', e => { if (e.target === renameModal) renameModal.classList.remove('active'); });
renameInput.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('renameModalConfirm').click(); });

document.getElementById('renameModalConfirm').onclick = async () => {
    const newName = renameInput.value.trim();
    if (!newName) { renameError.textContent = '请输入新名称'; renameError.style.display = 'block'; return; }
    const rd = window._renameData;
    try {
        const res = await fetch('/api/rename', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-upload-password': rd.pwd },
            body: JSON.stringify({ path: rd.path, name: rd.name, newName })
        });
        const d = await res.json();
        if (!res.ok) { renameError.textContent = d.error; renameError.style.display = 'block'; return; }
        renameModal.classList.remove('active');
        showToast('重命名成功', 'success');
        fetchFiles();
    } catch { renameError.textContent = '网络错误'; renameError.style.display = 'block'; }
};

// ============ Preview ============
async function showPreview(filename) {
    previewFilename = filename;
    previewContent.textContent = '加载中...';
    previewTextarea.style.display = 'none';
    previewContent.style.display = 'block';
    previewEditBtn.style.display = 'none';
    previewSaveBtn.style.display = 'none';
    previewError.style.display = 'none';
    previewTruncated.style.display = 'none';
    previewTitle.textContent = filename;
    const q = currentPath ? enc(currentPath) + '/' + enc(filename) : enc(filename);
    previewDownloadBtn.href = '/download/' + q;
    previewModal.classList.add('active');
    isEditing = false;

    const ext = filename.includes('.') ? '.' + filename.split('.').pop().toLowerCase() : '';

    // Image preview
    if (['.jpg','.jpeg','.png','.gif','.webp','.svg','.bmp','.ico'].includes(ext)) {
        previewContent.className = 'preview-content preview-image';
        previewContent.innerHTML = '<img src="/download/' + q + '" alt="' + escapeHtml(filename) + '">';
        return;
    }

    // Text preview
    previewContent.className = 'preview-content';
    try {
        const res = await fetch('/api/preview/' + q);
        const d = await res.json();
        if (!res.ok) { previewError.textContent = d.error; previewError.style.display = 'block'; previewContent.textContent = ''; return; }
        previewContent.textContent = d.content;
        previewTextarea.value = d.content;
        previewEditBtn.style.display = 'inline-flex';
        if (d.truncated) previewTruncated.style.display = 'block';
        applyWrap();
    } catch { previewError.textContent = '加载失败'; previewError.style.display = 'block'; }
}

function hidePreview() { previewModal.classList.remove('active'); isEditing = false; }

document.getElementById('previewModalClose').onclick = hidePreview;
document.getElementById('previewCloseBtn').onclick = hidePreview;
previewModal.addEventListener('click', e => { if (e.target === previewModal) hidePreview(); });

// Edit toggle
previewEditBtn.addEventListener('click', () => {
    isEditing = true;
    previewContent.style.display = 'none';
    previewTextarea.style.display = 'block';
    previewEditBtn.style.display = 'none';
    previewSaveBtn.style.display = 'inline-flex';
});

// Cancel edit on close
previewSaveBtn.addEventListener('click', () => {
    if (uploadPassword) {
        doSave(uploadPassword, { type: 'save' });
    } else {
        promptPwd('保存验证', '请输入上传密码以保存修改', { type: 'save' });
    }
});

async function doSave(pwd, a) {
    try {
        const q = currentPath ? enc(currentPath) + '/' + enc(previewFilename) : enc(previewFilename);
        // Need to determine path and filename separately
        const path = currentPath;
        const name = previewFilename;
        const content = previewTextarea.value;
        const res = await fetch('/api/save', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-upload-password': pwd },
            body: JSON.stringify({ path, name, content })
        });
        const d = await res.json();
        if (!res.ok) { showToast(d.error || '保存失败', 'error'); return; }
        showToast('保存成功', 'success');
        isEditing = false;
        previewContent.textContent = content;
        previewTextarea.style.display = 'none';
        previewContent.style.display = 'block';
        previewEditBtn.style.display = 'inline-flex';
        previewSaveBtn.style.display = 'none';
    } catch { showToast('保存失败', 'error'); }
}

// Wrap toggle
wrapToggle.addEventListener('click', () => {
    wrapEnabled = !wrapEnabled;
    applyWrap();
});

function applyWrap() {
    previewContent.classList.toggle('preview-nowrap', !wrapEnabled);
    previewTextarea.classList.toggle('preview-nowrap', !wrapEnabled);
    previewTextarea.wrap = wrapEnabled ? 'soft' : 'off';
    wrapToggle.classList.toggle('active', wrapEnabled);
    wrapToggle.textContent = wrapEnabled ? '⤻' : '↔';
    localStorage.setItem('previewWrap', wrapEnabled);
}

// ============ Theme ============
function getPreferredTheme() {
    const s = localStorage.getItem('theme');
    if (s === 'dark' || s === 'light') return s;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
    themeToggle.textContent = t === 'dark' ? '🌙' : '☀️';
}
setTheme(getPreferredTheme());
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
    if (!localStorage.getItem('theme')) setTheme(e.matches ? 'light' : 'dark');
});
themeToggle.addEventListener('click', () => {
    const c = document.documentElement.getAttribute('data-theme') || 'dark';
    setTheme(c === 'dark' ? 'light' : 'dark');
});

// ============ Init ============
const savedPwd = getCookie('uploadPassword');
if (savedPwd) uploadPassword = savedPwd;
viewToggle.textContent = listView ? '⊞' : '☰';
fetchFiles();
