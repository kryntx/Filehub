import logging
import sys
from logging.handlers import RotatingFileHandler


def setup_logging(app, log_level: str, log_file: str) -> None:
    """Configure structured logging for the Flask application."""
    app.logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    formatter = logging.Formatter(
        '[%(asctime)s] %(levelname)s %(module)s: %(message)s',
        datefmt='%Y-%m-%dT%H:%M:%S',
    )

    # Console handler
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(formatter)
    app.logger.addHandler(console)

    # File handler (optional)
    if log_file:
        file_handler = RotatingFileHandler(
            log_file, maxBytes=10 * 1024 * 1024, backupCount=5, encoding='utf-8'
        )
        file_handler.setFormatter(formatter)
        app.logger.addHandler(file_handler)

    # Quiet werkzeug access logs unless debug
    if log_level.upper() != 'DEBUG':
        logging.getLogger('werkzeug').setLevel(logging.WARNING)
