"""Password-protected admin routes: mkdir, newfile, rename, save, delete, order."""

import json
import os

from flask import Blueprint, current_app, jsonify, request

from app.decorators import require_password
from app.errors import BadRequestError, NotFoundError
from app.utils.filesystem import resolve, safe_name

bp = Blueprint('admin', __name__)


def _unique_target(fp: str, safe: str) -> str:
    """Find a unique destination path in fp. Returns full path."""
    root, ext = os.path.splitext(safe)
    target = os.path.join(fp, safe)
    counter = 1
    while os.path.exists(target) and counter < 10000:
        target = os.path.join(fp, f'{root}_{counter}{ext}')
        counter += 1
    return target


@bp.route('/api/mkdir', methods=['POST'])
@require_password
def mkdir():
    data = request.get_json(silent=True) or {}
    sub = (data.get('path') or '').strip()
    name = safe_name((data.get('name') or '').strip())
    if not name:
        raise BadRequestError('请输入文件夹名称')

    base = current_app.config['UPLOAD_DIR']
    fp = resolve(base, sub)
    if fp is None:
        raise BadRequestError('非法路径')
    target = os.path.join(fp, name)
    if os.path.exists(target):
        raise BadRequestError('已存在同名文件或文件夹')

    os.makedirs(target, exist_ok=False)
    return jsonify({'success': True})


@bp.route('/api/newfile', methods=['POST'])
@require_password
def newfile():
    data = request.get_json(silent=True) or {}
    sub = (data.get('path') or '').strip()
    name = safe_name((data.get('name') or '').strip())
    if not name:
        raise BadRequestError('请输入文件名')

    base = current_app.config['UPLOAD_DIR']
    fp = resolve(base, sub)
    if fp is None:
        raise BadRequestError('非法路径')
    target = os.path.join(fp, name)
    if os.path.exists(target):
        raise BadRequestError('已存在同名文件或文件夹')

    try:
        with open(target, 'w', encoding='utf-8') as f:
            pass
    except OSError as e:
        raise BadRequestError(f'创建失败: {e}')

    return jsonify({'success': True})


@bp.route('/api/rename', methods=['PUT'])
@require_password
def rename():
    data = request.get_json(silent=True) or {}
    sub = (data.get('path') or '').strip()
    name = (data.get('name') or '').strip()
    new_name = (data.get('newName') or '').strip()
    if not name or not new_name:
        raise BadRequestError('参数不完整')

    safe_new = safe_name(new_name)
    base = current_app.config['UPLOAD_DIR']
    fp = resolve(base, sub)
    if fp is None:
        raise BadRequestError('非法路径')

    src = os.path.join(fp, name)
    if not os.path.exists(src):
        raise NotFoundError('文件或文件夹不存在')

    dst = _unique_target(fp, safe_new)
    os.rename(src, dst)
    return jsonify({'success': True, 'name': os.path.basename(dst)})


@bp.route('/api/save', methods=['PUT'])
@require_password
def save():
    data = request.get_json(silent=True) or {}
    sub = (data.get('path') or '').strip()
    name = (data.get('name') or '').strip()
    content = data.get('content')

    if not name or content is None:
        raise BadRequestError('参数不完整')

    base = current_app.config['UPLOAD_DIR']
    fp = resolve(base, sub)
    if fp is None:
        raise BadRequestError('非法路径')
    target = os.path.join(fp, name)
    if not os.path.exists(target) or not os.path.isfile(target):
        raise NotFoundError('文件不存在')

    try:
        with open(target, 'w', encoding='utf-8') as f:
            f.write(content)
    except OSError as e:
        raise BadRequestError(f'保存失败: {e}')

    return jsonify({'success': True})


@bp.route('/api/delete', methods=['DELETE'])
@require_password
def delete():
    data = request.get_json(silent=True) or {}
    sub = (data.get('path') or '').strip()
    name = (data.get('name') or '').strip()
    if not name:
        raise BadRequestError('参数不完整')

    base = current_app.config['UPLOAD_DIR']
    fp = resolve(base, sub)
    if fp is None:
        raise BadRequestError('非法路径')
    target = os.path.join(fp, name)
    if not os.path.exists(target):
        raise NotFoundError('文件或文件夹不存在')

    if os.path.isdir(target):
        try:
            os.rmdir(target)
        except OSError:
            raise BadRequestError('文件夹非空，无法删除')
    else:
        os.remove(target)

    return jsonify({'success': True})


@bp.route('/api/order', methods=['PUT'])
@require_password
def save_order():
    data = request.get_json(silent=True) or {}
    sub = (data.get('path') or '').strip()
    order = data.get('order', [])
    if not isinstance(order, list):
        raise BadRequestError('参数错误')

    base = current_app.config['UPLOAD_DIR']
    fp = resolve(base, sub)
    if fp is None:
        raise BadRequestError('非法路径')

    order_file = os.path.join(fp, '.filehub_order')
    try:
        with open(order_file, 'w', encoding='utf-8') as f:
            json.dump(order, f, ensure_ascii=False)
    except OSError as e:
        raise BadRequestError(f'保存失败: {e}')

    return jsonify({'success': True})
