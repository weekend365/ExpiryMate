import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  AUTH_RATE_LIMIT_METADATA,
  type AuthRateLimitPolicy,
} from "./auth-rate-limit.decorator";
import { AuthRateLimitService } from "./auth-rate-limit.service";

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: AuthRateLimitService,
  ) {}

  canActivate(context: ExecutionContext) {
    const policy = this.reflector.getAllAndOverride<AuthRateLimitPolicy>(
      AUTH_RATE_LIMIT_METADATA,
      [context.getHandler(), context.getClass()],
    );

    if (!policy) {
      return true;
    }

    this.rateLimitService.assertAllowed(
      policy,
      context.switchToHttp().getRequest(),
    );

    return true;
  }
}
