import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  normalizeShoppingName,
  type CreateShoppingItem,
  type UpdateShoppingItem,
} from "@expirymate/shared";
import { PrismaService } from "../../database/prisma.service";
import { serializeShoppingItem } from "../../common/serializers";
import { SpacesService } from "../spaces/spaces.service";

@Injectable()
export class ShoppingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spaces: SpacesService,
  ) {}

  async list(spaceId: string, userId: string) {
    await this.spaces.requireMembership(spaceId, userId);
    const items = await this.prisma.shoppingListItem.findMany({
      where: { spaceId },
      orderBy: [{ completedAt: "asc" }, { updatedAt: "desc" }],
    });
    return { items: items.map(serializeShoppingItem) };
  }

  async create(spaceId: string, userId: string, body: CreateShoppingItem) {
    await this.spaces.requireMembership(spaceId, userId);
    const normalizedName = normalizeShoppingName(body.name);
    const where = { spaceId_normalizedName: { spaceId, normalizedName } };
    const item = await this.prisma.$transaction(async (tx) => {
      // Serialize additions in this space so the limit and duplicate handling are atomic.
      await tx.$queryRaw`SELECT "id" FROM "InventorySpace" WHERE "id" = ${spaceId} FOR UPDATE`;
      const existing = await tx.shoppingListItem.findUnique({ where });
      if (existing && !existing.completedAt) return existing;
      if (
        !existing &&
        (await tx.shoppingListItem.count({ where: { spaceId } })) >= 200
      ) {
        throw new BadRequestException(
          "장보기 목록은 200개까지 담을 수 있어요. 구매한 항목을 정리해 주세요.",
        );
      }
      return tx.shoppingListItem.upsert({
        where,
        create: { ...body, spaceId, normalizedName },
        update: {
          ...body,
          completedAt: null,
          inventoryItemId: null,
          version: { increment: 1 },
        },
      });
    });
    return serializeShoppingItem(item);
  }

  async update(
    spaceId: string,
    userId: string,
    id: string,
    body: UpdateShoppingItem,
  ) {
    await this.spaces.requireMembership(spaceId, userId);
    const { expectedVersion, completed, ...fields } = body;
    try {
      const result = await this.prisma.shoppingListItem.updateMany({
        where: { id, spaceId, version: expectedVersion },
        data: {
          ...fields,
          ...(fields.name
            ? { normalizedName: normalizeShoppingName(fields.name) }
            : {}),
          ...(completed === undefined
            ? {}
            : { completedAt: completed ? new Date() : null }),
          version: { increment: 1 },
        },
      });
      if (!result.count)
        throw new ConflictException(
          "다른 사람이 목록을 바꿨어요. 새로고침 후 다시 시도해 주세요.",
        );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "같은 재료가 목록에 있어요. 기존 항목의 수량을 바꿔 주세요.",
        );
      }
      throw error;
    }
    const item = await this.prisma.shoppingListItem.findFirst({
      where: { id, spaceId },
    });
    if (!item) throw new NotFoundException("장보기 항목을 찾을 수 없어요.");
    return serializeShoppingItem(item);
  }

  async remove(
    spaceId: string,
    userId: string,
    id: string,
    expectedVersion: number,
  ) {
    await this.spaces.requireMembership(spaceId, userId);
    const result = await this.prisma.shoppingListItem.deleteMany({
      where: { id, spaceId, version: expectedVersion },
    });
    if (!result.count)
      throw new ConflictException(
        "목록이 바뀌었어요. 새로고침 후 다시 시도해 주세요.",
      );
    return { id };
  }
}
