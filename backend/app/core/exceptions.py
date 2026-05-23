from http import HTTPStatus


class AppException(Exception):
    status_code: int = HTTPStatus.INTERNAL_SERVER_ERROR
    detail: str = "An unexpected error occurred"

    def __init__(self, detail: str | None = None):
        self.detail = detail or self.__class__.detail
        super().__init__(self.detail)


class NotFoundException(AppException):
    status_code = HTTPStatus.NOT_FOUND
    detail = "Resource not found"


class ForbiddenException(AppException):
    status_code = HTTPStatus.FORBIDDEN
    detail = "Access denied"


class ConflictException(AppException):
    status_code = HTTPStatus.CONFLICT
    detail = "Resource already exists"


class BadRequestException(AppException):
    status_code = HTTPStatus.BAD_REQUEST
    detail = "Invalid request"


class UnauthorizedException(AppException):
    status_code = HTTPStatus.UNAUTHORIZED
    detail = "Unauthorized"
