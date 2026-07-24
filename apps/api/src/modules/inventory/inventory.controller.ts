import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  batchConsumeInventoryItemsBodySchema,
  createInventoryItemBodySchema,
  ItemStatus,
  updateInventoryItemBodySchema,
  type BatchConsumeInventoryItemsBody,
  type CreateInventoryItemBody,
  type UpdateInventoryItemBody,
} from "@expirymate/shared";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CurrentOwnerKey } from "../auth/current-owner-key.decorator";
import { RegisteredGuard } from "../auth/registered.guard";
import { BatchDiscardInventoryItemsDto } from "./dto/batch-discard-inventory-items.dto";
import { InventoryService } from "./inventory.service";

@UseGuards(RegisteredGuard)
@Controller("inventory")
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  findAll(
    @CurrentOwnerKey() ownerKey: string,
    @Query("q") q?: string,
    @Query("status") status?: ItemStatus,
    @Query("storageLocation") storageLocation?: string,
    @Query("expiringWithin") expiringWithin?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.inventoryService.findAll({
      ownerKey,
      q,
      status,
      storageLocation,
      expiringWithin: expiringWithin ? Number(expiringWithin) : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentOwnerKey() ownerKey: string) {
    return this.inventoryService.findOne(id, ownerKey);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createInventoryItemBodySchema))
    dto: CreateInventoryItemBody,
    @CurrentOwnerKey() ownerKey: string,
  ) {
    return this.inventoryService.create(dto, ownerKey);
  }

  @Post("batch-discard")
  batchDiscard(
    @Body() dto: BatchDiscardInventoryItemsDto,
    @CurrentOwnerKey() ownerKey: string,
  ) {
    return this.inventoryService.batchDiscard({
      ids: dto.ids,
      ownerKey,
    });
  }

  @Post("batch-consume")
  batchConsume(
    @Body(new ZodValidationPipe(batchConsumeInventoryItemsBodySchema))
    dto: BatchConsumeInventoryItemsBody,
    @CurrentOwnerKey() ownerKey: string,
  ) {
    return this.inventoryService.batchConsume({
      items: dto.items,
      ownerKey,
    });
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateInventoryItemBodySchema))
    dto: UpdateInventoryItemBody,
    @CurrentOwnerKey() ownerKey: string,
  ) {
    return this.inventoryService.update(id, dto, ownerKey);
  }

  @Post(":id/consume")
  consume(@Param("id") id: string, @CurrentOwnerKey() ownerKey: string) {
    return this.inventoryService.consume(id, ownerKey);
  }

  @Post(":id/discard")
  discard(@Param("id") id: string, @CurrentOwnerKey() ownerKey: string) {
    return this.inventoryService.discard(id, ownerKey);
  }
}
