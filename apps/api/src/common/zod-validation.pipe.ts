import {
  BadRequestException,
  type PipeTransform,
} from "@nestjs/common";

type ZodIssueLike = {
  path: PropertyKey[];
  message: string;
};

type ZodSchemaLike<T> = {
  safeParse: (
    data: unknown,
  ) =>
    | { success: true; data: T }
    | { success: false; error: { issues: ZodIssueLike[] } };
};

/**
 * Nest adapter for @expirymate/shared zod contracts (P2-01).
 * Prefer this over parallel class-validator DTOs for write payloads.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchemaLike<T>) {}

  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value ?? {});

    if (!parsed.success) {
      throw new BadRequestException({
        message: "입력값을 다시 확인해 주세요.",
        errors: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    return parsed.data;
  }
}
