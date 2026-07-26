import os
import re


def resolve(base_dir: str, subpath: str = '') -> str | None:
    """Resolve a subpath under base_dir. Returns None if path traversal detected."""
    if not subpath:
        return base_dir
    p = os.path.normpath(os.path.join(base_dir, subpath.lstrip('/')))
    norm_base = os.path.normpath(base_dir) + os.sep
    if not p.startswith(norm_base) and p != os.path.normpath(base_dir):
        return None
    return p


def safe_name(name: str) -> str:
    """Sanitize a filename by replacing path separators and null bytes."""
    return re.sub(r'[/\\\0]', '_', name)
