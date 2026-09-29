import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  createShoppingItemSchema,
  updateShoppingItemSchema,
  type CreateShoppingItem,
  type UpdateShoppingItem,
} from "@expirymate/shared";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CurrentOwnerKey } from "../auth/current-owner-key.decorator";
import { RegisteredGuard } from "../auth/registered.guard";
import { ShoppingService } from "./shopping.service";

@UseGuards(RegisteredGuard)
@Controller("spaces/:spaceId/shopping-list")
export class ShoppingController {
  constructor(private readonly shopping: ShoppingService) {}
  @Get()
  list(@Param("spaceId") spaceId: string, @CurrentOwnerKey() userId: string) {
    return this.shopping.list(spaceId, userId);
  }
  @Post()
  create(
    @Param("spaceId") spaceId: string,
    @CurrentOwnerKey() userId: string,
    @Body(new ZodValidationPipe(createShoppingItemSchema))
    body: CreateShoppingItem,
  ) {
    return this.shopping.create(spaceId, userId, body);
  }
  @Patch(":id")
  update(
    @Param("spaceId") spaceId: string,
    @Param("id") id: string,
    @CurrentOwnerKey() userId: string,
    @Body(new ZodValidationPipe(updateShoppingItemSchema))
    body: UpdateShoppingItem,
  ) {
    return this.shopping.update(spaceId, userId, id, body);
  }
  @Delete(":id")
  remove(
    @Param("spaceId") spaceId: string,
    @Param("id") id: string,
    @CurrentOwnerKey() userId: string,
    @Body(
      new ZodValidationPipe(
        updateShoppingItemSchema.pick({ expectedVersion: true }),
      ),
    )
    body: Pick<UpdateShoppingItem, "expectedVersion">,
  ) {
    return this.shopping.remove(spaceId, userId, id, body.expectedVersion);
  }
}
