import {
  BadRequestException,
  HttpStatus,
  ServiceUnavailableException,
  type ArgumentsHost,
} from "@nestjs/common";
import * as Sentry from "@sentry/node";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpExceptionFilter } from "./http-exception.filter";

vi.mock("@sentry/node", () => ({
  captureException: vi.fn(),
}));

describe("HttpExceptionFilter", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSentryDsn = process.env.SENTRY_DSN;

  afterEach(() => {
    restoreEnv("NODE_ENV", originalNodeEnv);
    restoreEnv("SENTRY_DSN", originalSentryDsn);
    vi.mocked(Sentry.captureException).mockClear();
  });

  it("removes HTTP exception details in production", () => {
    process.env.NODE_ENV = "production";
    const { host, response } = createHttpHost();

    new HttpExceptionFilter().catch(
      new BadRequestException({
        message: "잘못된 요청입니다.",
        detail: "private validation detail",
      }),
      host,
    );

    const body = response.json.mock.calls[0]?.[0];
    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(body.error).not.toHaveProperty("details");
  });

  it("includes HTTP exception details outside production", () => {
    process.env.NODE_ENV = "development";
    const { host, response } = createHttpHost();

    new HttpExceptionFilter().catch(
      new BadRequestException({
        message: "잘못된 요청입니다.",
        detail: "validation detail",
      }),
      host,
    );

    const body = response.json.mock.calls[0]?.[0];
    expect(body.error.details).toMatchObject({
      detail: "validation detail",
    });
  });

  it("removes unhandled exception details in production", () => {
    process.env.NODE_ENV = "production";
    const { host, response } = createHttpHost();

    new HttpExceptionFilter().catch(new Error("database password leaked"), host);

    const body = response.json.mock.calls[0]?.[0];
    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(body.error).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: "서버 오류가 발생했습니다.",
    });
  });

  it("includes unhandled exception details outside production", () => {
    process.env.NODE_ENV = "development";
    const { host, response } = createHttpHost();

    new HttpExceptionFilter().catch(new Error("debug detail"), host);

    const body = response.json.mock.calls[0]?.[0];
    expect(body.error.details).toBe("debug detail");
  });

  it("does not report readiness probe 503s to Sentry", () => {
    process.env.SENTRY_DSN = "https://examplePublicKey@o0.ingest.sentry.io/0";
    const { host, response } = createHttpHost("/ready");

    new HttpExceptionFilter().catch(
      new ServiceUnavailableException({
        status: "not_ready",
        message: "Database is unavailable.",
      }),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("still reports non-probe 5xx exceptions to Sentry", () => {
    process.env.SENTRY_DSN = "https://examplePublicKey@o0.ingest.sentry.io/0";
    const { host } = createHttpHost("/auth/login");
    const exception = new ServiceUnavailableException("메일 전송에 실패했습니다.");

    new HttpExceptionFilter().catch(exception, host);

    expect(Sentry.captureException).toHaveBeenCalledWith(exception);
  });
});

function createHttpHost(path = "/auth/login") {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({
        path,
        originalUrl: path,
        url: path,
      }),
    }),
  } as unknown as ArgumentsHost;

  return { host, response };
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
