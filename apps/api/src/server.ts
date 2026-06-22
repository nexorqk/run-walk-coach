import { randomUUID } from "node:crypto";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { bootstrapData } from "./bootstrap.js";
import { env } from "./env.js";
import { prisma } from "./prisma.js";
import { registerRoutes } from "./routes.js";
import { corsOriginAllowed, enforceTrustedOrigin } from "./security.js";

type RequestError = {
  statusCode?: number;
  code?: string;
};

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: env.nodeEnv === "production" ? "info" : "debug"
    },
    genReqId: (request) =>
      request.headers["x-request-id"]?.toString() ?? randomUUID()
  });

  await app.register(helmet, {
    contentSecurityPolicy: false
  });
  await app.register(cors, {
    origin: (origin, callback) => {
      callback(null, corsOriginAllowed(origin));
    },
    credentials: true
  });
  await app.register(cookie);
  await app.register(rateLimit, {
    max: env.rateLimitMax,
    timeWindow: env.rateLimitWindowMs,
    keyGenerator: (request) => request.ip
  });
  app.addHook("preHandler", enforceTrustedOrigin);

  app.setErrorHandler((error, request, reply) => {
    const requestError = error as RequestError;
    const statusCode =
      requestError.statusCode && requestError.statusCode >= 400 && requestError.statusCode < 600
        ? requestError.statusCode
        : 500;
    const logPayload = { error, requestId: request.id };

    if (statusCode >= 500) {
      request.log.error(logPayload, "Unhandled request error");
    } else {
      request.log.warn(logPayload, "Request error");
    }

    if (reply.sent) {
      return;
    }

    return reply.status(statusCode).send({
      error: statusCode >= 500 ? "InternalServerError" : requestError.code ?? "RequestError",
      requestId: request.id
    });
  });

  await registerRoutes(app);

  return app;
}

async function start() {
  await bootstrapData();

  const app = await buildServer();

  const shutdown = async () => {
    await app.close();
    await prisma.$disconnect();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await app.listen({
    port: env.port,
    host: env.host
  });
}

start().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection", reason);
});

process.on("uncaughtException", async (error) => {
  console.error("Uncaught exception", error);
  await prisma.$disconnect();
  process.exit(1);
});
