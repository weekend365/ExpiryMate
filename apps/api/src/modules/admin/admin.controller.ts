import { Controller, Get, UseGuards } from "@nestjs/common";
import { generateDashboardSummary } from "@expirymate/shared";
import { serializeInventoryItem } from "../../common/serializers";
import { PrismaService } from "../../database/prisma.service";
import { AdminGuard } from "../auth/admin.guard";

@UseGuards(AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("inventory")
  async listInventory() {
    const items = await this.prisma.inventoryItem.findMany({
      orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
    });

    return items.map(serializeInventoryItem);
  }

  @Get("dashboard/summary")
  async getDashboardSummary() {
    const items = await this.prisma.inventoryItem.findMany({
      orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
    });

    return generateDashboardSummary(items.map(serializeInventoryItem));
  }
}
