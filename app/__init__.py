"""Flask application factory."""

import os

from flask import Flask, send_from_directory

from config import Config
from app.errors import register_error_handlers
from app.security import RateLimiter, hash_password
from app.utils.logging import setup_logging


def create_app(config: type = Config) -> Flask:
    app = Flask(__name__, static_folder='../static', static_url_path='')
    app.config.from_object(config)

    # Plaintext env override is hashed once at startup; never kept in config
    plain = os.environ.get('UPLOAD_PASSWORD')
    if plain is not None:
        app.config['PASSWORD_HASH'] = hash_password(plain)

    # Per-IP failed-attempt limiter shared by all auth-required routes
    app.config['AUTH_RATE_LIMITER'] = RateLimiter(
        app.config['AUTH_MAX_ATTEMPTS'], app.config['AUTH_LOCKOUT_SECONDS'])

    # Ensure upload directory exists
    os.makedirs(app.config['UPLOAD_DIR'], exist_ok=True)

    # Structured logging
    setup_logging(app, app.config['LOG_LEVEL'], app.config['LOG_FILE'])

    # Global error handlers
    register_error_handlers(app)

    # Register blueprints
    from app.routes.files import bp as files_bp
    from app.routes.upload import bp as upload_bp
    from app.routes.admin import bp as admin_bp
    from app.routes.realtime import bp as realtime_bp

    app.register_blueprint(files_bp)
    app.register_blueprint(upload_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(realtime_bp)

    # Serve index.html at root
    @app.route('/')
    def index():
        return send_from_directory(app.static_folder, 'index.html')

    app.logger.info('FileHub application initialized')
    return app
