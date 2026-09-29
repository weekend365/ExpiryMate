import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SpacesModule } from "../spaces/spaces.module";
import { ShoppingController } from "./shopping.controller";
import { ShoppingService } from "./shopping.service";
@Module({
  imports: [AuthModule, SpacesModule],
  controllers: [ShoppingController],
  providers: [ShoppingService],
})
export class ShoppingModule {}
