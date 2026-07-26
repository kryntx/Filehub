"""Password-protected upload routes."""

import os
import re
import urllib.parse
import urllib.request

from flask import Blueprint, current_app, jsonify, request

from app.decorators import require_password
from app.errors import BadRequestError
from app.utils.filesystem import resolve, safe_name

bp = Blueprint('upload', __name__)


def _unique_target(fp: str, safe: str) -> tuple[str, str]:
    """Find a unique filename in fp, returning (full_path, basename)."""
    root, ext = os.path.splitext(safe)
    target = os.path.join(fp, safe)
    counter = 1
    while os.path.exists(target) and counter < 10000:
        target = os.path.join(fp, f'{root}_{counter}{ext}')
        counter += 1
    return target, os.path.basename(target)


@bp.route('/api/upload', methods=['POST'])
@require_password
def upload():
    sub = (request.form.get('path') or '').strip()
    base = current_app.config['UPLOAD_DIR']
    fp = resolve(base, sub)
    if fp is None:
        raise BadRequestError('非法路径')
    os.makedirs(fp, exist_ok=True)

    if 'file' not in request.files:
        raise BadRequestError('请选择文件')
    f = request.files['file']
    if not f.filename:
        raise BadRequestError('请选择文件')

    safe = safe_name(f.filename)
    target, basename = _unique_target(fp, safe)
    f.save(target)

    rel = os.path.join(sub, basename).replace('\\', '/')
    return jsonify({'success': True, 'file': rel})


@bp.route('/api/upload-url', methods=['POST'])
@require_password
def upload_url():
    data = request.get_json(silent=True) or {}
    url = (data.get('url') or '').strip()
    sub = (data.get('path') or '').strip()
    if not url:
        raise BadRequestError('请输入下载链接')

    base = current_app.config['UPLOAD_DIR']
    fp = resolve(base, sub)
    if fp is None:
        raise BadRequestError('非法路径')
    os.makedirs(fp, exist_ok=True)

    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        timeout = current_app.config['URL_DOWNLOAD_TIMEOUT']
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            content = resp.read()

        filename = None
        cd = resp.headers.get('Content-Disposition')
        if cd:
            m = re.search(r'filename\*?=(?:UTF-8\'\')?["\']?([^"\';\n]+)["\']?', cd)
            if m:
                filename = urllib.parse.unquote(m.group(1))
        if not filename:
            filename = os.path.basename(urllib.parse.urlparse(url).path)
        if not filename:
            filename = 'download'

        safe = safe_name(filename)
        target, basename = _unique_target(fp, safe)

        with open(target, 'wb') as f:
            f.write(content)

        return jsonify({'success': True, 'file': basename})
    except Exception as e:
        raise BadRequestError(f'下载失败: {e}')
