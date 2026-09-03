/** DOM / formatting / cookie utilities. */

export function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

export function formatSize(b) {
    if (b === 0) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(b) / Math.log(1024));
    return (b / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + u[i];
}

export function formatTime(s) {
    const d = new Date(s);
    return d.toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
    });
}

const ICON_MAP = {
    '.jpg': '🖼️', '.jpeg': '🖼️', '.png': '🖼️', '.gif': '🖼️',
    '.webp': '🖼️', '.svg': '🖼️', '.bmp': '🖼️', '.ico': '🖼️',
    '.mp4': '🎬', '.avi': '🎬', '.mkv': '🎬', '.mov': '🎬', '.webm': '🎬',
    '.mp3': '🎵', '.wav': '🎵', '.flac': '🎵', '.aac': '🎵', '.ogg': '🎵',
    '.zip': '📦', '.rar': '📦', '.7z': '📦', '.tar': '📦',
    '.gz': '📦', '.bz2': '📦', '.xz': '📦',
    '.pdf': '📄', '.doc': '📄', '.docx': '📄', '.xls': '📄',
    '.xlsx': '📄', '.ppt': '📄', '.pptx': '📄', '.txt': '📄', '.md': '📄',
    '.exe': '⚙️', '.msi': '⚙️', '.deb': '⚙️', '.rpm': '⚙️',
    '.iso': '💿', '.img': '💿',
};

export function getIcon(ext, type) {
    if (type === 'dir') return '📁';
    return ICON_MAP[ext] || '📄';
}

export const TEXT_EXTS = new Set([
    '.txt', '.md', '.json', '.js', '.jsx', '.ts', '.tsx',
    '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp',
    '.css', '.scss', '.less', '.html', '.htm', '.xml', '.yaml', '.yml', '.toml',
    '.ini', '.cfg', '.conf', '.sh', '.bash', '.zsh', '.fish',
    '.bat', '.cmd', '.ps1', '.env', '.gitignore', '.dockerignore',
    '.sql', '.r', '.m', '.swift', '.kt', '.log', '.csv', '.tsv',
    '.pl', '.pm', '.lua', '.vim', '.tex', '.rst', '.php',
    '.vue', '.svelte', '.coffee', '.diff', '.patch',
]);

export function isTextFile(ext) {
    return TEXT_EXTS.has(ext.toLowerCase());
}

export function enc(name) {
    return encodeURIComponent(name);
}

export function dec(s) {
    return decodeURIComponent(s);
}

/* ---- Cookie helpers ---- */

export function setEndOfDayCookie(name, value) {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let cookie =
        encodeURIComponent(name) + '=' + encodeURIComponent(value) +
        '; expires=' + end.toUTCString() + '; path=/; SameSite=Lax';
    if (location.protocol === 'https:') cookie += '; Secure';
    document.cookie = cookie;
}

export function getCookie(name) {
    const m = document.cookie.match(
        new RegExp('(?:^|; )' + encodeURIComponent(name).replace(/[.+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)')
    );
    return m ? decodeURIComponent(m[1]) : '';
}
