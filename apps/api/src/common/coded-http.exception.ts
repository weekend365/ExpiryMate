import { HttpException } from "@nestjs/common";

export class CodedHttpException extends HttpException {
  readonly errorCode: string;

  constructor(
    status: number,
    errorCode: string,
    message: string,
    readonly safeDetails?: unknown,
  ) {
    super({ message, code: errorCode, details: safeDetails }, status);
    this.errorCode = errorCode;
  }
}
