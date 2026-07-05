import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import * as Sentry from "@sentry/node";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const includeDetails = process.env.NODE_ENV !== "production";

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR && process.env.SENTRY_DSN?.trim()) {
        Sentry.captureException(exception);
      }
      const payload = exception.getResponse();
      const details =
        typeof payload === "object" && payload !== null ? payload : undefined;
      const error: {
        code: string;
        message: string;
        details?: unknown;
      } = {
        code: `HTTP_${status}`,
        message: exception.message,
      };

      if (includeDetails && details) {
        error.details = details;
      }

      response.status(status).json({
        success: false,
        error,
      });
      return;
    }

    const error: {
      code: string;
      message: string;
      details?: string;
    } = {
      code: "INTERNAL_SERVER_ERROR",
      message: "서버 오류가 발생했습니다.",
    };

    if (includeDetails) {
      error.details =
        exception instanceof Error ? exception.message : "Unknown exception";
    }

    if (process.env.SENTRY_DSN?.trim()) {
      Sentry.captureException(exception);
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error,
    });
  }
}
