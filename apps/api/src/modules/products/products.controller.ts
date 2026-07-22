import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ProductCategory } from "@expirymate/shared";
import { AdminGuard } from "../auth/admin.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { ProductsService } from "./products.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(
    @Query("q") q?: string,
    @Query("category") category?: ProductCategory,
  ) {
    return this.productsService.findAll({
      q,
      category,
    });
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateProductDto, @Req() request: AuthenticatedRequest) {
    return this.productsService.create(dto, request.user!.ownerKey);
  }

  @Patch(":id")
  @UseGuards(AdminGuard)
  update(
    @Param("id") id: string,
    @Body() dto: UpdateProductDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.productsService.update(id, dto, request.user!.ownerKey);
  }
}
