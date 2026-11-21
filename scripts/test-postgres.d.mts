import type { QueryResult, QueryResultRow } from "pg";

export function testDatabaseUrl(): string;
export function isolatedDatabase(): Promise<{
  url: string;
  drop(): Promise<void>;
}>;
export function postgresQuery<Row extends QueryResultRow = QueryResultRow>(
  sql: string,
  values?: (string | number | null)[],
): Promise<QueryResult<Row>>;
