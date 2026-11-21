import { afterAll, beforeAll } from "vitest";
import { database } from "@/lib/database/connection";
import { isolatedDatabase } from "../../scripts/test-postgres.mjs";

export function setupPostgres() {
  let fixture: Awaited<ReturnType<typeof isolatedDatabase>> | undefined;
  const originalUrl = process.env.PRISMA_DATABASE_URL;
  beforeAll(async () => {
    fixture = await isolatedDatabase();
    process.env.PRISMA_DATABASE_URL = fixture.url;
  }, 30_000);
  afterAll(async () => {
    if (!fixture) return;
    await database().$disconnect();
    await fixture.drop();
    if (originalUrl === undefined) delete process.env.PRISMA_DATABASE_URL;
    else process.env.PRISMA_DATABASE_URL = originalUrl;
  });
}
