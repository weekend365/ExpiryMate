import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { isRetryableTransactionError } from "./prisma-errors";

describe("isRetryableTransactionError", () => {
  it.each(["P2034", "P2002"])("retries Prisma %s", (code) => {
    const error = new Prisma.PrismaClientKnownRequestError("conflict", {
      code, clientVersion: "test",
    });
    expect(isRetryableTransactionError(error)).toBe(true);
  });

  it.each(["P2025", "P2003", "P1001"])("does not retry Prisma %s", (code) => {
    const error = new Prisma.PrismaClientKnownRequestError("failure", {
      code, clientVersion: "test",
    });
    expect(isRetryableTransactionError(error)).toBe(false);
  });

  it.each([null, undefined, "P2034", { code: "P2034" }, new Error("P2002")])(
    "does not retry non-Prisma error %j",
    (error) => expect(isRetryableTransactionError(error)).toBe(false),
  );
});
