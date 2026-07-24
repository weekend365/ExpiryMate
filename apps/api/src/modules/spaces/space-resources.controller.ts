import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { InventorySpaceRole } from "@prisma/client";
import {
  batchConsumeInventoryItemsBodySchema,
  createInventoryItemBodySchema,
  createUserStorageLocationBodySchema,
  ItemStatus,
  recipeRecommendationRequestSchema,
  updateInventoryItemBodySchema,
  updateUserStorageLocationBodySchema,
  type BatchConsumeInventoryItemsBody,
  type CreateInventoryItemBody,
  type CreateUserStorageLocationBody,
  type RecipeRecommendationRequest,
  type UpdateInventoryItemBody,
  type UpdateUserStorageLocationBody,
} from "@expirymate/shared";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CurrentOwnerKey } from "../auth/current-owner-key.decorator";
import { RegisteredGuard } from "../auth/registered.guard";
import { DashboardService } from "../dashboard/dashboard.service";
import { BatchDiscardInventoryItemsDto } from "../inventory/dto/batch-discard-inventory-items.dto";
import { InventoryService } from "../inventory/inventory.service";
import { RecipesService } from "../recipes/recipes.service";
import { SettingsService } from "../settings/settings.service";
import { SpacesService } from "./spaces.service";

@UseGuards(RegisteredGuard)
@Controller("spaces/:spaceId/inventory")
export class SpaceInventoryController {
  constructor(
    private readonly spacesService: SpacesService,
    private readonly inventoryService: InventoryService,
  ) {}

  @Get()
  async list(
    @Param("spaceId") spaceId: string,
    @CurrentOwnerKey() userId: string,
    @Query("q") q?: string,
    @Query("status") status?: ItemStatus,
    @Query("storageLocation") storageLocation?: string,
    @Query("expiringWithin") expiringWithin?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    await this.spacesService.requireMembership(spaceId, userId);
    return this.inventoryService.findAll({
      ownerKey: userId,
      spaceId,
      q,
      status,
      storageLocation,
      expiringWithin: expiringWithin ? Number(expiringWithin) : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(":id")
  async get(
    @Param("spaceId") spaceId: string,
    @Param("id") id: string,
    @CurrentOwnerKey() userId: string,
  ) {
    await this.spacesService.requireMembership(spaceId, userId);
    return this.inventoryService.findOne(id, userId, spaceId);
  }

  @Post()
  async create(
    @Param("spaceId") spaceId: string,
    @CurrentOwnerKey() userId: string,
    @Body(new ZodValidationPipe(createInventoryItemBodySchema))
    body: CreateInventoryItemBody,
  ) {
    await this.spacesService.requireMembership(spaceId, userId);
    return this.inventoryService.create(body, userId, spaceId);
  }

  @Patch(":id")
  async update(
    @Param("spaceId") spaceId: string,
    @Param("id") id: string,
    @CurrentOwnerKey() userId: string,
    @Body(new ZodValidationPipe(updateInventoryItemBodySchema))
    body: UpdateInventoryItemBody,
  ) {
    await this.spacesService.requireMembership(spaceId, userId);
    return this.inventoryService.update(id, body, userId, spaceId);
  }

  @Post(":id/consume")
  async consume(
    @Param("spaceId") spaceId: string,
    @Param("id") id: string,
    @CurrentOwnerKey() userId: string,
  ) {
    await this.spacesService.requireMembership(spaceId, userId);
    return this.inventoryService.consume(id, userId, spaceId);
  }

  @Post(":id/discard")
  async discard(
    @Param("spaceId") spaceId: string,
    @Param("id") id: string,
    @CurrentOwnerKey() userId: string,
  ) {
    await this.spacesService.requireMembership(spaceId, userId);
    return this.inventoryService.discard(id, userId, spaceId);
  }

  @Post("batch-discard")
  async batchDiscard(
    @Param("spaceId") spaceId: string,
    @CurrentOwnerKey() userId: string,
    @Body() body: BatchDiscardInventoryItemsDto,
  ) {
    await this.spacesService.requireMembership(spaceId, userId);
    return this.inventoryService.batchDiscard({
      ids: body.ids,
      ownerKey: userId,
      spaceId,
    });
  }

  @Post("batch-consume")
  async batchConsume(
    @Param("spaceId") spaceId: string,
    @CurrentOwnerKey() userId: string,
    @Body(new ZodValidationPipe(batchConsumeInventoryItemsBodySchema))
    body: BatchConsumeInventoryItemsBody,
  ) {
    await this.spacesService.requireMembership(spaceId, userId);
    return this.inventoryService.batchConsume({
      items: body.items,
      ownerKey: userId,
      spaceId,
    });
  }
}

@UseGuards(RegisteredGuard)
@Controller("spaces/:spaceId/dashboard")
export class SpaceDashboardController {
  constructor(
    private readonly spacesService: SpacesService,
    private readonly dashboardService: DashboardService,
  ) {}

  @Get("summary")
  async summary(
    @Param("spaceId") spaceId: string,
    @CurrentOwnerKey() userId: string,
  ) {
    await this.spacesService.requireMembership(spaceId, userId);
    return this.dashboardService.getSummary(userId, new Date(), spaceId);
  }
}

@UseGuards(RegisteredGuard)
@Controller("spaces/:spaceId/storage-locations")
export class SpaceStorageLocationsController {
  constructor(
    private readonly spacesService: SpacesService,
    private readonly settingsService: SettingsService,
  ) {}

  @Get()
  async list(
    @Param("spaceId") spaceId: string,
    @CurrentOwnerKey() userId: string,
  ) {
    await this.spacesService.requireMembership(spaceId, userId);
    return this.settingsService.listStorageLocations(userId, spaceId);
  }

  @Post()
  async create(
    @Param("spaceId") spaceId: string,
    @CurrentOwnerKey() userId: string,
    @Body(new ZodValidationPipe(createUserStorageLocationBodySchema))
    body: CreateUserStorageLocationBody,
  ) {
    await this.spacesService.requireRole(spaceId, userId, [
      InventorySpaceRole.owner,
      InventorySpaceRole.manager,
    ]);
    return this.settingsService.createStorageLocation(userId, body, spaceId);
  }

  @Patch(":id")
  async update(
    @Param("spaceId") spaceId: string,
    @Param("id") id: string,
    @CurrentOwnerKey() userId: string,
    @Body(new ZodValidationPipe(updateUserStorageLocationBodySchema))
    body: UpdateUserStorageLocationBody,
  ) {
    await this.spacesService.requireRole(spaceId, userId, [
      InventorySpaceRole.owner,
      InventorySpaceRole.manager,
    ]);
    return this.settingsService.updateStorageLocation(
      id,
      userId,
      body,
      spaceId,
    );
  }

  @Delete(":id")
  async delete(
    @Param("spaceId") spaceId: string,
    @Param("id") id: string,
    @CurrentOwnerKey() userId: string,
  ) {
    await this.spacesService.requireRole(spaceId, userId, [
      InventorySpaceRole.owner,
      InventorySpaceRole.manager,
    ]);
    return this.settingsService.deleteStorageLocation(id, userId, spaceId);
  }
}

@UseGuards(RegisteredGuard)
@Controller("spaces/:spaceId/recipes")
export class SpaceRecipesController {
  constructor(
    private readonly spacesService: SpacesService,
    private readonly recipesService: RecipesService,
  ) {}

  @Post("recommendations")
  async createRecommendation(
    @Param("spaceId") spaceId: string,
    @CurrentOwnerKey() userId: string,
    @Body(new ZodValidationPipe(recipeRecommendationRequestSchema))
    request: RecipeRecommendationRequest,
  ) {
    await this.spacesService.requireMembership(spaceId, userId);
    return this.recipesService.createRecommendation(userId, request, spaceId);
  }

  @Get("recommendations")
  async listRecommendations(
    @Param("spaceId") spaceId: string,
    @CurrentOwnerKey() userId: string,
  ) {
    await this.spacesService.requireMembership(spaceId, userId);
    return this.recipesService.listRecommendations(userId, spaceId);
  }

  @Get("recommendations/:id")
  async getRecommendation(
    @Param("spaceId") spaceId: string,
    @Param("id") id: string,
    @CurrentOwnerKey() userId: string,
  ) {
    await this.spacesService.requireMembership(spaceId, userId);
    return this.recipesService.getRecommendation(id, userId, spaceId);
  }

  @Put("recommendations/:id/dishes/:dishIndex/favorite")
  async saveFavorite(
    @Param("spaceId") spaceId: string,
    @Param("id") id: string,
    @Param("dishIndex", ParseIntPipe) dishIndex: number,
    @CurrentOwnerKey() userId: string,
  ) {
    await this.spacesService.requireMembership(spaceId, userId);
    return this.recipesService.saveFavorite(id, dishIndex, userId, spaceId);
  }

  @Delete("recommendations/:id/dishes/:dishIndex/favorite")
  async deleteFavorite(
    @Param("spaceId") spaceId: string,
    @Param("id") id: string,
    @Param("dishIndex", ParseIntPipe) dishIndex: number,
    @CurrentOwnerKey() userId: string,
  ) {
    await this.spacesService.requireMembership(spaceId, userId);
    return this.recipesService.deleteFavorite(id, dishIndex, userId);
  }
}
