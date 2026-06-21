import "dotenv/config";

export const env = {
  databaseUrl: process.env.DATABASE_URL,
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? "0.0.0.0",
  devUserEmail: process.env.DEV_USER_EMAIL ?? "runner@example.com",
  corsOrigin: process.env.CORS_ORIGIN
};
