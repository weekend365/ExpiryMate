import {
  BadRequestException,
  HttpStatus,
  type ArgumentsHost,
} from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpExceptionFilter } from "./http-exception.filter";

describe("HttpExceptionFilter", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    restoreEnv("NODE_ENV", originalNodeEnv);
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
});

function createHttpHost() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
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
