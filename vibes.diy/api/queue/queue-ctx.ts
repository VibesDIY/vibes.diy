import { exception2Result, Result } from "@adviser/cement";
import { RawEmailWithoutFrom } from "@vibes.diy/api-types";
import { D1Database, Fetcher } from "@cloudflare/workers-types";
import { createVibesApiTables, cfDrizzle, CreateSQLPeerParams, toDBFlavour, VibesApiTables } from "@vibes.diy/api-sql";
import { SuperThis } from "@fireproof/core-types-base";

export interface QueueCtxParams {
  sthis: SuperThis;
  cf: {
    BROWSER: Fetcher;
    D1: D1Database;
  };
  vibes: {
    env: {
      VIBES_DIY_PUBLIC_BASE_URL: string;
      RESEND_API_KEY: string;
      VIBES_DIY_FROM_EMAIL: string;
      DB_FLAVOUR: string;
      NEON_DATABASE_URL?: string;
      LLM_BACKEND_URL: string;
      LLM_BACKEND_API_KEY: string;
    };
  };
}

export class QueueCtx {
  readonly sthis: SuperThis;
  readonly params: QueueCtxParams;
  readonly storageSystems: {
    sql: CreateSQLPeerParams;
  };
  readonly sql: {
    db: ReturnType<typeof cfDrizzle>["db"];
    tables: VibesApiTables;
  };
  constructor(params: QueueCtxParams) {
    this.sthis = params.sthis;
    this.params = params;
    const { db } = cfDrizzle(this.params.vibes.env, this.params.cf.D1);
    const tables = createVibesApiTables(toDBFlavour(this.params.vibes.env.DB_FLAVOUR));

    this.sql = {
      db,
      tables,
    };
    this.storageSystems = {
      sql: {
        flavour: toDBFlavour(this.params.vibes.env.DB_FLAVOUR),
        db,
        assets: tables.assets,
      },
    };
  }

  async sendEmail(rm: RawEmailWithoutFrom): Promise<Result<{ result: unknown }>> {
    const rRes = await exception2Result(() =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.params.vibes.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...rm,
          from: this.params.vibes.env.VIBES_DIY_FROM_EMAIL,
        }),
      })
    );
    if (rRes.isErr()) {
      return Result.Err(rRes);
    }
    const res = rRes.Ok();
    if (!res.ok) {
      return Result.Err(`Resend got an error: ${res.status}:${res.statusText}`);
    }
    const jsonTxt = await res.text();
    const rJson = exception2Result(() => JSON.parse(jsonTxt));
    return Result.Ok({ result: rJson.isOk() ? rJson.Ok() : jsonTxt });
  }
}
