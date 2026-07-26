import os

class Config:
    UPLOAD_DIR: str = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
    PASSWORD: str = os.environ.get('UPLOAD_PASSWORD', '8888')
    PREVIEW_MAX: int = 1024 * 1024  # 1 MB
    URL_DOWNLOAD_TIMEOUT: int = 300  # seconds
    URL_DOWNLOAD_MAX_SIZE: int = 1024 * 1024 * 1024  # 1 GB
    LOG_LEVEL: str = os.environ.get('LOG_LEVEL', 'INFO')
    LOG_FILE: str = os.environ.get('LOG_FILE', '')  # empty = console only
