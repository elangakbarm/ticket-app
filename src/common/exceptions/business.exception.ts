import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(
    message: string,
    code: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: unknown[],
  ) {
    super({ message, code, details }, status);
  }
}

export class ConflictException extends BusinessException {
  constructor(message: string, code = 'CONFLICT', details?: unknown[]) {
    super(message, code, HttpStatus.CONFLICT, details);
  }
}

export class NotFoundException extends BusinessException {
  constructor(message: string, code = 'NOT_FOUND', details?: unknown[]) {
    super(message, code, HttpStatus.NOT_FOUND, details);
  }
}

export class ForbiddenException extends BusinessException {
  constructor(message: string, code = 'FORBIDDEN', details?: unknown[]) {
    super(message, code, HttpStatus.FORBIDDEN, details);
  }
}

export class UnauthorizedException extends BusinessException {
  constructor(message: string, code = 'UNAUTHORIZED', details?: unknown[]) {
    super(message, code, HttpStatus.UNAUTHORIZED, details);
  }
}
