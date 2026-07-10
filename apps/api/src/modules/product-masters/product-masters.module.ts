import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ProductMastersController } from "./product-masters.controller";
import { ProductMastersService } from "./product-masters.service";

@Module({
  imports: [AuthModule],
  controllers: [ProductMastersController],
  providers: [ProductMastersService],
  exports: [ProductMastersService],
})
export class ProductMastersModule {}
