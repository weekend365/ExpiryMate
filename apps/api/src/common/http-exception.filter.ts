import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import * as Sentry from "@sentry/node";
import { MulterError } from "multer";
import { CodedHttpException } from "./coded-http.exception";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(caughtException: unknown, host: ArgumentsHost) {
    // Nest's multipart adapter does not yet map Multer 2.3's field-shape
    // validation errors. Treat them as client errors without echoing field names.
    const exception = caughtException instanceof MulterError && [
      "LIMIT_FIELD_NESTING", "LIMIT_FIELD_ARRAY_INDEX", "INVALID_FIELD_NAME",
    ].includes(caughtException.code)
      ? new BadRequestException("사진 업로드 요청 형식을 확인해 주세요.")
      : caughtException;
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest<{ url?: string; originalUrl?: string; path?: string }>();
    const includeDetails = process.env.NODE_ENV !== "production";
    const shouldReportToSentry =
      Boolean(process.env.SENTRY_DSN?.trim()) &&
      !isOperationalProbeRequest(request);

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR && shouldReportToSentry) {
        Sentry.captureException(exception);
      }
      const payload = exception.getResponse();
      const details =
        typeof payload === "object" && payload !== null ? payload : undefined;
      const coded = exception instanceof CodedHttpException;
      const error: {
        code: string;
        message: string;
        details?: unknown;
      } = {
        code: coded ? exception.errorCode : `HTTP_${status}`,
        message: exception.message,
      };

      if (coded && exception.safeDetails !== undefined) {
        error.details = exception.safeDetails;
      } else if (includeDetails && details) {
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

    if (shouldReportToSentry) {
      Sentry.captureException(exception);
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error,
    });
  }
}

/** Liveness/readiness probes intentionally return 5xx when deps are down — not app bugs. */
function isOperationalProbeRequest(request: {
  url?: string;
  originalUrl?: string;
  path?: string;
}) {
  const rawPath = request.path ?? request.originalUrl ?? request.url ?? "";
  const path = rawPath.split("?")[0] ?? "";
  return path === "/ready" || path === "/health";
}
