import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import {
  deleteAccountRequestSchema,
  type DeleteAccountRequest,
} from "@expirymate/shared";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { RegisteredGuard } from "../auth/registered.guard";
import { CurrentOwnerKey } from "../auth/current-owner-key.decorator";
import { PrivacyService } from "./privacy.service";

@UseGuards(RegisteredGuard)
@Controller("privacy")
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  @Get("status")
  getStatus(@CurrentOwnerKey() ownerKey: string) {
    return this.privacyService.getStatus(ownerKey);
  }

  @Post("ai-data-notice/accept")
  acceptAiDataNotice(@CurrentOwnerKey() ownerKey: string) {
    return this.privacyService.acceptAiDataNotice(ownerKey);
  }

  @Post("ai-data-notice/revoke")
  revokeAiDataNotice(@CurrentOwnerKey() ownerKey: string) {
    return this.privacyService.revokeAiDataNotice(ownerKey);
  }

  @Post("recommendation-history/delete")
  deleteRecommendationHistory(@CurrentOwnerKey() ownerKey: string) {
    return this.privacyService.deleteRecommendationHistory(ownerKey);
  }

  @Post("account/delete")
  deleteAccount(
    @CurrentOwnerKey() ownerKey: string,
    @Body(new ZodValidationPipe(deleteAccountRequestSchema))
    dto: DeleteAccountRequest,
  ) {
    void dto;
    return this.privacyService.deleteAccount(ownerKey);
  }
}
