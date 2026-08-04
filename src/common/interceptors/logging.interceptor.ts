import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { CORRELATION_ID_HEADER } from '../constants';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, user } = request;

    const correlationId =
      (request.headers[CORRELATION_ID_HEADER] as string) || uuidv4();
    request.correlationId = correlationId;
    response.setHeader(CORRELATION_ID_HEADER, correlationId);

    const startTime = Date.now();
    const userPublicId = user?.publicId || 'anonymous';

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.log(
            `${method} ${url} ${response.statusCode} ${duration}ms ` +
              `[${correlationId}] user=${userPublicId}`,
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            `${method} ${url} ERROR ${duration}ms [${correlationId}] ` +
              `user=${userPublicId} - ${error.message}`,
          );
        },
      }),
    );
  }
}
