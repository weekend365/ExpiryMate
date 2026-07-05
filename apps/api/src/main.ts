import "./instrument";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { json, urlencoded, type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/http-exception.filter";
import { ResponseInterceptor } from "./common/response.interceptor";
import { validateProductionEnvironment } from "./config/production-env";

async function bootstrap() {
  validateProductionEnvironment();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  app.use(normalizeJsonContentType);
  app.use(json({ limit: "10mb" }));
  app.use(urlencoded({ extended: true, limit: "10mb" }));

  app.enableCors({
    origin: [
      process.env.CORS_ORIGIN_ADMIN ?? "http://localhost:3000",
      process.env.CORS_ORIGIN_MOBILE ?? "http://localhost:8081",
    ],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "x-expirymate-client"],
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  });

  app.use(
    helmet({
      // Admin/mobile clients call this API from separate origins in the browser.
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
}

function normalizeJsonContentType(req: Request, _res: Response, next: NextFunction) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    next();
    return;
  }

  const hasBody = Number(req.headers["content-length"] ?? 0) > 0;
  const contentType = req.headers["content-type"]?.toLowerCase() ?? "";

  if (hasBody && !contentType.includes("json")) {
    req.headers["content-type"] = "application/json";
  }

  next();
}

bootstrap();
