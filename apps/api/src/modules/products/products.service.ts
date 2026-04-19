import { Injectable, NotFoundException } from "@nestjs/common";
import { ProductCategory } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { serializeProduct } from "../../common/serializers";
import { CreateProductDto } from "./dto/create-product.dto";

interface FindProductsParams {
  q?: string;
  category?: ProductCategory;
  barcode?: string;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: FindProductsParams) {
    const products = await this.prisma.product.findMany({
      where: {
        barcode: params.barcode
          ? {
              contains: params.barcode,
            }
          : undefined,
        category: params.category,
        OR: params.q
          ? [
              {
                name: {
                  contains: params.q,
                  mode: "insensitive",
                },
              },
              {
                brand: {
                  contains: params.q,
                  mode: "insensitive",
                },
              },
              {
                barcode: {
                  contains: params.q,
                },
              },
            ]
          : undefined,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return products.map(serializeProduct);
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException("상품을 찾을 수 없습니다.");
    }

    return serializeProduct(product);
  }

  async findByBarcode(barcode: string) {
    const ownerKey = process.env.DEFAULT_OWNER_KEY ?? "demo-user";
    const product = await this.prisma.product.findUnique({
      where: { barcode },
    });

    await this.prisma.scanLog.create({
      data: {
        barcode,
        matched: Boolean(product),
        ownerKey,
        note: product ? "product_lookup_match" : "product_lookup_unmatched",
      },
    });

    return product ? serializeProduct(product) : null;
  }

  async create(dto: CreateProductDto) {
    const product = await this.prisma.product.create({
      data: {
        barcode: dto.barcode,
        name: dto.name,
        brand: dto.brand,
        category: dto.category as ProductCategory,
        imageUrl: dto.imageUrl,
      },
    });

    return serializeProduct(product);
  }

  async update(id: string, dto: Partial<CreateProductDto>) {
    await this.findOne(id);

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...dto,
        category: dto.category as ProductCategory | undefined,
      },
    });

    return serializeProduct(product);
  }
}
