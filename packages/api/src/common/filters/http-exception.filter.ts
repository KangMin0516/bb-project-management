import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

/**
 * Routes that must emit RFC-6749 §5.2 error shape
 * (`{ error, error_description }`) instead of the project-wide
 * `{ success: false, message, ... }` wrapper. OAuth clients
 * (claude.ai web, ChatGPT connectors) parse the standard shape only;
 * the wrapper would otherwise look like a generic 4xx and break
 * automatic refresh / re-consent flows.
 */
const OAUTH_PATH_PREFIX = '/api/oauth/';
const OAUTH_STATUS_TO_ERROR: Record<number, string> = {
  400: 'invalid_request',
  401: 'invalid_client',
  403: 'access_denied',
  404: 'invalid_request',
  429: 'temporarily_unavailable',
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message =
        typeof res === 'string'
          ? res
          : ((res as Record<string, unknown>).message as string | string[]);
    } else if (exception instanceof PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          message = 'A record with this value already exists';
          break;
        case 'P2003':
          status = HttpStatus.BAD_REQUEST;
          message = 'Referenced record does not exist';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'Record not found';
          break;
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    }

    // OAuth endpoints must respond in RFC 6749 §5.2 shape.
    if (request.path?.startsWith(OAUTH_PATH_PREFIX)) {
      const error = OAUTH_STATUS_TO_ERROR[status] ?? 'server_error';
      const description = Array.isArray(message) ? message.join('; ') : message;
      response.status(status).json({
        error,
        error_description: description,
      });
      return;
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
