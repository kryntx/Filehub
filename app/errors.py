"""Custom application exceptions and Flask error handlers."""

from flask import jsonify


class AppError(Exception):
    """Base application error with HTTP status code."""

    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status = status


class AuthError(AppError):
    """Authentication / authorization failure."""

    def __init__(self, message: str = '密码错误') -> None:
        super().__init__(message, 403)


class NotFoundError(AppError):
    """Resource not found."""

    def __init__(self, message: str = '资源不存在') -> None:
        super().__init__(message, 404)


class BadRequestError(AppError):
    """Invalid request parameters."""

    def __init__(self, message: str = '请求参数无效') -> None:
        super().__init__(message, 400)


def register_error_handlers(app):
    """Register global error handlers on the Flask app."""

    @app.errorhandler(AppError)
    def _handle_app_error(e: AppError):
        return jsonify({'error': e.message}), e.status

    @app.errorhandler(404)
    def _handle_404(e):
        return jsonify({'error': '接口不存在'}), 404

    @app.errorhandler(405)
    def _handle_405(e):
        return jsonify({'error': '请求方法不允许'}), 405

    @app.errorhandler(500)
    def _handle_500(e):
        app.logger.exception('Internal server error')
        return jsonify({'error': '服务器内部错误'}), 500
