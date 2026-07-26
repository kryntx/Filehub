/** Unified API client. All server communication goes through here. */

import State from './state.js';

class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}

async function request(method, url, { body = null, auth = false, raw = false } = {}) {
    const headers = {};
    if (body && !raw) headers['Content-Type'] = 'application/json';
    if (auth) headers['x-upload-password'] = State.password;

    const opts = { method, headers };
    if (body) {
        opts.body = raw ? body : JSON.stringify(body);
    }

    const res = await fetch(url, opts);
    const data = await res.json();

    if (!res.ok) throw new ApiError(data.error || '请求失败', res.status);
    return data;
}

/* ---- Public read-only ---- */

export function fetchFiles(path = '') {
    const q = path ? '?path=' + encodeURIComponent(path) : '';
    return request('GET', '/api/files' + q);
}

export function downloadUrl(path) {
    return '/download/' + encodeURIComponent(path);
}

export function previewUrl(filename) {
    return '/api/preview/' + encodeURIComponent(filename);
}

export function fetchPreview(filename) {
    return request('GET', '/api/preview/' + encodeURIComponent(filename));
}

export function downloadZipUrl(path) {
    const q = path ? '?path=' + encodeURIComponent(path) : '';
    return '/api/download-zip' + q;
}

/* ---- Auth-required write operations ---- */

export function uploadFile(formData) {
    return request('POST', '/api/upload', { body: formData, auth: true, raw: true });
}

export function uploadFromUrl(url, path) {
    return request('POST', '/api/upload-url', { body: { url, path }, auth: true });
}

export function createFolder(path, name) {
    return request('POST', '/api/mkdir', { body: { path, name }, auth: true });
}

export function createFile(path, name) {
    return request('POST', '/api/newfile', { body: { path, name }, auth: true });
}

export function renameItem(path, name, newName) {
    return request('PUT', '/api/rename', { body: { path, name, newName }, auth: true });
}

export function saveFile(path, name, content) {
    return request('PUT', '/api/save', { body: { path, name, content }, auth: true });
}

export function deleteItem(path, name) {
    return request('DELETE', '/api/delete', { body: { path, name }, auth: true });
}

export { ApiError };
