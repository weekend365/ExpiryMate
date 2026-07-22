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

  configureTrustProxy(app);

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

/**
 * Auth rate limits use Express `request.ip`. Without trust proxy, that is the
 * socket peer (e.g. Railway edge). With trust proxy, Express derives client IP
 * from X-Forwarded-For safely — never trust raw forwarded headers in app code.
 *
 * TRUST_PROXY: unset → 1 hop in production, off otherwise;
 * true | N | Express trust setting string; false | 0 → disabled.
 */
function configureTrustProxy(app: NestExpressApplication) {
  const raw = process.env.TRUST_PROXY?.trim();

  if (raw === undefined || raw === "") {
    if (process.env.NODE_ENV === "production") {
      app.set("trust proxy", 1);
    }
    return;
  }

  if (raw === "false" || raw === "0") {
    return;
  }

  if (raw === "true") {
    app.set("trust proxy", 1);
    return;
  }

  const asNumber = Number(raw);
  if (Number.isInteger(asNumber) && asNumber >= 0) {
    app.set("trust proxy", asNumber);
    return;
  }

  app.set("trust proxy", raw);
}

bootstrap();
