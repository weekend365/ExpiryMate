import { HttpException } from "@nestjs/common";

export class CodedHttpException extends HttpException {
  constructor(
    status: number,
    readonly errorCode: string,
    message: string,
    readonly safeDetails?: unknown,
  ) {
    super({ message, code: errorCode, details: safeDetails }, status);
  }
}
