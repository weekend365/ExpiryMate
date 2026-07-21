import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { AccountType } from "@prisma/client";
import { AuthGuard } from "./auth.guard";
import type { AuthenticatedRequest } from "./auth.types";

/**
 * Requires a registered account. Blocks anonymous (and any non-registered) tokens
 * on cost-bearing / mutation routes even if the JWT still verifies.
 */
@Injectable()
export class RegisteredGuard implements CanActivate {
  constructor(private readonly authGuard: AuthGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await this.authGuard.canActivate(context);

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.user?.accountType !== AccountType.registered) {
      throw new ForbiddenException(
        "계정으로 로그인한 뒤에 이어서 할 수 있어요.",
      );
    }

    return true;
  }
}
