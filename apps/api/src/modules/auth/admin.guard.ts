import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AuthGuard } from "./auth.guard";
import type { AuthenticatedRequest } from "./auth.types";

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly authGuard: AuthGuard) {}

  canActivate(context: ExecutionContext): boolean {
    this.authGuard.canActivate(context);

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.user?.role !== UserRole.admin) {
      throw new ForbiddenException("관리자 권한이 필요합니다.");
    }

    return true;
  }
}
