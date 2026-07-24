import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import {
  acceptSpaceInvitationBodySchema,
  createInventorySpaceBodySchema,
  inviteSpaceMemberBodySchema,
  transferSpaceOwnershipBodySchema,
  updateInventorySpaceBodySchema,
  updateSpaceMemberBodySchema,
  updateSpaceNotificationBodySchema,
  type AcceptSpaceInvitationBody,
  type CreateInventorySpaceBody,
  type InviteSpaceMemberBody,
  type TransferSpaceOwnershipBody,
  type UpdateInventorySpaceBody,
  type UpdateSpaceMemberBody,
  type UpdateSpaceNotificationBody,
} from "@expirymate/shared";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CurrentOwnerKey } from "../auth/current-owner-key.decorator";
import { buildAppDeepLink } from "../auth/app-links";
import { RegisteredGuard } from "../auth/registered.guard";
import { SpacesService } from "./spaces.service";

@UseGuards(RegisteredGuard)
@Controller("spaces")
export class SpacesController {
  constructor(private readonly spacesService: SpacesService) {}

  @Get()
  list(@CurrentOwnerKey() userId: string) {
    return this.spacesService.listSpaces(userId);
  }

  @Post()
  create(
    @CurrentOwnerKey() userId: string,
    @Body(new ZodValidationPipe(createInventorySpaceBodySchema))
    body: CreateInventorySpaceBody,
  ) {
    return this.spacesService.createSpace(userId, body);
  }

  @Patch(":spaceId")
  update(
    @Param("spaceId") spaceId: string,
    @CurrentOwnerKey() userId: string,
    @Body(new ZodValidationPipe(updateInventorySpaceBodySchema))
    body: UpdateInventorySpaceBody,
  ) {
    return this.spacesService.updateSpace(spaceId, userId, body);
  }

  @Delete(":spaceId")
  delete(
    @Param("spaceId") spaceId: string,
    @CurrentOwnerKey() userId: string,
  ) {
    return this.spacesService.deleteSpace(spaceId, userId);
  }

  @Get(":spaceId/members")
  members(
    @Param("spaceId") spaceId: string,
    @CurrentOwnerKey() userId: string,
  ) {
    return this.spacesService.listMembers(spaceId, userId);
  }

  @Patch(":spaceId/members/:memberUserId")
  updateMember(
    @Param("spaceId") spaceId: string,
    @Param("memberUserId") memberUserId: string,
    @CurrentOwnerKey() userId: string,
    @Body(new ZodValidationPipe(updateSpaceMemberBodySchema))
    body: UpdateSpaceMemberBody,
  ) {
    return this.spacesService.updateMemberRole(
      spaceId,
      memberUserId,
      userId,
      body.role,
    );
  }

  @Delete(":spaceId/members/:memberUserId")
  removeMember(
    @Param("spaceId") spaceId: string,
    @Param("memberUserId") memberUserId: string,
    @CurrentOwnerKey() userId: string,
  ) {
    return this.spacesService.removeMember(spaceId, memberUserId, userId);
  }

  @Post(":spaceId/transfer-ownership")
  transferOwnership(
    @Param("spaceId") spaceId: string,
    @CurrentOwnerKey() userId: string,
    @Body(new ZodValidationPipe(transferSpaceOwnershipBodySchema))
    body: TransferSpaceOwnershipBody,
  ) {
    return this.spacesService.transferOwnership(spaceId, body.userId, userId);
  }

  @Get(":spaceId/invitations")
  invitations(
    @Param("spaceId") spaceId: string,
    @CurrentOwnerKey() userId: string,
  ) {
    return this.spacesService.listInvitations(spaceId, userId);
  }

  @Post(":spaceId/invitations")
  invite(
    @Param("spaceId") spaceId: string,
    @CurrentOwnerKey() userId: string,
    @Body(new ZodValidationPipe(inviteSpaceMemberBodySchema))
    body: InviteSpaceMemberBody,
  ) {
    return this.spacesService.inviteMember(spaceId, userId, body);
  }

  @Delete(":spaceId/invitations/:invitationId")
  revokeInvite(
    @Param("spaceId") spaceId: string,
    @Param("invitationId") invitationId: string,
    @CurrentOwnerKey() userId: string,
  ) {
    return this.spacesService.revokeInvitation(
      spaceId,
      invitationId,
      userId,
    );
  }

  @Patch(":spaceId/notifications")
  updateNotifications(
    @Param("spaceId") spaceId: string,
    @CurrentOwnerKey() userId: string,
    @Body(new ZodValidationPipe(updateSpaceNotificationBodySchema))
    body: UpdateSpaceNotificationBody,
  ) {
    return this.spacesService.updateNotifications(
      spaceId,
      userId,
      body.enabled,
    );
  }
}

@UseGuards(RegisteredGuard)
@Controller("space-invitations")
export class SpaceInvitationsController {
  constructor(private readonly spacesService: SpacesService) {}

  @Post("accept")
  accept(
    @CurrentOwnerKey() userId: string,
    @Body(new ZodValidationPipe(acceptSpaceInvitationBodySchema))
    body: AcceptSpaceInvitationBody,
  ) {
    return this.spacesService.acceptInvitation(userId, body);
  }
}

@Controller("space-invitations")
export class SpaceInvitationLinksController {
  @Get("open")
  open(@Query("token") token: string, @Res() response: Response) {
    const deepLink = buildAppDeepLink("spaces/invitations/accept", {
      token: token ?? "",
    });
    response
      .status(200)
      .type("html")
      .send(
        `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${escapeHtml(
          deepLink,
        )}"><title>냉장고 초대</title></head><body><p><a href="${escapeHtml(
          deepLink,
        )}">앱에서 초대를 이어갈게요</a></p></body></html>`,
      );
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
