import { Injectable } from "@nestjs/common";
import { serializeScanLog } from "../../common/serializers";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class ScanLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: { matched?: boolean; ownerKey: string }) {
    const logs = await this.prisma.scanLog.findMany({
      where: {
        ownerKey: params.ownerKey,
        matched: params.matched,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    return logs.map(serializeScanLog);
  }
}
