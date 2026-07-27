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


def _find_resume_target(fp: str, safe: str) -> str | None:
    """Find existing file for resume, checking original and _N variants."""
    target = os.path.join(fp, safe)
    if os.path.exists(target):
        return target
    root, ext = os.path.splitext(safe)
    for counter in range(1, 100):
        alt = os.path.join(fp, f'{root}_{counter}{ext}')
        if os.path.exists(alt):
            return alt
    return None


CHUNK_SIZE = 65536  # 64KB


def _stream_to_file(stream, target, mode='wb'):
    """Read from stream in chunks and write to target file."""
    with open(target, mode) as fh:
        while True:
            chunk = stream.read(CHUNK_SIZE)
            if not chunk:
                break
            fh.write(chunk)


@bp.route('/api/upload', methods=['POST'])
@require_password
def upload():
    sub = (request.form.get('path') or request.args.get('path') or '').strip()
    base = current_app.config['UPLOAD_DIR']
    fp = resolve(base, sub)
    if fp is None:
        raise BadRequestError('非法路径')
    os.makedirs(fp, exist_ok=True)

    offset_str = request.headers.get('X-Upload-Offset') or request.args.get('offset') or '0'
    try:
        offset = int(offset_str) if offset_str else 0
    except (ValueError, TypeError):
        offset = 0

    raw_filename = (
        request.args.get('filename')
        or request.headers.get('X-Upload-Filename')
        or ''
    )

    if offset > 0:
        # Resume upload — append to existing file
        if not raw_filename:
            raise BadRequestError('缺少文件名')
        safe = safe_name(urllib.parse.unquote(raw_filename))
        target = _find_resume_target(fp, safe)
        if target is None:
            raise BadRequestError('续传文件不存在')
        _stream_to_file(request.stream, target, 'ab')
        basename = os.path.basename(target)
    elif 'file' in request.files and request.files['file'].filename:
        # FormData upload (legacy)
        f = request.files['file']
        safe = safe_name(f.filename)
        target, basename = _unique_target(fp, safe)
        f.save(target)
    else:
        # Raw binary upload
        if not raw_filename:
            raise BadRequestError('请选择文件')
        safe = safe_name(urllib.parse.unquote(raw_filename))
        target, basename = _unique_target(fp, safe)
        _stream_to_file(request.stream, target, 'wb')

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
