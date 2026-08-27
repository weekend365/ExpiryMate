import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { InventorySpaceRole } from "@prisma/client";
import {
  batchConsumeInventoryItemsBodySchema,
  batchCreateInventoryItemsBodySchema,
  affiliateProductSearchRequestSchema,
  createInventoryItemBodySchema,
  createUserStorageLocationBodySchema,
  ItemStatus,
  recipeRecommendationRequestSchema,
  updateRecipeEngagementSchema,
  updateInventoryItemBodySchema,
  updateUserStorageLocationBodySchema,
  type BatchConsumeInventoryItemsBody,
  type BatchCreateInventoryItemsBody,
  type AffiliateProductSearchRequest,
  type CreateInventoryItemBody,
  type CreateUserStorageLocationBody,
  type RecipeRecommendationRequest,
  type UpdateRecipeEngagement,
  type UpdateInventoryItemBody,
  type UpdateUserStorageLocationBody,
} from "@expirymate/shared";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CurrentOwnerKey } from "../auth/current-owner-key.decorator";
import { RegisteredGuard } from "../auth/registered.guard";
import { DashboardService } from "../dashboard/dashboard.service";
import { BatchDiscardInventoryItemsDto } from "../inventory/dto/batch-discard-inventory-items.dto";
import { InventoryService } from "../inventory/inventory.service";
import { InventoryPhotoParseService } from "../inventory/inventory-photo-parse.service";
import { RecipesService } from "../recipes/recipes.service";
import { AffiliateOfferService } from "../affiliate/affiliate-offer.service";
import { SettingsService } from "../settings/settings.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { SpacesService } from "./spaces.service";

@UseGuards(RegisteredGuard)
@Controller("spaces/:spaceId/inventory")
export class SpaceInventoryController {
  constructor(
    private readonly spacesService: SpacesService,
    private readonly inventoryService: InventoryService,
    private readonly photoParseService: InventoryPhotoParseService,
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

  @Post("parse-photo")
  @UseInterceptors(
    FileInterceptor("image", {
      storage: memoryStorage(),
      limits: { fileSize: 4 * 1024 * 1024 },
    }),
  )
  async parsePhoto(
    @Param("spaceId") spaceId: string,
    @CurrentOwnerKey() userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body("scene") scene: string,
  ) {
    await this.spacesService.requireMembership(spaceId, userId);
    return this.photoParseService.parsePhoto({
      ownerKey: userId,
      spaceId,
      scene,
      file,
    });
  }

  @Post("batch-create")
  async batchCreate(
    @Param("spaceId") spaceId: string,
    @CurrentOwnerKey() userId: string,
    @Body(new ZodValidationPipe(batchCreateInventoryItemsBodySchema))
    body: BatchCreateInventoryItemsBody,
  ) {
    await this.spacesService.requireMembership(spaceId, userId);
    return this.inventoryService.createMany(body.items, userId, spaceId);
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
    private readonly affiliateOffers: AffiliateOfferService,
  ) {}

  @Post("recommendations")
  async createRecommendation(
    @Param("spaceId") spaceId: string,
    @CurrentOwnerKey() userId: string,
    @Body(new ZodValidationPipe(recipeRecommendationRequestSchema))
    request: RecipeRecommendationRequest,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    await this.spacesService.requireMembership(spaceId, userId);
    return this.recipesService.createRecommendation(
      userId,
      request,
      spaceId,
      idempotencyKey,
    );
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

  @Get("recommendations/:id/dishes/:dishIndex/affiliate-offers")
  async getAffiliateOffers(
    @Param("spaceId") spaceId: string,
    @Param("id") id: string,
    @Param("dishIndex", ParseIntPipe) dishIndex: number,
    @CurrentOwnerKey() userId: string,
  ) {
    await this.spacesService.requireMembership(spaceId, userId);
    return this.affiliateOffers.getOffersForDish({
      ownerKey: userId,
      recommendationId: id,
      dishIndex,
      spaceId,
    });
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

  @Put("recommendations/:id/dishes/:dishIndex/engagement")
  async recordEngagement(
    @Param("spaceId") spaceId: string,
    @Param("id") id: string,
    @Param("dishIndex", ParseIntPipe) dishIndex: number,
    @CurrentOwnerKey() userId: string,
    @Body(new ZodValidationPipe(updateRecipeEngagementSchema))
    body: UpdateRecipeEngagement,
  ) {
    await this.spacesService.requireMembership(spaceId, userId);
    return this.recipesService.recordEngagement(
      id,
      dishIndex,
      body.action,
      userId,
      spaceId,
    );
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

@UseGuards(RegisteredGuard)
@Controller("spaces/:spaceId/affiliate")
export class SpaceAffiliateController {
  constructor(
    private readonly spacesService: SpacesService,
    private readonly affiliateOffers: AffiliateOfferService,
  ) {}

  @Get("shopping")
  async getShopping(
    @Param("spaceId") spaceId: string,
    @CurrentOwnerKey() userId: string,
  ) {
    await this.spacesService.requireMembership(spaceId, userId);
    return this.affiliateOffers.getShopping({ ownerKey: userId, spaceId });
  }

  @Post("product-search")
  async searchProducts(
    @Param("spaceId") spaceId: string,
    @CurrentOwnerKey() userId: string,
    @Body(new ZodValidationPipe(affiliateProductSearchRequestSchema))
    body: AffiliateProductSearchRequest,
  ) {
    await this.spacesService.requireMembership(spaceId, userId);
    return this.affiliateOffers.searchProducts({
      ownerKey: userId,
      query: body.query,
    });
  }
}

@UseGuards(RegisteredGuard)
@Controller("spaces/:spaceId/subscriptions")
export class SpaceSubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get("insights")
  getInsights(
    @Param("spaceId") spaceId: string,
    @CurrentOwnerKey() userId: string,
  ) {
    return this.subscriptionsService.getHouseholdInsights(userId, spaceId);
  }
}
