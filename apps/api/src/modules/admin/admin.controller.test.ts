import "reflect-metadata";
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { GUARDS_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { describe, expect, it, vi } from "vitest";
import { AdminGuard } from "../auth/admin.guard";
import { AdminController } from "./admin.controller";

describe("Admin reporting route", () => {
  it("retains the existing route and administrator guard", () => {
    expect(Reflect.getMetadata(PATH_METADATA, AdminController)).toBe("admin");
    expect(Reflect.getMetadata(PATH_METADATA, AdminController.prototype.getMonetizationOverview)).toBe("monetization/overview");
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminController)).toEqual([AdminGuard]);
  });

  it("routes report requests to the reporting service with the existing query conversion", async () => {
    const report = { period: { days: 7 } };
    const reporting = { getMonetizationOverview: vi.fn().mockResolvedValue(report) };
    const controller = new AdminController({} as never, {} as never, reporting as never);
    await expect(controller.getMonetizationOverview("7")).resolves.toBe(report);
    expect(reporting.getMonetizationOverview).toHaveBeenLastCalledWith(7);
    await controller.getMonetizationOverview();
    expect(reporting.getMonetizationOverview).toHaveBeenLastCalledWith(undefined);
    await controller.getMonetizationOverview("invalid");
    expect(reporting.getMonetizationOverview).toHaveBeenLastCalledWith(Number.NaN);
  });

  it.each(["admin", "user", undefined])("preserves administrator access for role %s", async (role) => {
    const auth = { canActivate: vi.fn().mockResolvedValue(true) };
    const guard = new AdminGuard(auth as never);
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
    } as ExecutionContext;
    if (role === "admin") await expect(guard.canActivate(context)).resolves.toBe(true);
    else await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(auth.canActivate).toHaveBeenCalledWith(context);
  });

  it("propagates authentication rejection before checking the role", async () => {
    const guard = new AdminGuard({ canActivate: vi.fn().mockRejectedValue(new UnauthorizedException()) } as never);
    await expect(guard.canActivate({} as ExecutionContext)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
