"""Route decorators for auth and validation."""

from functools import wraps

from flask import current_app, request

from app.errors import AuthError


def require_password(f):
    """Decorator that enforces x-upload-password header check."""

    @wraps(f)
    def wrapper(*args, **kwargs):
        if request.headers.get('x-upload-password') != current_app.config['PASSWORD']:
            raise AuthError()
        return f(*args, **kwargs)

    return wrapper
