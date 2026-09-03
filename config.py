import os

class Config:
    UPLOAD_DIR: str = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')

    # Password is never stored in plaintext. The hash string is
    # pbkdf2_sha256$iterations$salt$digest and defaults to the hash of the
    # built-in password. Override via PASSWORD_HASH, or set UPLOAD_PASSWORD
    # (hashed once at startup) in create_app.
    PASSWORD_HASH: str = os.environ.get(
        'PASSWORD_HASH',
        'pbkdf2_sha256$200000$7fa60007e1b21be13fee3a981b18f3c3$892f4be9801a676aa1e4e75d200e578074e35e8778144fcce7dc84409b8e78ac')

    # Auth hardening: per-IP failed attempts before temporary lockout
    AUTH_MAX_ATTEMPTS: int = 5
    AUTH_LOCKOUT_SECONDS: int = 15 * 60

    PREVIEW_MAX: int = 1024 * 1024  # 1 MB
    URL_DOWNLOAD_TIMEOUT: int = 300  # seconds
    URL_DOWNLOAD_MAX_SIZE: int = 1024 * 1024 * 1024  # 1 GB
    LOG_LEVEL: str = os.environ.get('LOG_LEVEL', 'INFO')
    LOG_FILE: str = os.environ.get('LOG_FILE', '')  # empty = console only
