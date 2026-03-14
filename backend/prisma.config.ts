import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const directUrl = process.env.DIRECT_URL;
const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL"),
    ...(directUrl ? { directUrl } : {}),
    ...(shadowDatabaseUrl ? { shadowDatabaseUrl } : {}),
  },
});
