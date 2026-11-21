import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import pg from "pg";

export function testDatabaseUrl() {
  const value = process.env.TEST_POSTGRES_URL;
  if (!value)
    throw new Error(
      "Set TEST_POSTGRES_URL to a disposable PostgreSQL test database.",
    );
  return value;
}

export async function isolatedDatabase() {
  const schema = `orcas_test_${randomBytes(10).toString("hex")}`;
  const database = new URL(testDatabaseUrl());
  database.searchParams.set("schema", schema);
  database.searchParams.set("options", `-c search_path=${schema}`);
  const url = database.href;
  execFileSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    {
      env: {
        ...process.env,
        PRISMA_DATABASE_URL: url,
        PRISMA_MIGRATION_URL: "",
      },
      stdio: "pipe",
    },
  );
  return {
    url,
    async drop() {
      const client = new pg.Client({ connectionString: url });
      try {
        await client.connect();
        await client.query(`DROP SCHEMA "${schema}" CASCADE`);
      } finally {
        await client.end();
      }
    },
  };
}

export async function postgresQuery(sql, values = []) {
  const connectionString = process.env.PRISMA_DATABASE_URL;
  if (
    !connectionString ||
    !/^orcas_test_[a-f0-9]{20}$/.test(
      new URL(connectionString).searchParams.get("schema") ?? "",
    )
  )
    throw new Error("Run integration tests with an isolated test database.");
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    return await client.query(sql, values);
  } finally {
    await client.end();
  }
}
