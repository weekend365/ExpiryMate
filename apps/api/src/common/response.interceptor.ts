import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { map, Observable } from "rxjs";

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<{ success: true; data: T }> {
    return next.handle().pipe(
      map((data) => {
        if (
          data &&
          typeof data === "object" &&
          "success" in (data as Record<string, unknown>)
        ) {
          return data as unknown as { success: true; data: T };
        }

        return {
          success: true as const,
          data,
        };
      }),
    );
  }
}
