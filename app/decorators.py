"""Route decorators for auth and validation."""

from functools import wraps

from flask import current_app, request

from app.errors import AuthError
from app.security import verify_password


def require_password(f):
    """Decorator that enforces x-upload-password header check with
    hash verification and per-IP failed-attempt lockout."""

    @wraps(f)
    def wrapper(*args, **kwargs):
        ip = request.remote_addr or 'unknown'
        limiter = current_app.config['AUTH_RATE_LIMITER']

        if limiter.is_locked(ip):
            raise AuthError('尝试次数过多，已被暂时锁定，请稍后再试')

        attempt = request.headers.get('x-upload-password', '')
        if not verify_password(attempt, current_app.config['PASSWORD_HASH']):
            locked, left = limiter.register_failure(ip)
            if locked:
                raise AuthError('密码错误，尝试次数已用尽，已被暂时锁定')
            raise AuthError(f'密码错误，还可尝试 {left} 次')
        limiter.reset(ip)
        return f(*args, **kwargs)

    return wrapper
