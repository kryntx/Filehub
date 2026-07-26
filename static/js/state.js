/**
 * Centralized application state with a simple pub/sub pattern.
 * All mutable state lives here — no global variables, no window._xxx hacks.
 */

const STORAGE_KEYS = {
    viewMode: 'viewMode',
    theme: 'theme',
    previewWrap: 'previewWrap',
};

const State = {
    _listeners: {},
    _state: {
        currentPath: '',
        password: '',
    },

    /* ---- storage-backed getters ---- */
    get viewMode() {
        return localStorage.getItem(STORAGE_KEYS.viewMode) === 'list' ? 'list' : 'grid';
    },
    set viewMode(v) {
        localStorage.setItem(STORAGE_KEYS.viewMode, v);
        this._emit('viewMode', v);
    },

    get theme() {
        const stored = localStorage.getItem(STORAGE_KEYS.theme);
        if (stored === 'dark' || stored === 'light') return stored;
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    },
    set theme(v) {
        localStorage.setItem(STORAGE_KEYS.theme, v);
        this._emit('theme', v);
    },

    get wrapEnabled() {
        return localStorage.getItem(STORAGE_KEYS.previewWrap) !== 'false';
    },
    set wrapEnabled(v) {
        localStorage.setItem(STORAGE_KEYS.previewWrap, v);
        this._emit('wrapEnabled', v);
    },

    /* ---- plain getters / setters ---- */
    get currentPath() { return this._state.currentPath; },
    set currentPath(v) {
        this._state.currentPath = v;
        this._emit('currentPath', v);
    },

    get password() { return this._state.password; },
    set password(v) {
        this._state.password = v;
        this._emit('password', v);
    },

    /* ---- subscription ---- */
    on(key, fn) {
        (this._listeners[key] = this._listeners[key] || []).push(fn);
    },
    off(key, fn) {
        const arr = this._listeners[key];
        if (arr) this._listeners[key] = arr.filter(f => f !== fn);
    },
    _emit(key, value) {
        (this._listeners[key] || []).forEach(fn => fn(value));
    },
};

export default State;
