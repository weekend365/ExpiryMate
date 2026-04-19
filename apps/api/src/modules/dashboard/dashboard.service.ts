import { Injectable } from "@nestjs/common";
import { generateDashboardSummary } from "@expirymate/shared";
import { PrismaService } from "../../database/prisma.service";
import { serializeInventoryItem } from "../../common/serializers";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(ownerKey: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        ownerKey,
      },
      orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
    });

    return generateDashboardSummary(items.map(serializeInventoryItem));
  }
}
