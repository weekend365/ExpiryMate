import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import {
  batchConsumeInventoryItemsBodySchema,
  batchCreateInventoryItemsBodySchema,
  createInventoryItemBodySchema,
  ItemStatus,
  updateInventoryItemBodySchema,
  type BatchConsumeInventoryItemsBody,
  type BatchCreateInventoryItemsBody,
  type CreateInventoryItemBody,
  type UpdateInventoryItemBody,
} from "@expirymate/shared";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CurrentOwnerKey } from "../auth/current-owner-key.decorator";
import { RegisteredGuard } from "../auth/registered.guard";
import { BatchDiscardInventoryItemsDto } from "./dto/batch-discard-inventory-items.dto";
import { InventoryPhotoParseService } from "./inventory-photo-parse.service";
import { InventoryService } from "./inventory.service";

@UseGuards(RegisteredGuard)
@Controller("inventory")
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly photoParseService: InventoryPhotoParseService,
  ) {}

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
      spaceId: personalSpaceId(ownerKey),
      q,
      status,
      storageLocation,
      expiringWithin: expiringWithin ? Number(expiringWithin) : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("photo-parse-access")
  getPhotoParseAccess(@CurrentOwnerKey() ownerKey: string) {
    return this.photoParseService.getAccess(ownerKey);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentOwnerKey() ownerKey: string) {
    return this.inventoryService.findOne(id, ownerKey, personalSpaceId(ownerKey));
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createInventoryItemBodySchema))
    dto: CreateInventoryItemBody,
    @CurrentOwnerKey() ownerKey: string,
  ) {
    return this.inventoryService.create(dto, ownerKey, personalSpaceId(ownerKey));
  }

  @Post("parse-photo")
  @UseInterceptors(
    FileInterceptor("image", {
      storage: memoryStorage(),
      limits: { fileSize: 4 * 1024 * 1024 },
    }),
  )
  parsePhoto(
    @CurrentOwnerKey() ownerKey: string,
    @UploadedFile() file: Express.Multer.File,
    @Body("scene") scene: string,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.photoParseService.parsePhoto({
      ownerKey,
      spaceId: personalSpaceId(ownerKey),
      scene,
      file,
      idempotencyKey,
    });
  }

  @Post("batch-create")
  batchCreate(
    @Body(new ZodValidationPipe(batchCreateInventoryItemsBodySchema))
    dto: BatchCreateInventoryItemsBody,
    @CurrentOwnerKey() ownerKey: string,
  ) {
    return this.inventoryService.createMany(
      dto.items,
      ownerKey,
      personalSpaceId(ownerKey),
    );
  }

  @Post("batch-discard")
  batchDiscard(
    @Body() dto: BatchDiscardInventoryItemsDto,
    @CurrentOwnerKey() ownerKey: string,
  ) {
    return this.inventoryService.batchDiscard({
      ids: dto.ids,
      ownerKey,
      spaceId: personalSpaceId(ownerKey),
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
      spaceId: personalSpaceId(ownerKey),
    });
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateInventoryItemBodySchema))
    dto: UpdateInventoryItemBody,
    @CurrentOwnerKey() ownerKey: string,
  ) {
    return this.inventoryService.update(
      id,
      dto,
      ownerKey,
      personalSpaceId(ownerKey),
    );
  }

  @Post(":id/consume")
  consume(@Param("id") id: string, @CurrentOwnerKey() ownerKey: string) {
    return this.inventoryService.consume(id, ownerKey, personalSpaceId(ownerKey));
  }

  @Post(":id/discard")
  discard(@Param("id") id: string, @CurrentOwnerKey() ownerKey: string) {
    return this.inventoryService.discard(id, ownerKey, personalSpaceId(ownerKey));
  }
}

function personalSpaceId(userId: string) {
  return `personal_${userId}`;
}
