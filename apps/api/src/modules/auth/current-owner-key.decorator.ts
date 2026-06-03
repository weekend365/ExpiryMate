import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "./auth.types";

export const CurrentOwnerKey = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user?.ownerKey) {
      throw new UnauthorizedException("로그인이 필요합니다.");
    }

    return request.user.ownerKey;
  },
);
