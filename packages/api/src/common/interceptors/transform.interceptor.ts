import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, Observable } from 'rxjs';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Mark a route as returning a raw response body that should NOT be
 * wrapped in `{ success, data }`. Use on standards-bound endpoints
 * (OAuth metadata, token, register) whose shape is fixed by RFC.
 *
 *     @RawResponse()
 *     @Get('.well-known/oauth-authorization-server')
 */
export const RAW_RESPONSE_KEY = 'raw_response';
export const RawResponse = (): MethodDecorator & ClassDecorator =>
  SetMetadata(RAW_RESPONSE_KEY, true);

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, T | ApiResponse<T>>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<T | ApiResponse<T>> {
    const isRaw = this.reflector.getAllAndOverride<boolean>(
      RAW_RESPONSE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isRaw) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data: T) => ({
        success: true,
        data,
      })),
    );
  }
}
