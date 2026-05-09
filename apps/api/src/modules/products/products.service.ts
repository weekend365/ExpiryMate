import { Injectable, NotFoundException } from "@nestjs/common";
import { ProductCategory } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { serializeProduct } from "../../common/serializers";
import { CreateProductDto } from "./dto/create-product.dto";

interface FindProductsParams {
  q?: string;
  category?: ProductCategory;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: FindProductsParams) {
    const products = await this.prisma.product.findMany({
      where: {
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

  async create(dto: CreateProductDto) {
    const product = await this.prisma.product.create({
      data: {
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
