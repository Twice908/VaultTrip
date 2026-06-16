import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js stores secrets in .env.local; load it so the Prisma CLI
// (migrate / seed / studio) shares the same single source of truth.
config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --experimental-strip-types prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
