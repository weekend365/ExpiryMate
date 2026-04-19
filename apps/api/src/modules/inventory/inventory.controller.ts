import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ItemStatus, StorageLocation } from "@expirymate/shared";
import { CreateInventoryItemDto } from "./dto/create-inventory-item.dto";
import { UpdateInventoryItemDto } from "./dto/update-inventory-item.dto";
import { InventoryService } from "./inventory.service";

@Controller("inventory")
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  findAll(
    @Query("q") q?: string,
    @Query("status") status?: ItemStatus,
    @Query("storageLocation") storageLocation?: StorageLocation,
    @Query("expiringWithin") expiringWithin?: string,
    @Query("ownerKey") ownerKey?: string,
  ) {
    return this.inventoryService.findAll({
      ownerKey: ownerKey ?? process.env.DEFAULT_OWNER_KEY ?? "demo-user",
      q,
      status,
      storageLocation,
      expiringWithin: expiringWithin ? Number(expiringWithin) : undefined,
    });
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.inventoryService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateInventoryItemDto) {
    return this.inventoryService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateInventoryItemDto) {
    return this.inventoryService.update(id, dto);
  }

  @Post(":id/consume")
  consume(@Param("id") id: string) {
    return this.inventoryService.consume(id);
  }

  @Post(":id/discard")
  discard(@Param("id") id: string) {
    return this.inventoryService.discard(id);
  }
}
