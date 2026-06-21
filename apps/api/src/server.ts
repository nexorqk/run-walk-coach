import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { bootstrapData } from "./bootstrap.js";
import { env } from "./env.js";
import { prisma } from "./prisma.js";
import { registerRoutes } from "./routes.js";

export async function buildServer() {
  const app = Fastify({
    logger: true
  });

  await app.register(cors, {
    origin: env.corsOrigin ? env.corsOrigin.split(",") : true,
    credentials: true
  });
  await app.register(cookie);
  await registerRoutes(app);

  return app;
}

async function start() {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

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
