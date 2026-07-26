"""Public read-only routes: list, download, preview, download-zip."""

import io
import os
import time
import zipfile

from flask import Blueprint, current_app, jsonify, request, send_file

from app.errors import BadRequestError, NotFoundError
from app.utils.filesystem import resolve

bp = Blueprint('files', __name__)

TEXT_EXTS: set[str] = {
    '.txt', '.md', '.json', '.js', '.jsx', '.ts', '.tsx',
    '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp',
    '.css', '.scss', '.less', '.html', '.htm', '.xml', '.yaml', '.yml', '.toml',
    '.ini', '.cfg', '.conf', '.sh', '.bash', '.zsh', '.fish',
    '.bat', '.cmd', '.ps1', '.env', '.gitignore', '.dockerignore',
    '.sql', '.r', '.m', '.swift', '.kt', '.log', '.csv', '.tsv',
    '.pl', '.pm', '.lua', '.vim', '.tex', '.rst', '.php',
    '.vue', '.svelte', '.coffee', '.diff', '.patch',
}


@bp.route('/api/files')
def list_files():
    sub = (request.args.get('path') or '').strip()
    base = current_app.config['UPLOAD_DIR']
    fp = resolve(base, sub)
    if fp is None:
        raise BadRequestError('非法路径')
    if not os.path.exists(fp):
        raise NotFoundError('目录不存在')
    if not os.path.isdir(fp):
        raise BadRequestError('不是目录')

    items: list[dict] = []
    for f in sorted(os.listdir(fp)):
        full = os.path.join(fp, f)
        if not os.path.exists(full):
            continue
        is_dir = os.path.isdir(full)
        stat = os.stat(full)
        _, ext = os.path.splitext(f)
        items.append({
            'name': f,
            'type': 'dir' if is_dir else 'file',
            'size': stat.st_size if not is_dir else 0,
            'mtime': time.strftime('%Y-%m-%dT%H:%M:%S', time.localtime(stat.st_mtime)),
            'ext': ext.lower() or '',
        })
    items.sort(key=lambda x: (0 if x['type'] == 'dir' else 1, x['name'].lower()))
    return jsonify({'files': items, 'path': sub})


@bp.route('/download/<path:filename>')
def download(filename):
    base = current_app.config['UPLOAD_DIR']
    fp = resolve(base, os.path.dirname(filename))
    if fp is None:
        raise BadRequestError('非法路径')
    safe = os.path.basename(filename)
    target = os.path.join(fp, safe)
    if not os.path.exists(target) or not os.path.isfile(target):
        raise NotFoundError('文件不存在')
    return send_file(target, as_attachment=True, download_name=safe)


@bp.route('/api/preview/<path:filename>')
def preview(filename):
    base = current_app.config['UPLOAD_DIR']
    fp = resolve(base, os.path.dirname(filename))
    if fp is None:
        raise BadRequestError('非法路径')
    safe = os.path.basename(filename)
    target = os.path.join(fp, safe)
    if not os.path.exists(target) or not os.path.isfile(target):
        raise NotFoundError('文件不存在')

    _, ext = os.path.splitext(safe)
    if ext.lower() not in TEXT_EXTS:
        raise BadRequestError('不支持预览该文件类型')

    stat = os.stat(target)
    truncated = stat.st_size > current_app.config['PREVIEW_MAX']
    try:
        with open(target, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read(current_app.config['PREVIEW_MAX'])
    except Exception:
        raise BadRequestError('无法读取文件')

    return jsonify({'content': content, 'truncated': truncated, 'size': stat.st_size})


@bp.route('/api/download-zip')
def download_zip():
    sub = (request.args.get('path') or '').strip()
    base = current_app.config['UPLOAD_DIR']
    fp = resolve(base, sub)
    if fp is None:
        raise BadRequestError('非法路径')
    if not os.path.isdir(fp):
        raise BadRequestError('不是文件夹')

    buf = io.BytesIO()
    folder_name = os.path.basename(sub) if sub else 'download'
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(fp):
            for f in files:
                full = os.path.join(root, f)
                arcname = os.path.relpath(full, os.path.dirname(fp))
                zf.write(full, arcname)
    buf.seek(0)

    return send_file(buf, as_attachment=True, download_name=f'{folder_name}.zip', mimetype='application/zip')
