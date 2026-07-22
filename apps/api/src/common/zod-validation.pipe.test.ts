import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { ZodValidationPipe } from "./zod-validation.pipe";

describe("ZodValidationPipe", () => {
  const schema = {
    safeParse(data: unknown) {
      if (
        typeof data === "object" &&
        data !== null &&
        "name" in data &&
        typeof (data as { name: unknown }).name === "string" &&
        (data as { name: string }).name.length > 0 &&
        (data as { name: string }).name.length <= 8
      ) {
        return {
          success: true as const,
          data: { name: (data as { name: string }).name },
        };
      }

      return {
        success: false as const,
        error: {
          issues: [{ path: ["name"], message: "invalid" }],
        },
      };
    },
  };

  it("returns parsed data for valid input", () => {
    const pipe = new ZodValidationPipe(schema);
    expect(pipe.transform({ name: "milk" })).toEqual({ name: "milk" });
  });

  it("throws BadRequestException for invalid input", () => {
    const pipe = new ZodValidationPipe(schema);
    expect(() => pipe.transform({ name: "" })).toThrow(BadRequestException);
  });
});
