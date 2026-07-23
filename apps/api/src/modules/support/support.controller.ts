import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  supportInquiryCloseSchema,
  supportInquiryCreateSchema,
  type SupportInquiryCloseInput,
  type SupportInquiryCreateInput,
} from "@expirymate/shared";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { AdminGuard } from "../auth/admin.guard";
import { CurrentOwnerKey } from "../auth/current-owner-key.decorator";
import { RegisteredGuard } from "../auth/registered.guard";
import { SupportService } from "./support.service";

@Controller("support")
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @UseGuards(RegisteredGuard)
  @Post("inquiries")
  @HttpCode(201)
  createInquiry(
    @CurrentOwnerKey() ownerKey: string,
    @Body(new ZodValidationPipe(supportInquiryCreateSchema))
    dto: SupportInquiryCreateInput,
  ) {
    return this.supportService.createInquiry(ownerKey, dto);
  }

  @UseGuards(AdminGuard)
  @Get("inquiries")
  listInquiries(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("status") status?: string,
    @Query("category") category?: string,
  ) {
    return this.supportService.listInquiries({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
      category,
    });
  }

  @UseGuards(AdminGuard)
  @Patch("inquiries/:id")
  closeInquiry(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(supportInquiryCloseSchema))
    dto: SupportInquiryCloseInput,
  ) {
    void dto;
    return this.supportService.closeInquiry(id);
  }
}
