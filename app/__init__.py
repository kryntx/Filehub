"""Flask application factory."""

import os

from flask import Flask, send_from_directory

from config import Config
from app.errors import register_error_handlers
from app.utils.logging import setup_logging


def create_app(config: type = Config) -> Flask:
    app = Flask(__name__, static_folder='../static', static_url_path='')
    app.config.from_object(config)

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

    app.register_blueprint(files_bp)
    app.register_blueprint(upload_bp)
    app.register_blueprint(admin_bp)

    # Serve index.html at root
    @app.route('/')
    def index():
        return send_from_directory(app.static_folder, 'index.html')

    app.logger.info('FileHub application initialized')
    return app
