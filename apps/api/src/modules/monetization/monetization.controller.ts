import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  createRewardedAdSessionRequestSchema,
  type CreateRewardedAdSessionRequest,
} from "@expirymate/shared";
import type { Request } from "express";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CurrentOwnerKey } from "../auth/current-owner-key.decorator";
import { RegisteredGuard } from "../auth/registered.guard";
import { MonetizationService } from "./monetization.service";

@Controller("monetization")
export class MonetizationController {
  constructor(private readonly monetization: MonetizationService) {}

  @Get("status")
  @UseGuards(RegisteredGuard)
  getStatus(@CurrentOwnerKey() ownerKey: string) {
    return this.monetization.getStatus(ownerKey);
  }

  @Post("rewarded-ad-sessions")
  @UseGuards(RegisteredGuard)
  createRewardedAdSession(
    @Body(new ZodValidationPipe(createRewardedAdSessionRequestSchema))
    body: CreateRewardedAdSessionRequest,
    @CurrentOwnerKey() ownerKey: string,
  ) {
    return this.monetization.createRewardedAdSession(ownerKey, body.platform);
  }

  @Get("rewarded-ad-sessions/:id")
  @UseGuards(RegisteredGuard)
  getRewardedAdSession(
    @Param("id") id: string,
    @CurrentOwnerKey() ownerKey: string,
  ) {
    return this.monetization.getRewardedAdSession(ownerKey, id);
  }

  @Post("rewarded-ad-sessions/:id/cancel")
  @UseGuards(RegisteredGuard)
  cancelRewardedAdSession(
    @Param("id") id: string,
    @CurrentOwnerKey() ownerKey: string,
  ) {
    return this.monetization.cancelRewardedAdSession(ownerKey, id);
  }

  @Get("admob/ssv")
  verifyAdMobReward(@Req() request: Request, @Query() query: Record<string, string>) {
    return this.monetization.verifyAdMobReward(request.originalUrl, query);
  }
}
