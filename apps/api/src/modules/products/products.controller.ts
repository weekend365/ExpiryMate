import { Controller, Get, Param, Patch, Post, Body, Query } from "@nestjs/common";
import { ProductCategory } from "@expirymate/shared";
import { ProductsService } from "./products.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(
    @Query("q") q?: string,
    @Query("barcode") barcode?: string,
    @Query("category") category?: ProductCategory,
  ) {
    return this.productsService.findAll({
      q,
      barcode,
      category,
    });
  }

  @Get("barcode/:barcode")
  findByBarcode(@Param("barcode") barcode: string) {
    return this.productsService.findByBarcode(barcode);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }
}
