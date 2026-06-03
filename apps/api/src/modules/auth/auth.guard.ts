import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import type { AuthenticatedRequest } from "./auth.types";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = readHeader(request, "authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : null;

    if (token) {
      request.user = this.authService.verifyAccessToken(token);
      return true;
    }

    const devUser = this.authService.getDevFallbackUser();

    if (devUser) {
      request.user = devUser;
      return true;
    }

    throw new UnauthorizedException("로그인이 필요합니다.");
  }
}

function readHeader(request: AuthenticatedRequest, key: string) {
  const value = request.headers[key];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
