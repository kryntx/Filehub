import os
import re
import time
import io
import zipfile
import urllib.request
import urllib.parse
from flask import Flask, jsonify, request, send_file, send_from_directory

app = Flask(__name__, static_folder='.', static_url_path='')

BASE = os.path.join(os.path.dirname(__file__), 'uploads')
PASSWORD = os.environ.get('UPLOAD_PASSWORD', '8888')
PREVIEW_MAX = 1024 * 1024

TEXT_EXTS = {
    '.txt', '.md', '.json', '.js', '.jsx', '.ts', '.tsx',
    '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp',
    '.css', '.scss', '.less', '.html', '.htm', '.xml', '.yaml', '.yml', '.toml',
    '.ini', '.cfg', '.conf', '.sh', '.bash', '.zsh', '.fish',
    '.bat', '.cmd', '.ps1', '.env', '.gitignore', '.dockerignore',
    '.sql', '.r', '.m', '.swift', '.kt', '.log', '.csv', '.tsv',
    '.pl', '.pm', '.lua', '.vim', '.tex', '.rst', '.php',
    '.vue', '.svelte', '.coffee', '.diff', '.patch',
}

os.makedirs(BASE, exist_ok=True)

# ─── helpers ───

def resolve(subpath=''):
    """Resolve a subpath to an absolute path, guaranteed under BASE."""
    if not subpath:
        return BASE
    p = os.path.normpath(os.path.join(BASE, subpath.lstrip('/')))
    if not p.startswith(os.path.normpath(BASE) + os.sep) and p != os.path.normpath(BASE):
        return None
    return p

def safe_name(name):
    return re.sub(r'[/\\\0]', '_', name)

def check_pwd(req):
    return req.headers.get('x-upload-password') == PASSWORD

# ─── routes ───

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/files')
def list_files():
    sub = request.args.get('path', '') or ''
    fp = resolve(sub)
    if fp is None:
        return jsonify({'error': '非法路径'}), 400
    if not os.path.exists(fp):
        return jsonify({'error': '目录不存在'}), 404
    if not os.path.isdir(fp):
        return jsonify({'error': '不是目录'}), 400

    try:
        items = []
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
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download/<path:filename>')
def download(filename):
    fp = resolve(os.path.dirname(filename))
    if fp is None:
        return jsonify({'error': '非法路径'}), 400
    safe = os.path.basename(filename)
    target = os.path.join(fp, safe)
    if not os.path.exists(target) or not os.path.isfile(target):
        return jsonify({'error': '文件不存在'}), 404
    return send_file(target, as_attachment=True, download_name=safe)

@app.route('/api/preview/<path:filename>')
def preview(filename):
    fp = resolve(os.path.dirname(filename))
    if fp is None:
        return jsonify({'error': '非法路径'}), 400
    safe = os.path.basename(filename)
    target = os.path.join(fp, safe)
    if not os.path.exists(target) or not os.path.isfile(target):
        return jsonify({'error': '文件不存在'}), 404

    _, ext = os.path.splitext(safe)
    if ext.lower() not in TEXT_EXTS:
        return jsonify({'error': '不支持预览该文件类型'}), 400

    stat = os.stat(target)
    truncated = stat.st_size > PREVIEW_MAX
    try:
        with open(target, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read(PREVIEW_MAX)
    except Exception:
        return jsonify({'error': '无法读取文件'}), 500

    return jsonify({'content': content, 'truncated': truncated, 'size': stat.st_size})

@app.route('/api/upload', methods=['POST'])
def upload():
    if not check_pwd(request):
        return jsonify({'error': '密码错误'}), 403
    sub = (request.form.get('path') or '').strip()
    fp = resolve(sub)
    if fp is None:
        return jsonify({'error': '非法路径'}), 400
    os.makedirs(fp, exist_ok=True)

    if 'file' not in request.files:
        return jsonify({'error': '请选择文件'}), 400
    f = request.files['file']
    if f.filename == '':
        return jsonify({'error': '请选择文件'}), 400

    safe = safe_name(f.filename)
    root, ext = os.path.splitext(safe)
    target = os.path.join(fp, safe)
    counter = 1
    while os.path.exists(target):
        target = os.path.join(fp, f"{root}_{counter}{ext}")
        counter += 1

    f.save(target)
    rel = os.path.join(sub, os.path.basename(target)).replace('\\', '/')
    return jsonify({'success': True, 'file': rel})

@app.route('/api/upload-url', methods=['POST'])
def upload_url():
    if not check_pwd(request):
        return jsonify({'error': '密码错误'}), 403
    data = request.get_json(silent=True) or {}
    url = (data.get('url') or '').strip()
    sub = (data.get('path') or '').strip()
    if not url:
        return jsonify({'error': '请输入下载链接'}), 400

    fp = resolve(sub)
    if fp is None:
        return jsonify({'error': '非法路径'}), 400
    os.makedirs(fp, exist_ok=True)

    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=300) as resp:
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
        root, ext = os.path.splitext(safe)
        target = os.path.join(fp, safe)
        counter = 1
        while os.path.exists(target):
            target = os.path.join(fp, f"{root}_{counter}{ext}")
            counter += 1

        with open(target, 'wb') as f:
            f.write(content)

        return jsonify({'success': True, 'file': os.path.basename(target)})
    except Exception as e:
        return jsonify({'error': f'下载失败: {str(e)}'}), 500

@app.route('/api/download-zip')
def download_zip():
    sub = request.args.get('path', '')
    fp = resolve(sub)
    if fp is None:
        return jsonify({'error': '非法路径'}), 400
    if not os.path.isdir(fp):
        return jsonify({'error': '不是文件夹'}), 400

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

@app.route('/api/mkdir', methods=['POST'])
def mkdir():
    if not check_pwd(request):
        return jsonify({'error': '密码错误'}), 403
    data = request.get_json(silent=True) or {}
    sub = (data.get('path') or '').strip()
    name = safe_name((data.get('name') or '').strip())
    if not name:
        return jsonify({'error': '请输入文件夹名称'}), 400

    fp = resolve(sub)
    if fp is None:
        return jsonify({'error': '非法路径'}), 400
    target = os.path.join(fp, name)
    if os.path.exists(target):
        return jsonify({'error': '已存在同名文件或文件夹'}), 400

    os.makedirs(target, exist_ok=False)
    return jsonify({'success': True})

@app.route('/api/newfile', methods=['POST'])
def newfile():
    if not check_pwd(request):
        return jsonify({'error': '密码错误'}), 403
    data = request.get_json(silent=True) or {}
    sub = (data.get('path') or '').strip()
    name = safe_name((data.get('name') or '').strip())
    if not name:
        return jsonify({'error': '请输入文件名'}), 400

    fp = resolve(sub)
    if fp is None:
        return jsonify({'error': '非法路径'}), 400
    target = os.path.join(fp, name)
    if os.path.exists(target):
        return jsonify({'error': '已存在同名文件或文件夹'}), 400

    try:
        open(target, 'w').close()
    except Exception as e:
        return jsonify({'error': f'创建失败: {str(e)}'}), 500

    return jsonify({'success': True})

@app.route('/api/rename', methods=['PUT'])
def rename():
    if not check_pwd(request):
        return jsonify({'error': '密码错误'}), 403
    data = request.get_json(silent=True) or {}
    sub = (data.get('path') or '').strip()
    name = (data.get('name') or '').strip()
    new_name = (data.get('newName') or '').strip()
    if not name or not new_name:
        return jsonify({'error': '参数不完整'}), 400

    safe_new = safe_name(new_name)

    fp = resolve(sub)
    if fp is None:
        return jsonify({'error': '非法路径'}), 400
    src = os.path.join(fp, name)
    if not os.path.exists(src):
        return jsonify({'error': '文件或文件夹不存在'}), 404

    dst = os.path.join(fp, safe_new)
    if os.path.exists(dst):
        root, ext = os.path.splitext(safe_new)
        counter = 1
        while os.path.exists(dst):
            dst = os.path.join(fp, f"{root}_{counter}{ext}")
            counter += 1

    os.rename(src, dst)
    return jsonify({'success': True, 'name': os.path.basename(dst)})

@app.route('/api/save', methods=['PUT'])
def save():
    if not check_pwd(request):
        return jsonify({'error': '密码错误'}), 403
    data = request.get_json(silent=True) or {}
    sub = (data.get('path') or '').strip()
    name = (data.get('name') or '').strip()
    content = data.get('content')

    if not name or content is None:
        return jsonify({'error': '参数不完整'}), 400

    fp = resolve(sub)
    if fp is None:
        return jsonify({'error': '非法路径'}), 400
    target = os.path.join(fp, name)
    if not os.path.exists(target) or not os.path.isfile(target):
        return jsonify({'error': '文件不存在'}), 404

    try:
        with open(target, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        return jsonify({'error': f'保存失败: {str(e)}'}), 500

    return jsonify({'success': True})

@app.route('/api/delete', methods=['DELETE'])
def delete():
    if not check_pwd(request):
        return jsonify({'error': '密码错误'}), 403
    data = request.get_json(silent=True) or {}
    sub = (data.get('path') or '').strip()
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': '参数不完整'}), 400

    fp = resolve(sub)
    if fp is None:
        return jsonify({'error': '非法路径'}), 400
    target = os.path.join(fp, name)
    if not os.path.exists(target):
        return jsonify({'error': '文件或文件夹不存在'}), 404

    if os.path.isdir(target):
        try:
            os.rmdir(target)  # only empty dirs
        except OSError:
            return jsonify({'error': '文件夹非空，无法删除'}), 400
    else:
        os.remove(target)

    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8888, debug=False, threaded=True)
