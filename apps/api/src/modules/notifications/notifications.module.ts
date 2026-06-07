import { Module } from "@nestjs/common";
import { ExpoPushService } from "./expo-push.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  controllers: [NotificationsController],
  providers: [ExpoPushService, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
