import { setTimeout as delay } from "node:timers/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { withAccelerate } from "@prisma/extension-accelerate";
import { PrismaClient } from "./generated/client";

type Params = (string | number | null)[];
type RawClient = Pick<
  PrismaClient,
  "$queryRawUnsafe" | "$executeRawUnsafe" | "accounts" | "account_sessions"
>;

function createClient(url: string): PrismaClient {
  if (url.startsWith("prisma+postgres://") || url.startsWith("prisma://")) {
    // The extension adds cache options to the generated delegates. This
    // application uses their original Prisma Client contract.
    return new PrismaClient({ accelerateUrl: url }).$extends(
      withAccelerate(),
    ) as unknown as PrismaClient;
  }
  const adapter = new PrismaPg(
    {
      connectionString: url,
      max: 3,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10_000,
      allowExitOnIdle: true,
    },
    { schema: new URL(url).searchParams.get("schema") ?? "public" },
  );
  return new PrismaClient({ adapter });
}

const runtime = globalThis as typeof globalThis & {
  orcasPrisma?: ReturnType<typeof createClient>;
};

export class DatabaseUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Online services are temporarily unavailable.", { cause });
    this.name = "DatabaseUnavailableError";
  }
}

export function database() {
  if (!runtime.orcasPrisma) {
    const url = process.env.PRISMA_DATABASE_URL;
    if (!url) throw new DatabaseUnavailableError();
    try {
      runtime.orcasPrisma = createClient(url);
    } catch (error) {
      throw new DatabaseUnavailableError(error);
    }
  }
  return runtime.orcasPrisma;
}

export interface SqlClient extends Pick<
  RawClient,
  "accounts" | "account_sessions"
> {
  query<T = unknown>(
    sql: string,
    values?: Params,
  ): Promise<{ rows: T[]; rowCount: number }>;
}

// Bound SQL parameters carry all request data. SQL strings are internal
// statements or use identifiers selected from fixed application constants.
export function sqlClient(db: RawClient): SqlClient {
  return {
    accounts: db.accounts,
    account_sessions: db.account_sessions,
    async query<T>(sql: string, values: Params = []) {
      if (/^\s*SELECT\b|\bRETURNING\b/i.test(sql)) {
        const rows = await db.$queryRawUnsafe<T[]>(sql, ...values);
        return { rows, rowCount: rows.length };
      }
      return { rows: [], rowCount: await db.$executeRawUnsafe(sql, ...values) };
    },
  };
}

function codeOf(error: unknown) {
  return (error as { code?: string } | null)?.code;
}

function driverMetadata(error: unknown) {
  return (
    error as {
      meta?: {
        code?: string;
        driverAdapterError?: {
          cause?: { originalCode?: string; kind?: string };
        };
      };
    } | null
  )?.meta;
}

function checkAvailability(error: unknown): never {
  const code = codeOf(error);
  const meta = driverMetadata(error);
  if (
    meta?.driverAdapterError?.cause?.kind === "TableDoesNotExist" ||
    meta?.code === "42P01" ||
    (code &&
      [
        "P1000",
        "P1001",
        "P1002",
        "P1003",
        "P1008",
        "P1011",
        "P1017",
        "P2021",
        "P2024",
        "P2037",
        "P6001",
        "P6008",
      ].includes(code))
  )
    throw new DatabaseUnavailableError(error);
  throw error;
}

export async function read<T>(work: (client: SqlClient) => Promise<T>) {
  try {
    return await work(sqlClient(database()));
  } catch (error) {
    checkAvailability(error);
  }
}

export async function readIfAvailable<T>(
  work: (client: SqlClient) => Promise<T>,
) {
  try {
    return await read(work);
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
  }
}

// Re-run pure database work on serialization failures. Callers must keep
// side effects such as setting cookies or calling external APIs outside.
export async function transaction<T>(
  work: (client: SqlClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await database().$transaction((db) => work(sqlClient(db)), {
        isolationLevel: "Serializable",
      });
    } catch (error) {
      const meta = driverMetadata(error);
      const cause = meta?.driverAdapterError?.cause;
      const rawCode = cause?.originalCode ?? meta?.code;
      if (
        attempt >= 5 ||
        (codeOf(error) !== "P2034" &&
          cause?.kind !== "TransactionWriteConflict" &&
          rawCode !== "40001" &&
          rawCode !== "40P01")
      )
        checkAvailability(error);
      await delay(5 * 2 ** attempt + Math.random() * 10);
    }
  }
}
