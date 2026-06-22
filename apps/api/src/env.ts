import "dotenv/config";
import { z } from "zod";

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    HOST: z.string().min(1).default("0.0.0.0"),
    SESSION_COOKIE_NAME: z.string().min(1).default("rwc_session"),
    CORS_ORIGIN: z.string().optional(),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(240),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(8),
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60_000),
    REQUIRE_ORIGIN_CHECK: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value !== "false")
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "production" && !value.CORS_ORIGIN) {
      ctx.addIssue({
        code: "custom",
        path: ["CORS_ORIGIN"],
        message: "CORS_ORIGIN is required in production"
      });
    }
  });

const parsed = EnvSchema.parse(process.env);
const devCorsOrigins = ["http://localhost:5173", "http://localhost:5174"];
const corsOrigins = parsed.CORS_ORIGIN
  ? parsed.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
  : devCorsOrigins;

export const env = {
  nodeEnv: parsed.NODE_ENV,
  databaseUrl: parsed.DATABASE_URL,
  port: parsed.PORT,
  host: parsed.HOST,
  sessionCookieName: parsed.SESSION_COOKIE_NAME,
  corsOrigins,
  rateLimitMax: parsed.RATE_LIMIT_MAX,
  rateLimitWindowMs: parsed.RATE_LIMIT_WINDOW_MS,
  authRateLimitMax: parsed.AUTH_RATE_LIMIT_MAX,
  authRateLimitWindowMs: parsed.AUTH_RATE_LIMIT_WINDOW_MS,
  requireOriginCheck: parsed.REQUIRE_ORIGIN_CHECK ?? parsed.NODE_ENV === "production"
};
