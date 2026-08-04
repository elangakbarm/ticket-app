import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../interfaces';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'success' in data) {
          return data as ApiResponse<T>;
        }

        const response: ApiResponse<T> = {
          success: true,
          message: 'Request processed successfully',
          timestamp: new Date().toISOString(),
        };

        if (data && typeof data === 'object') {
          if ('data' in data) {
            response.message = (data as { message?: string }).message || response.message;
            response.data = (data as { data: T }).data;
            if ('meta' in data) {
              response.meta = (data as { meta: ApiResponse<T>['meta'] }).meta;
            }
          } else {
            response.data = data as T;
          }
        }

        return response;
      }),
    );
  }
}
