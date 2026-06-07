import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentOwnerKey } from "../auth/current-owner-key.decorator";
import { DeleteAccountDto } from "./dto/privacy.dto";
import { PrivacyService } from "./privacy.service";

@UseGuards(AuthGuard)
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

  @Post("account/delete")
  deleteAccount(
    @CurrentOwnerKey() ownerKey: string,
    @Body() dto: DeleteAccountDto,
  ) {
    void dto;
    return this.privacyService.deleteAccount(ownerKey);
  }
}
