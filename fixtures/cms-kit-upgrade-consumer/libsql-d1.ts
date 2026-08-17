import { createClient, type Client, type InStatement } from "@libsql/client";
import type {
  CloudflareD1Database,
  CloudflareD1PreparedStatement,
  D1RunResult,
  D1Value,
} from "@agency/cms-provider-cloudflare";

class Statement implements CloudflareD1PreparedStatement {
  constructor(
    readonly client: Client,
    readonly query: string,
    readonly values: D1Value[] = [],
  ) {}

  bind(...values: D1Value[]) {
    return new Statement(this.client, this.query, values);
  }

  private input(): InStatement {
    return { sql: this.query, args: this.values };
  }

  async first<T>() {
    const result = await this.client.execute(this.input());
    return (result.rows[0] as T | undefined) ?? null;
  }

  async all<T>() {
    const result = await this.client.execute(this.input());
    return { results: result.rows as unknown as T[] };
  }

  async run(): Promise<D1RunResult> {
    const result = await this.client.execute(this.input());
    return { success: true, meta: { changes: result.rowsAffected } };
  }
}

export class LocalD1 implements CloudflareD1Database {
  readonly client: Client;

  constructor(url: string) {
    this.client = createClient({ url });
  }

  prepare(query: string) {
    return new Statement(this.client, query);
  }

  async batch(statements: CloudflareD1PreparedStatement[]) {
    const input = statements.map((statement) => {
      if (!(statement instanceof Statement)) {
        throw new Error("Unexpected statement implementation");
      }
      return {
        sql: statement.query,
        args: statement.values,
      } satisfies InStatement;
    });
    const results = await this.client.batch(input, "write");
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
