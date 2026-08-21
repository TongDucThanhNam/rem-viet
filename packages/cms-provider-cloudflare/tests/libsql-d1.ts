import { createClient, type Client, type InStatement } from "@libsql/client";

import type {
  CloudflareD1Database,
  CloudflareD1PreparedStatement,
  D1RunResult,
  D1Value,
} from "../src";

class LibsqlPreparedStatement implements CloudflareD1PreparedStatement {
  constructor(
    readonly client: Client,
    readonly query: string,
    readonly values: D1Value[] = [],
  ) {}

  bind(...values: D1Value[]) {
    return new LibsqlPreparedStatement(this.client, this.query, values);
  }

  private statement(): InStatement {
    return { sql: this.query, args: this.values };
  }

  async first<T>() {
    const result = await this.client.execute(this.statement());
    return (result.rows[0] as T | undefined) ?? null;
  }

  async all<T>() {
    const result = await this.client.execute(this.statement());
    return { results: result.rows as unknown as T[] };
  }

  async raw<T = unknown[][]>(options?: { columnNames?: boolean }) {
    const result = await this.client.execute(this.statement());
    const rows = result.rows.map((row) =>
      result.columns.map((column) => row[column]),
    );
    return (options?.columnNames ? [result.columns, ...rows] : rows) as T;
  }

  async run(): Promise<D1RunResult> {
    const result = await this.client.execute(this.statement());
    return { success: true, meta: { changes: result.rowsAffected } };
  }
}

export class LibsqlD1Database implements CloudflareD1Database {
  readonly client = createClient({ url: ":memory:" });

  prepare(query: string) {
    return new LibsqlPreparedStatement(this.client, query);
  }

  async batch(statements: CloudflareD1PreparedStatement[]) {
    const values = statements.map((statement) => {
      if (!(statement instanceof LibsqlPreparedStatement)) {
        throw new Error("Unexpected D1 statement implementation.");
      }
      return {
        sql: statement.query,
        args: statement.values,
      } satisfies InStatement;
    });
    const results = await this.client.batch(values, "write");
    return results.map((result) => ({
      success: true,
      meta: { changes: result.rowsAffected },
    }));
  }

  async exec(query: string) {
    await this.client.executeMultiple(query);
  }

  close() {
    this.client.close();
  }
}
