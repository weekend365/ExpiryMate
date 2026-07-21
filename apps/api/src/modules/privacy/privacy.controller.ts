import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { RegisteredGuard } from "../auth/registered.guard";
import { CurrentOwnerKey } from "../auth/current-owner-key.decorator";
import { DeleteAccountDto } from "./dto/privacy.dto";
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

  @Post("account/delete")
  deleteAccount(
    @CurrentOwnerKey() ownerKey: string,
    @Body() dto: DeleteAccountDto,
  ) {
    void dto;
    return this.privacyService.deleteAccount(ownerKey);
  }
}
