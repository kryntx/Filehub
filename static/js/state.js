/**
 * Centralized application state with a simple pub/sub pattern.
 * All mutable state lives here — no global variables, no window._xxx hacks.
 */

const STORAGE_KEYS = {
    viewMode: 'viewMode',
    colorMode: 'colorMode',
    effectTheme: 'effectTheme',
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

    get colorMode() {
        const stored = localStorage.getItem(STORAGE_KEYS.colorMode);
        if (stored === 'system' || stored === 'light' || stored === 'dark') return stored;

        const legacy = localStorage.getItem(STORAGE_KEYS.theme);
        if (legacy === 'light' || legacy === 'dark') return legacy;

        return 'system';
    },
    set colorMode(v) {
        const next = v === 'light' || v === 'dark' ? v : 'system';
        localStorage.setItem(STORAGE_KEYS.colorMode, next);
        localStorage.removeItem(STORAGE_KEYS.theme);
        this._emit('colorMode', next);
        this._emit('theme', this.theme);
    },

    get effectTheme() {
        return localStorage.getItem(STORAGE_KEYS.effectTheme) === 'blur' ? 'blur' : 'liquid';
    },
    set effectTheme(v) {
        const next = v === 'blur' ? 'blur' : 'liquid';
        localStorage.setItem(STORAGE_KEYS.effectTheme, next);
        this._emit('effectTheme', next);
    },

    get theme() {
        if (this.colorMode === 'system') {
            return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        }
        return this.colorMode;
    },
    set theme(v) {
        this.colorMode = v === 'light' ? 'light' : 'dark';
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
