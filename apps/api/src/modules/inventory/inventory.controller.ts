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
import { ItemStatus, StorageLocation } from "@expirymate/shared";
import { CurrentOwnerKey } from "../auth/current-owner-key.decorator";
import { RegisteredGuard } from "../auth/registered.guard";
import { BatchDiscardInventoryItemsDto } from "./dto/batch-discard-inventory-items.dto";
import { CreateInventoryItemDto } from "./dto/create-inventory-item.dto";
import { UpdateInventoryItemDto } from "./dto/update-inventory-item.dto";
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
    @Query("storageLocation") storageLocation?: StorageLocation,
    @Query("expiringWithin") expiringWithin?: string,
  ) {
    return this.inventoryService.findAll({
      ownerKey,
      q,
      status,
      storageLocation,
      expiringWithin: expiringWithin ? Number(expiringWithin) : undefined,
    });
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentOwnerKey() ownerKey: string) {
    return this.inventoryService.findOne(id, ownerKey);
  }

  @Post()
  create(@Body() dto: CreateInventoryItemDto, @CurrentOwnerKey() ownerKey: string) {
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

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateInventoryItemDto,
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
